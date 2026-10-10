import { create } from "zustand"
import type { Camera, Element } from "@/lib/types"
import { uid } from "@/lib/id"
import { useUI } from "@/store/useUI"
import { translateElement } from "@/lib/transform"
import { dissolveSingletonGroups, remapGroupIds } from "@/lib/groups"

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
  reorderLayers: (ids: string[], dir: "up" | "down" | "top" | "bottom") => void
  groupElements: (ids: string[]) => void
  ungroupElements: (ids: string[]) => void
  renameGroup: (groupId: string, name: string) => void

  pushHistory: () => void
  undo: () => void
  redo: () => void
}

const defaultCamera: Camera = { x: 0, y: 0, zoom: 1 }

function clone(els: Element[]): Element[] {
  return structuredClone(els)
}

/** Later indexes paint on top. `up` moves toward the front. */
function reorderElements(
  elements: Element[],
  ids: string[],
  dir: "up" | "down" | "top" | "bottom"
): Element[] {
  const idSet = new Set(ids)
  if (dir === "top" || dir === "bottom") {
    const selected = elements.filter((el) => idSet.has(el.id))
    const rest = elements.filter((el) => !idSet.has(el.id))
    return dir === "top" ? [...rest, ...selected] : [...selected, ...rest]
  }
  const next = [...elements]
  if (dir === "up") {
    for (let i = next.length - 2; i >= 0; i--) {
      if (idSet.has(next[i].id) && !idSet.has(next[i + 1].id)) {
        const tmp = next[i]
        next[i] = next[i + 1]
        next[i + 1] = tmp
      }
    }
  } else {
    for (let i = 1; i < next.length; i++) {
      if (idSet.has(next[i].id) && !idSet.has(next[i - 1].id)) {
        const tmp = next[i]
        next[i] = next[i - 1]
        next[i - 1] = tmp
      }
    }
  }
  return next
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
    set((s) => ({
      elements: dissolveSingletonGroups(s.elements.filter((el) => !idSet.has(el.id))),
    }))
    const sel = useUI.getState().selectedIds
    useUI.getState().setSelection(sel.filter((id) => !idSet.has(id)))
  },

  duplicateElements: (ids) => {
    if (ids.length === 0) return
    get().pushHistory()
    const idSet = new Set(ids)
    const copies = remapGroupIds(
      get()
        .elements.filter((el) => idSet.has(el.id))
        .map((el) => {
          const copy = translateElement(structuredClone(el), 24, 24)
          copy.id = uid()
          return copy
        }),
      () => uid("grp"),
    )
    set((s) => ({ elements: dissolveSingletonGroups([...s.elements, ...copies]) }))
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

  groupElements: (ids) => {
    const idSet = new Set(ids)
    const present = get().elements.filter((el) => idSet.has(el.id))
    if (present.length < 2) return
    get().pushHistory()
    const gid = uid("grp")
    set((s) => {
      const members = s.elements
        .filter((el) => idSet.has(el.id))
        .map((el) => ({ ...el, groupId: gid, groupName: "Group" }))
      const others = dissolveSingletonGroups(s.elements.filter((el) => !idSet.has(el.id)))
      const front = s.elements.findLastIndex((el) => idSet.has(el.id))
      const before = s.elements.slice(0, front).filter((el) => !idSet.has(el.id)).length
      return {
        elements: [...others.slice(0, before), ...members, ...others.slice(before)],
      }
    })
    useUI.getState().setSelection(present.map((el) => el.id))
  },

  ungroupElements: (ids) => {
    const idSet = new Set(ids)
    const groupIds = new Set(
      get()
        .elements.filter((el) => idSet.has(el.id) && el.groupId)
        .map((el) => el.groupId as string),
    )
    if (groupIds.size === 0) return
    get().pushHistory()
    set((s) => ({
      elements: s.elements.map((el) => {
        if (!el.groupId || !groupIds.has(el.groupId)) return el
        const next = { ...el }
        delete next.groupId
        delete next.groupName
        return next
      }),
    }))
  },

  renameGroup: (groupId, name) => {
    set((s) => ({
      elements: s.elements.map((el) =>
        el.groupId === groupId ? { ...el, groupName: name } : el,
      ),
    }))
  },

  reorderLayers: (ids, dir) => {
    if (ids.length === 0) return
    const current = get().elements
    const next = reorderElements(current, ids, dir)
    if (next.every((el, i) => el === current[i])) return
    get().pushHistory()
    set({ elements: next })
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
