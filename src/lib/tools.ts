import type { Tool } from "./types"

export interface ToolShortcut {
  id: Tool
  label: string
  /** Lowercase keys; the first entry is the primary shortcut shown in tooltips. */
  shortcuts: string[]
}

export const TOOL_SHORTCUTS: ToolShortcut[] = [
  { id: "select", label: "Select", shortcuts: ["v"] },
  { id: "text", label: "Text", shortcuts: ["t"] },
  { id: "image", label: "Image", shortcuts: ["i"] },
  { id: "line", label: "Line", shortcuts: ["l"] },
  { id: "shape", label: "Shape", shortcuts: ["r"] },
  { id: "icon", label: "Icon", shortcuts: ["o"] },
  { id: "pen", label: "Pen", shortcuts: ["p"] },
]

/** Lowercase shortcut key -> tool id, used by the keyboard handler. */
export const TOOL_BY_KEY: Record<string, Tool> = Object.fromEntries(
  TOOL_SHORTCUTS.flatMap((t) => t.shortcuts.map((key) => [key, t.id]))
)
