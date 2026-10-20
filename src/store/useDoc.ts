import { create } from "zustand"
import type { Artboard, Camera, Element, SlideAxis } from "@/lib/types"
import { uid } from "@/lib/id"
import { useUI } from "@/store/useUI"
import { translateElement } from "@/lib/transform"
import { dissolveSingletonGroups, remapGroupIds } from "@/lib/groups"
import {
  MAX_SLIDES,
  clampSize,
  clampSlideCount,
  contentCenter,
  makeArtboard,
  normalizeArtboard,
  slideFrame,
  slideStep,
  slideTotal,
} from "@/lib/artboard"
import { elementCenter } from "@/lib/geometry"

const HISTORY_LIMIT = 120

/** A completed undo step: the design plus the canvas it belonged to. */
interface HistorySnapshot {
  elements: Element[]
  artboard: Artboard
}

interface DocState {
  projectId: string
  projectName: string
  elements: Element[]
  camera: Camera
  artboard: Artboard
  past: HistorySnapshot[]
  future: HistorySnapshot[]

  setProject: (p: {
    projectId: string
    projectName: string
    elements: Element[]
    camera: Camera
    artboard?: Artboard
  }) => void
  setProjectName: (name: string) => void
  setCamera: (patch: Partial<Camera>, record?: boolean) => void
  setArtboard: (patch: Partial<Artboard>) => void
  resizeArtboard: (width: number, height: number) => void
  enableArtboard: () => void
  disableArtboard: () => void
  toggleArtboard: () => void
  setArtboardBackground: (background: string | null) => void
  setSlides: (enabled: boolean) => void
  setSlideCount: (count: number) => void
  addSlide: () => void
  removeSlide: () => void
  /** Copy a slide's contents into a new slide inserted right after it. */
  duplicateSlide: (index: number) => void
  /** Insert an empty slide right after the given one, moving later slides down. */
  insertSlideAfter: (index: number) => void
  /** Remove a slide and everything inside it. */
  deleteSlide: (index: number) => void
  setSlideAxis: (axis: SlideAxis) => void

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

function snapshot(elements: Element[], artboard: Artboard): HistorySnapshot {
  return { elements: clone(elements), artboard: structuredClone(artboard) }
}

/** Cheap equality check so no-op canvas edits don't clutter the undo stack. */
function sameArtboard(a: Artboard, b: Artboard): boolean {
  return (
    a.enabled === b.enabled &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.background === b.background &&
    a.slides === b.slides &&
    a.slideCount === b.slideCount &&
    a.slideAxis === b.slideAxis
  )
}

/** Slide index whose frame owns a world point, if any. */
function slideAtPoint(a: Artboard, p: { x: number; y: number }, total: number) {
  for (let i = 0; i < total; i++) {
    const f = slideFrame(a, i)
    if (p.x >= f.x && p.x <= f.x + f.width && p.y >= f.y && p.y <= f.y + f.height) {
      return i
    }
  }
  return -1
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
  artboard: makeArtboard(),
  past: [],
  future: [],

  setProject: ({ projectId, projectName, elements, camera, artboard }) =>
    set({
      projectId,
      projectName,
      elements,
      camera,
      artboard: normalizeArtboard(artboard),
      past: [],
      future: [],
    }),

  setProjectName: (name) => set({ projectName: name }),

  setCamera: (patch, record = false) => {
    if (record) get().pushHistory()
    set((s) => ({ camera: { ...s.camera, ...patch } }))
  },

  setArtboard: (patch) => {
    const s = get()
    const next = normalizeArtboard({ ...s.artboard, ...patch })
    if (sameArtboard(s.artboard, next)) return
    s.pushHistory()
    set({ artboard: next })
  },

  /** Resize around the artboard's current center so it never jumps. */
  resizeArtboard: (width, height) => {
    const s = get()
    const w = clampSize(width)
    const h = clampSize(height)
    const cx = s.artboard.x + s.artboard.width / 2
    const cy = s.artboard.y + s.artboard.height / 2
    const next = normalizeArtboard({
      ...s.artboard,
      width: w,
      height: h,
      x: cx - w / 2,
      y: cy - h / 2,
    })
    if (sameArtboard(s.artboard, next)) return
    s.pushHistory()
    set({ artboard: next })
  },

  /** Turn the artboard on, recentered on the current content. */
  enableArtboard: () => {
    const s = get()
    if (s.artboard.enabled) return
    const c = contentCenter(s.elements)
    s.pushHistory()
    set({
      artboard: {
        ...s.artboard,
        enabled: true,
        x: c.x - s.artboard.width / 2,
        y: c.y - s.artboard.height / 2,
      },
    })
  },

  disableArtboard: () => {
    const s = get()
    if (!s.artboard.enabled) return
    s.pushHistory()
    set({ artboard: { ...s.artboard, enabled: false } })
  },

  toggleArtboard: () => {
    const s = get()
    if (s.artboard.enabled) s.disableArtboard()
    else s.enableArtboard()
  },

  setArtboardBackground: (background) => {
    const s = get()
    if (s.artboard.background === background) return
    s.pushHistory()
    set({ artboard: { ...s.artboard, background } })
  },

  setSlides: (enabled) => {
    const s = get()
    const next = normalizeArtboard({
      ...s.artboard,
      slides: enabled,
      slideCount: enabled ? Math.max(2, s.artboard.slideCount) : 1,
    })
    if (sameArtboard(s.artboard, next)) return
    s.pushHistory()
    set({ artboard: next })
  },

  setSlideCount: (count) => {
    const s = get()
    const next = normalizeArtboard({ ...s.artboard, slideCount: clampSlideCount(count) })
    if (sameArtboard(s.artboard, next)) return
    s.pushHistory()
    set({ artboard: next })
  },

  addSlide: () => {
    const s = get()
    if (s.artboard.slideCount >= MAX_SLIDES) return
    s.pushHistory()
    set({
      artboard: normalizeArtboard({
        ...s.artboard,
        slides: true,
        slideCount: s.artboard.slideCount + 1,
      }),
    })
  },

  removeSlide: () => {
    const s = get()
    s.pushHistory()
    set({
      artboard: normalizeArtboard({
        ...s.artboard,
        slideCount: Math.max(1, s.artboard.slideCount - 1),
      }),
    })
  },

  duplicateSlide: (index) => {
    const s = get()
    const a = s.artboard
    const total = slideTotal(a)
    if (!a.enabled || !a.slides || index < 0 || index >= total || total >= MAX_SLIDES) {
      return
    }
    const frame = slideFrame(a, index)
    const step = slideStep(a)
    const edge =
      a.slideAxis === "horizontal" ? frame.x + frame.width : frame.y + frame.height
    s.pushHistory()

    const copies = remapGroupIds(
      s.elements
        .filter((el) => slideAtPoint(a, elementCenter(el), total) === index)
        .map((el) => {
          const copy = translateElement(structuredClone(el), step.x, step.y)
          copy.id = uid()
          return copy
        }),
      () => uid("grp"),
    )
    // Everything after the source slide moves one slot down the strip so each
    // existing slide keeps its own content.
    const shifted = s.elements.map((el) => {
      const c = elementCenter(el)
      const beyond = a.slideAxis === "horizontal" ? c.x > edge : c.y > edge
      return beyond ? translateElement(el, step.x, step.y) : el
    })

    set({
      elements: [...shifted, ...copies],
      artboard: normalizeArtboard({ ...a, slides: true, slideCount: total + 1 }),
    })
    useUI.getState().setSelection(copies.map((el) => el.id))
  },

  insertSlideAfter: (index) => {
    const s = get()
    const a = s.artboard
    const total = slideTotal(a)
    if (!a.enabled || !a.slides || index < 0 || index >= total || total >= MAX_SLIDES) {
      return
    }
    const frame = slideFrame(a, index)
    const step = slideStep(a)
    const edge =
      a.slideAxis === "horizontal" ? frame.x + frame.width : frame.y + frame.height
    s.pushHistory()
    const shifted = s.elements.map((el) => {
      const c = elementCenter(el)
      const beyond = a.slideAxis === "horizontal" ? c.x > edge : c.y > edge
      return beyond ? translateElement(el, step.x, step.y) : el
    })
    set({
      elements: shifted,
      artboard: normalizeArtboard({ ...a, slides: true, slideCount: total + 1 }),
    })
  },

  deleteSlide: (index) => {
    const s = get()
    const a = s.artboard
    const total = slideTotal(a)
    if (!a.enabled || !a.slides || total <= 1) return
    if (index < 0 || index >= total) return
    const frame = slideFrame(a, index)
    const step = slideStep(a)
    const edge =
      a.slideAxis === "horizontal" ? frame.x + frame.width : frame.y + frame.height
    const doomed = new Set(
      s.elements
        .filter((el) => slideAtPoint(a, elementCenter(el), total) === index)
        .map((el) => el.id)
    )
    s.pushHistory()
    const remaining = s.elements
      .filter((el) => !doomed.has(el.id))
      .map((el) => {
        const c = elementCenter(el)
        const beyond = a.slideAxis === "horizontal" ? c.x > edge : c.y > edge
        return beyond ? translateElement(el, -step.x, -step.y) : el
      })
    set({
      elements: remaining,
      artboard: normalizeArtboard({ ...a, slideCount: total - 1 }),
    })
    const sel = useUI.getState().selectedIds
    useUI.getState().setSelection(sel.filter((id) => !doomed.has(id)))
  },

  setSlideAxis: (axis) => {
    const s = get()
    if (s.artboard.slideAxis === axis) return
    s.pushHistory()
    set({ artboard: normalizeArtboard({ ...s.artboard, slideAxis: axis }) })
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
    const { elements, artboard, past } = get()
    const next = [...past, snapshot(elements, artboard)]
    if (next.length > HISTORY_LIMIT) next.shift()
    set({ past: next, future: [] })
  },

  undo: () => {
    const { past, future, elements, artboard } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      past: past.slice(0, -1),
      future: [...future, snapshot(elements, artboard)],
      elements: previous.elements,
      artboard: normalizeArtboard(previous.artboard),
    })
  },

  redo: () => {
    const { past, future, elements, artboard } = get()
    if (future.length === 0) return
    const next = future[future.length - 1]
    set({
      future: future.slice(0, -1),
      past: [...past, snapshot(elements, artboard)],
      elements: next.elements,
      artboard: normalizeArtboard(next.artboard),
    })
  },
}))

export function canUndo(): boolean {
  return useDoc.getState().past.length > 0
}
export function canRedo(): boolean {
  return useDoc.getState().future.length > 0
}
