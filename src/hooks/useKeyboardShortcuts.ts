import { useEffect } from "react"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import { uid } from "@/lib/id"
import { translateElement } from "@/lib/transform"
import { dissolveSingletonGroups, remapGroupIds } from "@/lib/groups"
import { TOOL_BY_KEY } from "@/lib/tools"
import type { Element, Tool } from "@/lib/types"

let clipboard: Element[] = []

type Doc = ReturnType<typeof useDoc.getState>
type UI = ReturnType<typeof useUI.getState>

interface ShortcutContext {
  event: KeyboardEvent
  doc: Doc
  ui: UI
}

/**
 * A shortcut handler. Return `true` to call `event.preventDefault()` (the
 * common case); return `false`/`undefined` to let the browser default through
 * (e.g. copying to the system clipboard).
 */
type ShortcutHandler = (ctx: ShortcutContext) => boolean | void

interface Shortcut {
  keys: string[]
  /** Whether the Cmd/Ctrl modifier must be held, must not be held, or is irrelevant. */
  mod?: "required" | "forbidden"
  /** Whether the Alt modifier must be held, must not be held, or is irrelevant. */
  alt?: "required" | "forbidden"
  run: ShortcutHandler
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable ||
    el.closest?.('[contenteditable="true"]') != null
  )
}

function paste(doc: Doc): boolean {
  if (clipboard.length === 0) return false
  const copies = dissolveSingletonGroups(
    remapGroupIds(
      clipboard.map((el) => {
        const copy = translateElement(structuredClone(el), 24, 24)
        copy.id = uid()
        return copy
      }),
      () => uid("grp"),
    ),
  )
  doc.addElements(copies)
  clipboard = copies
  return true
}

function activateTool(ui: UI, tool: Tool) {
  // Pressing P while the pen is already active cycles pen -> highlighter -> eraser.
  if (tool === "pen") {
    if (ui.tool === "pen" && ui.penVariant === "pen") {
      ui.setPenVariant("highlighter")
    } else if (ui.tool === "pen" && ui.penVariant === "highlighter") {
      ui.setPenVariant("eraser")
    } else {
      ui.setTool("pen")
      ui.setPenVariant("pen")
    }
    return
  }
  ui.setTool(tool)
}

/**
 * Declarative shortcut table, evaluated in order; the first match wins.
 * Keys are matched case-insensitively against `event.key`.
 */
const SHORTCUTS: Shortcut[] = [
  // ── Cmd/Ctrl commands ────────────────────────────────────────────────
  {
    keys: ["z"],
    mod: "required",
    run: ({ event, doc }) => {
      if (event.shiftKey) doc.redo()
      else doc.undo()
      return true
    },
  },
  {
    keys: ["y"],
    mod: "required",
    run: ({ doc }) => {
      doc.redo()
      return true
    },
  },
  {
    keys: ["g"],
    mod: "required",
    run: ({ event, doc, ui }) => {
      if (event.shiftKey) doc.ungroupElements(ui.selectedIds)
      else doc.groupElements(ui.selectedIds)
      return true
    },
  },
  {
    keys: ["d"],
    mod: "required",
    run: ({ doc, ui }) => {
      if (ui.selectedIds.length) doc.duplicateElements(ui.selectedIds)
      return true
    },
  },
  {
    keys: ["a"],
    mod: "required",
    run: ({ doc, ui }) => {
      ui.setSelection(doc.elements.filter((el) => !el.locked).map((el) => el.id))
      return true
    },
  },
  {
    keys: ["c"],
    mod: "required",
    run: ({ doc, ui }) => {
      const selected = doc.elements.filter((el) => ui.selectedIds.includes(el.id))
      if (selected.length) clipboard = structuredClone(selected)
      return false
    },
  },
  {
    keys: ["v"],
    mod: "required",
    run: ({ doc }) => paste(doc),
  },
  {
    keys: ["=", "+"],
    mod: "required",
    run: ({ doc, ui }) => {
      ui.requestZoom(doc.camera.zoom * 1.2)
      return true
    },
  },
  {
    keys: ["-"],
    mod: "required",
    run: ({ doc, ui }) => {
      ui.requestZoom(doc.camera.zoom / 1.2)
      return true
    },
  },
  {
    keys: ["0"],
    mod: "required",
    run: ({ ui }) => {
      ui.requestZoom(1)
      return true
    },
  },

  // ── Selection & navigation ───────────────────────────────────────────
  {
    keys: ["delete", "backspace"],
    run: ({ doc, ui }) => {
      if (!ui.selectedIds.length) return false
      doc.removeElements(ui.selectedIds)
      return true
    },
  },
  {
    keys: ["escape"],
    run: ({ ui }) => {
      ui.setTool("select")
      ui.clearSelection()
      return true
    },
  },
  {
    keys: ["arrowleft", "arrowright", "arrowup", "arrowdown"],
    run: ({ event, doc, ui }) => {
      if (!ui.selectedIds.length) return false
      const step = event.shiftKey ? 10 : 1
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0
      doc.pushHistory()
      doc.updateElements(ui.selectedIds, (el) => translateElement(el, dx, dy))
      return true
    },
  },

  // ── Tools (no modifiers) ─────────────────────────────────────────────
  {
    keys: Object.keys(TOOL_BY_KEY),
    mod: "forbidden",
    alt: "forbidden",
    run: ({ event, ui }) => {
      const tool = TOOL_BY_KEY[event.key.toLowerCase()]
      if (tool) activateTool(ui, tool)
      return true
    },
  },
  {
    keys: ["e"],
    mod: "forbidden",
    alt: "forbidden",
    run: ({ ui }) => {
      ui.setTool("pen")
      ui.setPenVariant("eraser")
      return true
    },
  },
]

function matches(shortcut: Shortcut, event: KeyboardEvent): boolean {
  if (!shortcut.keys.includes(event.key.toLowerCase())) return false
  const mod = event.metaKey || event.ctrlKey
  if (shortcut.mod === "required" && !mod) return false
  if (shortcut.mod === "forbidden" && mod) return false
  if (shortcut.alt === "required" && !event.altKey) return false
  if (shortcut.alt === "forbidden" && event.altKey) return false
  return true
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target)) return
      const ctx: ShortcutContext = {
        event,
        doc: useDoc.getState(),
        ui: useUI.getState(),
      }
      for (const shortcut of SHORTCUTS) {
        if (!matches(shortcut, event)) continue
        if (shortcut.run(ctx)) event.preventDefault()
        return
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
