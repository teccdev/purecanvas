import { create } from "zustand"
import type { PenVariant, ShapeKind, Tool } from "@/lib/types"

export type Theme = "dark" | "light"
export type ExportBackground = "transparent" | "theme" | "white" | "black"

interface Defaults {
  color: string
  fill: string
  strokeWidth: number
  filled: boolean
  cornerRadius: number
  shapeKind: ShapeKind
  penWidth: number
  highlighterWidth: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  textAlign: "left" | "center" | "right"
  arrowStart: boolean
  arrowEnd: boolean
  iconLib: "lucide" | "material"
  iconName: string
  iconStrokeWidth: number
}

interface UIState {
  theme: Theme
  tool: Tool
  penVariant: PenVariant
  selectedIds: string[]
  editingTextId: string | null
  defaults: Defaults
  layersOpen: boolean
  exportBackground: ExportBackground
  zoomRequest: { value: number; nonce: number } | null

  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setTool: (t: Tool) => void
  setPenVariant: (v: PenVariant) => void
  setSelection: (ids: string[]) => void
  addToSelection: (ids: string[]) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  setEditingText: (id: string | null) => void
  setDefaults: (patch: Partial<Defaults>) => void
  setLayersOpen: (open: boolean) => void
  setExportBackground: (b: ExportBackground) => void
  requestZoom: (value: number) => void
}

const initialDefaults: Defaults = {
  color: "#e5e7eb",
  fill: "#818cf8",
  strokeWidth: 3,
  filled: true,
  cornerRadius: 8,
  shapeKind: "rect",
  penWidth: 4,
  highlighterWidth: 18,
  fontFamily: "Inter",
  fontSize: 32,
  fontWeight: 600,
  textAlign: "left",
  arrowStart: false,
  arrowEnd: false,
  iconLib: "lucide",
  iconName: "Star",
  iconStrokeWidth: 2,
}

function getInitialTheme(): Theme {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("purecanvas-theme")
    if (saved === "light" || saved === "dark") return saved
  }
  return "dark"
}

export const useUI = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  tool: "select",
  penVariant: "pen",
  selectedIds: [],
  editingTextId: null,
  defaults: initialDefaults,
  layersOpen: false,
  exportBackground: "theme",
  zoomRequest: null,

  setTheme: (t) => {
    localStorage.setItem("purecanvas-theme", t)
    set({ theme: t })
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark"
    localStorage.setItem("purecanvas-theme", next)
    set({ theme: next })
  },
  setTool: (t) => set({ tool: t, editingTextId: null }),
  setPenVariant: (v) => set({ penVariant: v, tool: "pen" }),
  setSelection: (ids) => set({ selectedIds: ids }),
  addToSelection: (ids) =>
    set((s) => ({ selectedIds: Array.from(new Set([...s.selectedIds, ...ids])) })),
  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),
  setEditingText: (id) => set({ editingTextId: id }),
  setDefaults: (patch) => set((s) => ({ defaults: { ...s.defaults, ...patch } })),
  setLayersOpen: (open) => set({ layersOpen: open }),
  setExportBackground: (b) => set({ exportBackground: b }),
  requestZoom: (value) => set({ zoomRequest: { value, nonce: Date.now() } }),
}))
