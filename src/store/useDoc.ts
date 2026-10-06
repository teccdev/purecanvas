import { create } from "zustand"
import type { Camera, Element } from "@/lib/types"
import { uid } from "@/lib/id"
import { useUI } from "@/store/useUI"

const HISTORY_LIMIT = 120

interface DocState {
  projectId: string
  projectName: string
  elements: Element[]
  camera: Camera
  past: Element[][]
  future: Element[][]

  setProject: (p: {
    projectId: string
    projectName: string
    elements: Element[]
    camera: Camera
  }) => void
  setProjectName: (name: string) => void
  setCamera: (patch: Partial<Camera>, record?: boolean) => void

  addElements: (els: Element[], select?: boolean) => void
  updateElement: (id: string, patch: Partial<Element>) => void
  updateElements: (ids: string[], updater: (el: Element) => Element) => void
  removeElements: (ids: string[]) => void
  duplicateElements: (ids: string[]) => void
  moveLayer: (id: string, toIndex: number) => void

  pushHistory: () => void
  undo: () => void
  redo: () => void
}

const defaultCamera: Camera = { x: 0, y: 0, zoom: 1 }

function clone(els: Element[]): Element[] {
  return structuredClone(els)
}

export const useDoc = create<DocState>((set, get) => ({
  projectId: "",
  projectName: "Untitled",
  elements: [],
  camera: defaultCamera,
  past: [],
  future: [],

  setProject: ({ projectId, projectName, elements, camera }) =>
    set({ projectId, projectName, elements, camera, past: [], future: [] }),

  setProjectName: (name) => set({ projectName: name }),

  setCamera: (patch, record = false) => {
    if (record) get().pushHistory()
    set((s) => ({ camera: { ...s.camera, ...patch } }))
  },

  addElements: (els, select = true) => {
    get().pushHistory()
    set((s) => ({ elements: [...s.elements, ...els] }))
    if (select) {
      useUI.getState().setSelection(els.map((e) => e.id))
    }
  },

  updateElement: (id, patch) =>
    set((s) => ({
      elements: s.elements.map((el) =>
        el.id === id ? ({ ...el, ...patch } as Element) : el
      ),
    })),

  updateElements: (ids, updater) => {
    const idSet = new Set(ids)
    set((s) => ({
      elements: s.elements.map((el) => (idSet.has(el.id) ? updater(el) : el)),
    }))
  },

  removeElements: (ids) => {
    if (ids.length === 0) return
    get().pushHistory()
    const idSet = new Set(ids)
    set((s) => ({ elements: s.elements.filter((el) => !idSet.has(el.id)) }))
    const sel = useUI.getState().selectedIds
    useUI.getState().setSelection(sel.filter((id) => !idSet.has(id)))
  },

  duplicateElements: (ids) => {
    if (ids.length === 0) return
    get().pushHistory()
    const idSet = new Set(ids)
    const copies = get()
      .elements.filter((el) => idSet.has(el.id))
      .map((el) => {
        const copy = structuredClone(el)
        copy.id = uid()
        copy.x += 24
        copy.y += 24
        if (copy.type === "line") {
          copy.x1 += 24
          copy.y1 += 24
          copy.x2 += 24
          copy.y2 += 24
        }
        return copy
      })
    set((s) => ({ elements: [...s.elements, ...copies] }))
    useUI.getState().setSelection(copies.map((e) => e.id))
  },

  moveLayer: (id, toIndex) => {
    get().pushHistory()
    set((s) => {
      const from = s.elements.findIndex((e) => e.id === id)
      if (from === -1) return s
      const next = [...s.elements]
      const [moved] = next.splice(from, 1)
      next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, moved)
      return { elements: next }
    })
  },

  pushHistory: () => {
    const { elements, past } = get()
    const next = [...past, clone(elements)]
    if (next.length > HISTORY_LIMIT) next.shift()
    set({ past: next, future: [] })
  },

  undo: () => {
    const { past, future, elements } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      past: past.slice(0, -1),
      future: [...future, clone(elements)],
      elements: previous,
    })
  },

  redo: () => {
    const { past, future, elements } = get()
    if (future.length === 0) return
    const next = future[future.length - 1]
    set({
      future: future.slice(0, -1),
      past: [...past, clone(elements)],
      elements: next,
    })
  },
}))

export function canUndo(): boolean {
  return useDoc.getState().past.length > 0
}
export function canRedo(): boolean {
  return useDoc.getState().future.length > 0
}
