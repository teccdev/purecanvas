import { useEffect } from "react"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import type { Tool } from "@/lib/types"
import { uid } from "@/lib/id"
import type { Element } from "@/lib/types"

let clipboard: Element[] = []

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

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      const doc = useDoc.getState()
      const ui = useUI.getState()

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) doc.redo()
        else doc.undo()
        return
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault()
        doc.redo()
        return
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault()
        if (ui.selectedIds.length) doc.duplicateElements(ui.selectedIds)
        return
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault()
        ui.setSelection(doc.elements.filter((el) => !el.locked).map((el) => el.id))
        return
      }
      if (mod && e.key.toLowerCase() === "c") {
        const selected = doc.elements.filter((el) => ui.selectedIds.includes(el.id))
        if (selected.length) clipboard = structuredClone(selected)
        return
      }
      if (mod && e.key.toLowerCase() === "v") {
        if (clipboard.length) {
          e.preventDefault()
          const newIds: string[] = []
          const copies = clipboard.map((el) => {
            const id = uid()
            newIds.push(id)
            return { ...structuredClone(el), id, x: el.x + 24, y: el.y + 24 }
          })
          doc.addElements(copies)
          clipboard = copies
          void newIds
        }
        return
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault()
        ui.requestZoom(doc.camera.zoom * 1.2)
        return
      }
      if (mod && e.key === "-") {
        e.preventDefault()
        ui.requestZoom(doc.camera.zoom / 1.2)
        return
      }
      if (mod && e.key === "0") {
        e.preventDefault()
        ui.requestZoom(1)
        return
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (ui.selectedIds.length) {
          e.preventDefault()
          doc.removeElements(ui.selectedIds)
        }
        return
      }

      if (e.key === "Escape") {
        if (ui.editingTextId) ui.setEditingText(null)
        else ui.clearSelection()
        return
      }

      if (e.key.startsWith("Arrow") && ui.selectedIds.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
        doc.pushHistory()
        doc.updateElements(ui.selectedIds, (el) => ({ ...el, x: el.x + dx, y: el.y + dy }))
        return
      }

      if (mod || e.altKey) return
      const keyMap: Record<string, Tool> = {
        v: "select",
        t: "text",
        i: "image",
        l: "line",
        r: "shape",
        o: "icon",
        p: "pen",
      }
      const tool = keyMap[e.key.toLowerCase()]
      if (tool) {
        e.preventDefault()
        if (tool === "pen" && ui.tool === "pen" && ui.penVariant === "pen") {
          ui.setPenVariant("highlighter")
        } else if (tool === "pen" && ui.tool === "pen" && ui.penVariant === "highlighter") {
          ui.setPenVariant("eraser")
        } else {
          ui.setTool(tool)
          if (tool === "pen") ui.setPenVariant("pen")
        }
      }
      if (e.key.toLowerCase() === "e") {
        e.preventDefault()
        ui.setTool("pen")
        ui.setPenVariant("eraser")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
