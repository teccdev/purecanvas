import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import type {
  Bounds,
  Element,
  LineElement,
  ShapeElement,
  StrokeElement,
  StrokePoint,
  TextElement,
} from "@/lib/types"
import {
  DEG,
  boundsCorners,
  clamp,
  elementCenter,
  getBounds,
  pointInElement,
  rotatePoint,
  screenToWorld,
  simplifyPoints,
  unionBounds,
  worldToScreen,
  type Point,
} from "@/lib/geometry"
import {
  boundsFixedAnchor,
  handleToAnchor,
  resizeBox,
  rotateElementAbout,
  scaleElementAbout,
  translateElement,
} from "@/lib/transform"
import { uid } from "@/lib/id"
import { expandToGroups } from "@/lib/groups"
import {
  collectSnapTargets,
  gridSpacing,
  snapOffset,
  type SnapResult,
} from "@/lib/snapping"
import { createImageElement } from "@/lib/assets"
import { fetchImageBlob, readDragPayload } from "@/lib/pixabay"
import { ElementView } from "./ElementView"
import { SelectionOverlay } from "./SelectionOverlay"
import { DotGridBackground } from "./DotGridBackground"
import { TextEditor } from "./TextEditor"
import { registerSceneRoot } from "@/lib/exporter"

type Interaction =
  | { mode: "pan"; lastClient: Point }
  | { mode: "marquee"; startWorld: Point; additive: boolean }
  | { mode: "move"; startWorld: Point; originals: Element[]; pushed: boolean }
  | { mode: "resize"; handle: string; originals: Element[]; pushed: boolean }
  | {
      mode: "rotate"
      originals: Element[]
      center: Point
      startAngle: number
      pushed: boolean
    }
  | { mode: "draw-shape"; startWorld: Point }
  | { mode: "draw-line"; startWorld: Point }
  | { mode: "draw-pen"; points: StrokePoint[] }
  | { mode: "erase" }
  | {
      mode: "touch-pan"
      lastClient: Point
      startClient: Point
      startWorld: Point
      moved: boolean
    }
  | {
      mode: "pinch"
      startDist: number
      startZoom: number
      focalWorld: Point
    }

type SnapIndicator = {
  point: Point | null
  xLine: number | null
  yLine: number | null
}

/** Snap threshold in screen pixels, converted to world units per zoom. */
const SNAP_THRESHOLD_PX = 6

/** How long (ms) a finger must rest before a drag becomes a box-select. */
const LONG_PRESS_MS = 2000
/** How far (screen px) a finger may move before a long-press is cancelled. */
const TOUCH_MOVE_THRESHOLD = 8

export function Canvas() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const interaction = useRef<Interaction | null>(null)
  const marqueeRef = useRef<{ start: Point; end: Point } | null>(null)
  // Active touch pointers, in SVG-local screen coordinates, for pinch-zoom.
  const touchPoints = useRef<Map<number, Point>>(new Map())
  const longPressTimer = useRef<number | null>(null)

  const elements = useDoc((s) => s.elements)
  const camera = useDoc((s) => s.camera)
  const tool = useUI((s) => s.tool)
  const selectedIds = useUI((s) => s.selectedIds)
  const editingTextId = useUI((s) => s.editingTextId)
  const zoomRequest = useUI((s) => s.zoomRequest)

  const [draft, setDraft] = useState<Element | null>(null)
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const [snapIndicator, setSnapIndicator] = useState<SnapIndicator | null>(null)

  const getScreen = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: e.clientX, y: e.clientY }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const getWorld = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      return screenToWorld(getScreen(e), useDoc.getState().camera)
    },
    [getScreen]
  )

  const setSceneRoot = useCallback((node: SVGGElement | null) => {
    registerSceneRoot(node)
  }, [])

  /** Find the gentlest snap for candidate world points against the scene and grid. */
  const getSnap = useCallback(
    (candidates: Point[], excludeIds: string[], disabled: boolean): SnapResult | null => {
      if (disabled) return null
      const { elements: els, camera } = useDoc.getState()
      const spacing = gridSpacing(camera.zoom)
      const threshold = SNAP_THRESHOLD_PX / camera.zoom
      const targets = collectSnapTargets(els, new Set(excludeIds))
      return snapOffset(candidates, targets, spacing, threshold)
    },
    []
  )

  const snappedPoint = useCallback(
    (world: Point, snap: SnapResult | null): Point =>
      snap ? { x: world.x + snap.dx, y: world.y + snap.dy } : world,
    []
  )

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Never leave a pending long-press timer behind on unmount.
  useEffect(() => () => cancelLongPress(), [cancelLongPress])

  // Space key pans.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isEditableTarget(e.target)) setSpaceDown(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false)
    }
    // Reset if the window loses focus while Space is held (e.g. a native
    // dialog swallows the keyup), otherwise the cursor stays stuck as grab.
    const reset = () => setSpaceDown(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", reset)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", reset)
      document.removeEventListener("visibilitychange", reset)
    }
  }, [])

  // Wheel: zoom toward the cursor by default (ctrl/⌘ pinch included); Shift pans.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const cam = useDoc.getState().camera
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const dx = e.deltaX || e.deltaY
        const dy = e.deltaX !== 0 ? e.deltaY : 0
        useDoc.getState().setCamera({ x: cam.x - dx, y: cam.y - dy })
      } else {
        const screen = getScreen(e)
        const world = screenToWorld(screen, cam)
        const factor = Math.exp(-e.deltaY * 0.0015)
        const zoom = clamp(cam.zoom * factor, 0.05, 8)
        useDoc
          .getState()
          .setCamera({ zoom, x: screen.x - world.x * zoom, y: screen.y - world.y * zoom })
      }
    }
    svg.addEventListener("wheel", handler, { passive: false })
    return () => svg.removeEventListener("wheel", handler)
  }, [getScreen])

  // Zoom requests.
  const zoomNonce = zoomRequest?.nonce
  useEffect(() => {
    if (!zoomRequest) return
    const cam = useDoc.getState().camera
    const rect = svgRef.current?.getBoundingClientRect()
    const cx = rect ? rect.width / 2 : 0
    const cy = rect ? rect.height / 2 : 0
    const world = screenToWorld({ x: cx, y: cy }, cam)
    const zoom = clamp(zoomRequest.value, 0.05, 8)
    useDoc.getState().setCamera({ zoom, x: cx - world.x * zoom, y: cy - world.y * zoom })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomNonce])

  const addImageAt = useCallback(async (blob: Blob, world: Point) => {
    const { projectId, addElements } = useDoc.getState()
    try {
      const el = await createImageElement(projectId, blob, world)
      const d = useUI.getState().defaults
      addElements([
        { ...el, stroke: d.imageStroke, strokeWidth: d.imageStrokeWidth, shadow: d.shadow ?? null },
      ])
      // Using the image tool places one image, then returns to the cursor.
      if (useUI.getState().tool === "image") useUI.getState().setTool("select")
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            const rect = svgRef.current?.getBoundingClientRect()
            const center = screenToWorld(
              { x: rect ? rect.width / 2 : 0, y: rect ? rect.height / 2 : 0 },
              useDoc.getState().camera
            )
            void addImageAt(file, center)
          }
        }
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [addImageAt])

  // The properties panel's upload button asks us to open the file picker.
  useEffect(() => {
    const openUpload = () => fileInputRef.current?.click()
    window.addEventListener("open-image-upload", openUpload)
    return () => window.removeEventListener("open-image-upload", openUpload)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const world = getWorld({ clientX: e.clientX, clientY: e.clientY })
      // Stock images dragged from the Pixabay panel carry a custom payload.
      const payload = readDragPayload(e)
      if (payload) {
        void (async () => {
          try {
            const blob = await fetchImageBlob(payload.url)
            await addImageAt(blob, world)
          } catch {
            /* ignore */
          }
        })()
        return
      }
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
      for (const file of files) {
        void addImageAt(file, world)
      }
    },
    [addImageAt, getWorld]
  )

  const eraseAt = useCallback((world: Point) => {
    const { elements: els, removeElements } = useDoc.getState()
    const hits = els
      .filter((el) => !el.locked && pointInElement(world, el))
      .map((el) => el.id)
    if (hits.length > 0) removeElements(hits)
  }, [])

  const startResizeOrRotate = useCallback((handle: string, world: Point) => {
    const selIds = useUI.getState().selectedIds
    const originals = useDoc
      .getState()
      .elements.filter((el) => selIds.includes(el.id) && !el.locked)
      .map((el) => structuredClone(el))
    if (originals.length === 0) return
    if (handle === "rot") {
      const b = originals.length === 1 ? getBounds(originals[0]) : unionBounds(originals)
      if (!b) return
      const center: Point = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
      const startAngle = Math.atan2(world.y - center.y, world.x - center.x)
      interaction.current = { mode: "rotate", originals, center, startAngle, pushed: false }
    } else {
      interaction.current = { mode: "resize", handle, originals, pushed: false }
    }
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement
      const world = getWorld(e)
      const ui = useUI.getState()

      // Mobile touch: track pointers for pinch-zoom. A second finger always
      // starts a pinch, cancelling whatever the first finger was doing.
      if (ui.isMobile && e.pointerType === "touch") {
        const screen = getScreen(e)
        touchPoints.current.set(e.pointerId, screen)
        if (touchPoints.current.size >= 2) {
          cancelLongPress()
          const pts = [...touchPoints.current.values()]
          const [a, b] = pts
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
          const cam = useDoc.getState().camera
          interaction.current = {
            mode: "pinch",
            startDist: dist,
            startZoom: cam.zoom,
            focalWorld: screenToWorld(mid, cam),
          }
          e.currentTarget.setPointerCapture(e.pointerId)
          e.preventDefault()
          return
        }
      }

      if (e.button === 1 || spaceDown) {
        interaction.current = {
          mode: "pan",
          lastClient: { x: e.clientX, y: e.clientY },
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
        return
      }
      if (e.button !== 0) return
      if (e.pointerType === "touch") e.preventDefault()

      const handleEl = target.closest?.("[data-handle]") as SVGElement | null
      const elementEl = target.closest?.("[data-element-id]") as SVGElement | null
      setSnapIndicator(null)

      switch (ui.tool) {
        case "select": {
          if (handleEl?.dataset.handle) {
            startResizeOrRotate(handleEl.dataset.handle, world)
          } else if (elementEl?.dataset.elementId) {
            const id = elementEl.dataset.elementId
            const additive = e.shiftKey || e.metaKey || e.ctrlKey
            // Alt picks a single member out of a group; otherwise the group
            // selects as one object.
            const direct = e.altKey
            const targetIds = direct
              ? [id]
              : expandToGroups(useDoc.getState().elements, [id])
            let ids = ui.selectedIds
            if (additive) {
              const allIn = targetIds.every((t) => ids.includes(t))
              ids = allIn
                ? ids.filter((x) => !targetIds.includes(x))
                : Array.from(new Set([...ids, ...targetIds]))
              ui.setSelection(ids)
            } else if (direct) {
              ui.setSelection([id])
              ids = [id]
            } else if (targetIds.every((t) => ids.includes(t))) {
              // Plain click on something already selected: keep the
              // whole selection so dragging moves everything in it.
            } else {
              ui.setSelection(targetIds)
              ids = targetIds
            }
            const originals = useDoc
              .getState()
              .elements.filter((el) => ids.includes(el.id) && !el.locked)
              .map((el) => structuredClone(el))
            interaction.current = { mode: "move", startWorld: world, originals, pushed: false }
          } else if (ui.isMobile && e.pointerType === "touch") {
            // Empty-space touch: pan by default; hold ~2s to box-select.
            if (!e.shiftKey) ui.clearSelection()
            interaction.current = {
              mode: "touch-pan",
              lastClient: { x: e.clientX, y: e.clientY },
              startClient: { x: e.clientX, y: e.clientY },
              startWorld: world,
              moved: false,
            }
            cancelLongPress()
            longPressTimer.current = window.setTimeout(() => {
              const ia = interaction.current
              if (ia?.mode === "touch-pan" && !ia.moved) {
                interaction.current = {
                  mode: "marquee",
                  startWorld: ia.startWorld,
                  additive: false,
                }
                marqueeRef.current = { start: ia.startWorld, end: ia.startWorld }
                setMarquee({ start: ia.startWorld, end: ia.startWorld })
              }
            }, LONG_PRESS_MS)
          } else {
            if (!e.shiftKey && !e.metaKey && !e.ctrlKey) ui.clearSelection()
            interaction.current = { mode: "marquee", startWorld: world, additive: e.shiftKey }
            marqueeRef.current = { start: world, end: world }
            setMarquee({ start: world, end: world })
          }
          break
        }
        case "shape": {
          const snap = getSnap([world], [], e.altKey)
          const start = snappedPoint(world, snap)
          setSnapIndicator(toIndicator(snap))
          interaction.current = { mode: "draw-shape", startWorld: start }
          setDraft(makeShapeDraft(start, start, false, ui.defaults))
          break
        }
        case "line": {
          const snap = getSnap([world], [], e.altKey)
          const start = snappedPoint(world, snap)
          setSnapIndicator(toIndicator(snap))
          interaction.current = { mode: "draw-line", startWorld: start }
          setDraft(makeLineDraft(start, start, false, ui.defaults))
          break
        }
        case "pen": {
          if (ui.penVariant === "eraser") {
            interaction.current = { mode: "erase" }
            useDoc.getState().pushHistory()
            eraseAt(world)
          } else {
            interaction.current = { mode: "draw-pen", points: [{ x: world.x, y: world.y }] }
            setDraft(makeStrokeDraft([{ x: world.x, y: world.y }], ui))
          }
          break
        }
        case "text": {
          const d = ui.defaults
          const snap = getSnap([world], [], e.altKey)
          const origin = snappedPoint(world, snap)
          setSnapIndicator(toIndicator(snap))
          const el: TextElement = {
            id: uid(),
            type: "text",
            text: "",
            x: origin.x,
            y: origin.y,
            width: 280,
            height: d.fontSize * 1.3,
            rotation: 0,
            opacity: 1,
            fontFamily: d.fontFamily,
            fontSize: d.fontSize,
            fontWeight: d.fontWeight,
            color: d.color,
            align: d.textAlign,
            lineHeight: 1.3,
            stroke: d.textStroke,
            strokeWidth: d.textStrokeWidth,
            shadow: d.shadow ?? null,
          }
          useDoc.getState().addElements([el])
          useUI.getState().setTool("select")
          useUI.getState().setEditingText(el.id)
          return
        }
        case "icon": {
          const d = ui.defaults
          const size = 96
          const snap = getSnap([world], [], e.altKey)
          const center = snappedPoint(world, snap)
          setSnapIndicator(toIndicator(snap))
          const el: Element = {
            id: uid(),
            type: "icon",
            x: center.x - size / 2,
            y: center.y - size / 2,
            width: size,
            height: size,
            rotation: 0,
            opacity: 1,
            lib: d.iconLib,
            name: d.iconName,
            color: d.color,
            strokeWidth: d.iconStrokeWidth,
            filled: d.iconFilled,
            fill: d.iconFill,
            rounded: d.iconRounded,
            shadow: d.shadow ?? null,
          }
          useDoc.getState().addElements([el])
          // Placing an icon is a one-shot action; return to the cursor.
          useUI.getState().setTool("select")
          return
        }
        case "image": {
          // Clicking the canvas in the image tool does nothing — images are
          // placed via the stock panel or the upload button instead.
          return
        }
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [cancelLongPress, eraseAt, getScreen, getSnap, getWorld, snappedPoint, spaceDown, startResizeOrRotate]
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.pointerType === "touch" && touchPoints.current.has(e.pointerId)) {
        touchPoints.current.set(e.pointerId, getScreen(e))
      }
      const ia = interaction.current
      if (!ia) return
      const world = getWorld(e)

      switch (ia.mode) {
        case "pan": {
          // Incremental so a scroll-zoom mid-pan (which also moves the camera)
          // is preserved instead of being overwritten from a stale start camera.
          const dx = e.clientX - ia.lastClient.x
          const dy = e.clientY - ia.lastClient.y
          const cam = useDoc.getState().camera
          useDoc.getState().setCamera({ x: cam.x + dx, y: cam.y + dy })
          ia.lastClient = { x: e.clientX, y: e.clientY }
          break
        }
        case "touch-pan": {
          // Promote to a pan once the finger clears the small threshold; a
          // stationary hold instead becomes a box-select via the long-press
          // timer (which flips the interaction to `marquee`).
          if (
            !ia.moved &&
            Math.hypot(
              e.clientX - ia.startClient.x,
              e.clientY - ia.startClient.y
            ) > TOUCH_MOVE_THRESHOLD
          ) {
            ia.moved = true
            cancelLongPress()
          }
          if (ia.moved) {
            const dx = e.clientX - ia.lastClient.x
            const dy = e.clientY - ia.lastClient.y
            const cam = useDoc.getState().camera
            useDoc.getState().setCamera({ x: cam.x + dx, y: cam.y + dy })
          }
          ia.lastClient = { x: e.clientX, y: e.clientY }
          ia.startWorld = world
          break
        }
        case "pinch": {
          const pts = [...touchPoints.current.values()]
          if (pts.length < 2) break
          const [a, b] = pts
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
          const zoom = clamp(ia.startZoom * (dist / ia.startDist), 0.05, 8)
          useDoc
            .getState()
            .setCamera({
              zoom,
              x: mid.x - ia.focalWorld.x * zoom,
              y: mid.y - ia.focalWorld.y * zoom,
            })
          break
        }
        case "marquee": {
          if (marqueeRef.current) marqueeRef.current.end = world
          setMarquee({ start: ia.startWorld, end: world })
          break
        }
        case "move": {
          const dx = world.x - ia.startWorld.x
          const dy = world.y - ia.startWorld.y
          if (!ia.pushed && Math.hypot(dx, dy) > 1) {
            useDoc.getState().pushHistory()
            ia.pushed = true
          }
          const ids = ia.originals.map((el) => el.id)
          const snap = getSnap(moveCandidates(ia.originals, dx, dy), ids, e.altKey)
          const sdx = dx + (snap?.dx ?? 0)
          const sdy = dy + (snap?.dy ?? 0)
          setSnapIndicator(toIndicator(snap))
          const map = new Map(ia.originals.map((el) => [el.id, el]))
          useDoc.getState().updateElements(ids, (el) => {
            const base = map.get(el.id)
            return base ? translateElement(base, sdx, sdy) : el
          })
          break
        }
        case "resize": {
          if (!ia.pushed) {
            useDoc.getState().pushHistory()
            ia.pushed = true
          }
          let target = world
          let snap: SnapResult | null = null
          const ids = ia.originals.map((el) => el.id)
          const single = ia.originals.length === 1 ? ia.originals[0] : null
          if (
            single &&
            single.type === "line" &&
            (ia.handle === "line-start" || ia.handle === "line-end")
          ) {
            snap = getSnap([world], ids, e.altKey)
            target = snappedPoint(world, snap)
          } else if (!e.altKey) {
            // Snap the dragged grip's visual position, then move the pointer so
            // the resize lands on the snap. Corner grips track the pointer 1:1
            // (even when rotated); edge grips only move along their normal, so
            // the snap delta is projected onto it.
            const preview = resizeSelection(ia, world, e, false)
            const grip = preview ? gripCandidates(preview, ia.handle)[0] : undefined
            if (preview && grip) {
              const found = getSnap([grip], ids, false)
              if (found) {
                const { ax, ay } = handleToAnchor(ia.handle)
                let nudge = { x: found.dx, y: found.dy }
                if (ax === 0 || ay === 0) {
                  const theta = (preview.length === 1 ? preview[0].rotation : 0) * DEG
                  const ux = ax * Math.cos(theta) - ay * Math.sin(theta)
                  const uy = ax * Math.sin(theta) + ay * Math.cos(theta)
                  const along = found.dx * ux + found.dy * uy
                  nudge = { x: along * ux, y: along * uy }
                }
                target = { x: world.x + nudge.x, y: world.y + nudge.y }
                snap = { ...found, point: { x: grip.x + nudge.x, y: grip.y + nudge.y } }
              }
            }
          }
          applyResize(ia, target, e, !!snap)
          setSnapIndicator(toIndicator(snap))
          break
        }
        case "rotate": {
          if (!ia.pushed) {
            useDoc.getState().pushHistory()
            ia.pushed = true
          }
          applyRotate(ia, world, e.shiftKey, e.altKey)
          break
        }
        case "draw-shape": {
          const snap = getSnap([world], [], e.altKey)
          const corner = snappedPoint(world, snap)
          setSnapIndicator(toIndicator(snap))
          setDraft(
            makeShapeDraft(ia.startWorld, corner, e.shiftKey && !snap, useUI.getState().defaults)
          )
          break
        }
        case "draw-line": {
          const snap = getSnap([world], [], e.altKey)
          const end = snappedPoint(world, snap)
          setSnapIndicator(toIndicator(snap))
          setDraft(
            makeLineDraft(ia.startWorld, end, e.shiftKey && !snap, useUI.getState().defaults)
          )
          break
        }
        case "draw-pen": {
          const last = ia.points[ia.points.length - 1]
          const dist = Math.hypot(world.x - last.x, world.y - last.y)
          if (dist > 1.5 / useDoc.getState().camera.zoom) {
            ia.points.push({ x: world.x, y: world.y })
            setDraft(makeStrokeDraft(ia.points, useUI.getState()))
          }
          break
        }
        case "erase": {
          eraseAt(world)
          break
        }
      }
    },
    [cancelLongPress, eraseAt, getScreen, getSnap, getWorld, snappedPoint]
  )

  const finalizeStroke = useCallback(
    (points: StrokePoint[], d: ReturnType<typeof useUI.getState>["defaults"]) => {
      const { camera: cam, addElements } = useDoc.getState()
      const simplified = simplifyPoints(points, 1.6 / cam.zoom) as StrokePoint[]
      const b = pointsBounds(simplified)
      const isHighlighter = useUI.getState().penVariant === "highlighter"
      const stroke: StrokeElement = {
        id: uid(),
        type: "stroke",
        points: simplified,
        color: isHighlighter ? d.fill : d.color,
        strokeWidth: isHighlighter ? d.highlighterWidth : d.penWidth,
        variant: isHighlighter ? "highlighter" : "pen",
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        rotation: 0,
        opacity: 1,
      }
      addElements([stroke])
    },
    []
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.pointerType === "touch") touchPoints.current.delete(e.pointerId)
      cancelLongPress()
      const ia = interaction.current
      if (ia?.mode === "pinch") {
        // Stay in pinch mode until fewer than two fingers remain.
        if (touchPoints.current.size < 2) interaction.current = null
        return
      }
      interaction.current = null
      const d = useUI.getState().defaults
      setSnapIndicator(null)

    if (ia?.mode === "marquee") {
      const m = marqueeRef.current
      marqueeRef.current = null
      setMarquee(null)
      if (m) {
        const b = {
          x: Math.min(m.start.x, m.end.x),
          y: Math.min(m.start.y, m.end.y),
          width: Math.abs(m.end.x - m.start.x),
          height: Math.abs(m.end.y - m.start.y),
          rotation: 0,
        }
        if (b.width > 2 || b.height > 2) {
          const els = useDoc.getState().elements
          const ids = expandToGroups(
            els,
            els
              .filter((el) => {
                if (el.hidden || el.locked) return false
                const eb = getBounds(el)
                return (
                  eb.x < b.x + b.width &&
                  eb.x + eb.width > b.x &&
                  eb.y < b.y + b.height &&
                  eb.y + eb.height > b.y
                )
              })
              .map((el) => el.id),
          )
          const ui = useUI.getState()
          if (ia.additive) ui.addToSelection(ids)
          else ui.setSelection(ids)
        }
      }
    } else if (ia?.mode === "draw-shape" && draft?.type === "shape") {
      const shape: ShapeElement = { ...draft, id: uid() }
      if (shape.width < 6 && shape.height < 6) {
        const size = 140
        shape.x = ia.startWorld.x - size / 2
        shape.y = ia.startWorld.y - size / 2
        shape.width = size
        shape.height = size
      }
      useDoc.getState().addElements([shape])
      // One-shot tools return to the cursor after use (Pen stays).
      useUI.getState().setTool("select")
      setDraft(null)
    } else if (ia?.mode === "draw-line" && draft?.type === "line") {
      const line: LineElement = { ...draft, id: uid() }
      if (Math.hypot(line.x2 - line.x1, line.y2 - line.y1) < 4) {
        line.x2 = line.x1 + 160
        line.y2 = line.y1
      }
      useDoc.getState().addElements([line])
      useUI.getState().setTool("select")
      setDraft(null)
    } else if (ia?.mode === "draw-pen" && draft?.type === "stroke") {
      finalizeStroke(ia.points, d)
      setDraft(null)
    } else {
      setDraft(null)
    }
  }, [cancelLongPress, draft, finalizeStroke])

  const onDoubleClick = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (useUI.getState().tool !== "select") return
      // A pending drag captures the pointer, which retargets the double-click
      // event to the svg; ask the document what is actually under the cursor.
      const under = document.elementFromPoint(e.clientX, e.clientY)
      const node = under?.closest("[data-element-id]")
      const id = node?.getAttribute("data-element-id")
      if (!id) return
      const el = useDoc.getState().elements.find((x) => x.id === id)
      if (!el || el.locked || el.hidden) return
      if (el.type === "text") {
        e.preventDefault()
        useUI.getState().setEditingText(el.id)
      }
    },
    []
  )

  const screenMarquee = useMemo(() => {
    if (!marquee) return null
    const a = worldToScreen(marquee.start, camera)
    const b = worldToScreen(marquee.end, camera)
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    }
  }, [marquee, camera])

  const snapScreen = useMemo(() => {
    if (!snapIndicator) return null
    return {
      point: snapIndicator.point ? worldToScreen(snapIndicator.point, camera) : null,
      x:
        snapIndicator.xLine != null
          ? worldToScreen({ x: snapIndicator.xLine, y: 0 }, camera).x
          : null,
      y:
        snapIndicator.yLine != null
          ? worldToScreen({ x: 0, y: snapIndicator.yLine }, camera).y
          : null,
    }
  }, [snapIndicator, camera])

  const cursor = spaceDown
    ? "grab"
    : tool === "select"
      ? "default"
      : tool === "text"
        ? "text"
        : "crosshair"

  return (
    <div
      className="relative size-full overflow-hidden select-none"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <DotGridBackground camX={camera.x} camY={camera.y} zoom={camera.zoom} />
      <svg
        ref={svgRef}
        className="absolute inset-0 size-full touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
          <g ref={setSceneRoot}>
            {elements.map((el) => (
              <ElementView key={el.id} el={el} editing={el.id === editingTextId} />
            ))}
            {draft && <ElementView el={draft} />}
          </g>
        </g>
        <SelectionOverlay />
        {snapScreen && (
          <g pointerEvents="none">
            {snapScreen.point && (
              <circle
                cx={snapScreen.point.x}
                cy={snapScreen.point.y}
                r={4}
                fill="var(--primary)"
                stroke="var(--background)"
                strokeWidth={1.5}
              />
            )}
            {snapScreen.x != null && (
              <line
                x1={snapScreen.x}
                y1="0%"
                x2={snapScreen.x}
                y2="100%"
                stroke="var(--ring)"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.6}
              />
            )}
            {snapScreen.y != null && (
              <line
                x1="0%"
                y1={snapScreen.y}
                x2="100%"
                y2={snapScreen.y}
                stroke="var(--ring)"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.6}
              />
            )}
          </g>
        )}
        {screenMarquee && (
          <rect
            x={screenMarquee.x}
            y={screenMarquee.y}
            width={screenMarquee.width}
            height={screenMarquee.height}
            fill="var(--primary)"
            fillOpacity={0.12}
            stroke="var(--ring)"
            strokeWidth={1}
            pointerEvents="none"
          />
        )}
      </svg>
      <TextEditor />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          const rect = svgRef.current?.getBoundingClientRect()
          const center = screenToWorld(
            { x: rect ? rect.width / 2 : 0, y: rect ? rect.height / 2 : 0 },
            useDoc.getState().camera
          )
          files.forEach(
            (file, i) => void addImageAt(file, { x: center.x + i * 40, y: center.y + i * 40 })
          )
          e.target.value = ""
        }}
      />
      {selectedIds.length === 0 && elements.length === 0 && <EmptyHint />}
    </div>
  )
}

function toIndicator(snap: SnapResult | null): SnapIndicator | null {
  if (!snap) return null
  return { point: snap.point, xLine: snap.xLine, yLine: snap.yLine }
}

/** Snap points of a box: its four corners plus the four edge midpoints, so
 *  the selection's edges (top/left/bottom/right) snap like its corners do. */
function boxSnapPoints(b: Bounds): Point[] {
  const c = boundsCorners(b)
  const mid = (a: Point, d: Point): Point => ({
    x: (a.x + d.x) / 2,
    y: (a.y + d.y) / 2,
  })
  return [
    ...c,
    mid(c[0], c[1]),
    mid(c[1], c[2]),
    mid(c[2], c[3]),
    mid(c[3], c[0]),
  ]
}

/** World points of a moving selection that participate in snapping. */
function moveCandidates(originals: Element[], dx: number, dy: number): Point[] {
  const pts: Point[] = []
  if (originals.length === 1) {
    const el = originals[0]
    if (el.type === "line") {
      pts.push({ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 })
    } else if (el.type === "stroke" && el.points.length > 0) {
      pts.push(el.points[0], el.points[el.points.length - 1])
    } else {
      // A single box: snap its actual (rotated) corners and edge midpoints so
      // guides line up with the visible selection outline.
      pts.push(...boxSnapPoints(getBounds(el)))
    }
  }
  if (pts.length === 0) {
    const b = unionBounds(originals)
    if (b) pts.push(...boxSnapPoints(b))
  }
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

function pointsBounds(points: StrokePoint[]) {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function makeShapeDraft(
  start: Point,
  world: Point,
  shift: boolean,
  d: ReturnType<typeof useUI.getState>["defaults"]
): ShapeElement {
  let x = Math.min(start.x, world.x)
  let y = Math.min(start.y, world.y)
  let w = Math.abs(world.x - start.x)
  let h = Math.abs(world.y - start.y)
  if (shift) {
    const s = Math.max(w, h)
    w = s
    h = s
    if (world.x < start.x) x = start.x - s
    if (world.y < start.y) y = start.y - s
  }
  return {
    id: "draft-shape",
    type: "shape",
    shape: d.shapeKind,
    x,
    y,
    width: Math.max(1, w),
    height: Math.max(1, h),
    rotation: 0,
    opacity: 1,
    fill: d.fill,
    gradient: d.gradient ?? null,
    stroke: d.color,
    strokeWidth: d.strokeWidth,
    filled: d.filled,
    radius: d.cornerRadius,
    shadow: d.shadow ?? null,
  }
}

function makeLineDraft(
  start: Point,
  world: Point,
  shift: boolean,
  d: ReturnType<typeof useUI.getState>["defaults"]
): LineElement {
  let end = { ...world }
  if (shift) {
    const dx = world.x - start.x
    const dy = world.y - start.y
    const angle = Math.atan2(dy, dx)
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
    const len = Math.hypot(dx, dy)
    end = { x: start.x + Math.cos(snapped) * len, y: start.y + Math.sin(snapped) * len }
  }
  return {
    id: "draft-line",
    type: "line",
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    rotation: 0,
    opacity: 1,
    strokeWidth: d.strokeWidth,
    color: d.color,
    arrowStart: d.arrowStart,
    arrowEnd: d.arrowEnd,
    rounded: d.lineRounded,
    shadow: d.shadow ?? null,
  }
}

function makeStrokeDraft(
  points: StrokePoint[],
  ui: ReturnType<typeof useUI.getState>
): StrokeElement {
  const isHighlighter = ui.penVariant === "highlighter"
  const b = pointsBounds(points)
  return {
    id: "draft-stroke",
    type: "stroke",
    points,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    rotation: 0,
    opacity: 1,
    color: isHighlighter ? ui.defaults.fill : ui.defaults.color,
    strokeWidth: isHighlighter ? ui.defaults.highlighterWidth : ui.defaults.penWidth,
    variant: isHighlighter ? "highlighter" : "pen",
  }
}

function scaleFromHandle(
  el: Element,
  handle: string,
  world: Point,
  shift: boolean,
  alt: boolean
): Element {
  const b = getBounds(el)
  const anchor = alt
    ? { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    : boundsFixedAnchor(b, handle)
  const { ax, ay } = handleToAnchor(handle)
  const origX = ax === -1 ? b.x : ax === 1 ? b.x + b.width : b.x + b.width / 2
  const origY = ay === -1 ? b.y : ay === 1 ? b.y + b.height : b.y + b.height / 2
  let sx = ax !== 0 ? (world.x - anchor.x) / (origX - anchor.x || 1) : 1
  let sy = ay !== 0 ? (world.y - anchor.y) / (origY - anchor.y || 1) : 1
  if (shift) {
    const s = (Math.abs(sx) + Math.abs(sy)) / 2 || 1
    sx = sx < 0 ? -s : s
    sy = sy < 0 ? -s : s
  }
  return scaleElementAbout(el, anchor, sx, sy)
}

/** Resize without writing to the store; used for snap previews and applying. */
function resizeSelection(
  ia: Extract<Interaction, { mode: "resize" }>,
  world: Point,
  e: ReactPointerEvent,
  snapped: boolean
): Element[] | null {
  const opts = { shift: e.shiftKey, alt: e.altKey }
  if (ia.originals.length === 1) {
    const el = ia.originals[0]
    if (el.type === "line" && (ia.handle === "line-start" || ia.handle === "line-end")) {
      const other = ia.handle === "line-start" ? { x: el.x2, y: el.y2 } : { x: el.x1, y: el.y1 }
      let end = world
      if (!snapped && e.shiftKey) {
        const angle = Math.atan2(world.y - other.y, world.x - other.x)
        const step = Math.PI / 12
        const snappedAngle = Math.round(angle / step) * step
        const len = Math.hypot(world.x - other.x, world.y - other.y)
        end = { x: other.x + Math.cos(snappedAngle) * len, y: other.y + Math.sin(snappedAngle) * len }
      }
      const next: LineElement =
        ia.handle === "line-start"
          ? { ...el, x1: end.x, y1: end.y }
          : { ...el, x2: end.x, y2: end.y }
      return [next]
    }
    if (el.type === "stroke")
      return [scaleFromHandle(el, ia.handle, world, e.shiftKey, e.altKey)]
    if (el.type === "line") return null
    return [resizeBox(el, ia.handle, world, opts)]
  }

  const b = unionBounds(ia.originals)
  if (!b) return null
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  const anchor = e.altKey ? center : boundsFixedAnchor(b, ia.handle)
  const { ax, ay } = handleToAnchor(ia.handle)
  const origX = ax === -1 ? b.x : ax === 1 ? b.x + b.width : b.x + b.width / 2
  const origY = ay === -1 ? b.y : ay === 1 ? b.y + b.height : b.y + b.height / 2
  let sx = ax !== 0 ? (world.x - anchor.x) / (origX - anchor.x || 1) : 1
  let sy = ay !== 0 ? (world.y - anchor.y) / (origY - anchor.y || 1) : 1
  if (e.shiftKey) {
    const s = (Math.abs(sx) + Math.abs(sy)) / 2 || 1
    sx = sx < 0 ? -s : s
    sy = sy < 0 ? -s : s
  }
  const map = new Map(ia.originals.map((el) => [el.id, el]))
  return ia.originals.map((el) => {
    const base = map.get(el.id)
    return base ? scaleElementAbout(base, anchor, sx, sy) : el
  })
}

function applyResize(
  ia: Extract<Interaction, { mode: "resize" }>,
  world: Point,
  e: ReactPointerEvent,
  snapped: boolean
) {
  const next = resizeSelection(ia, world, e, snapped)
  if (!next) return
  useDoc.getState().updateElements(
    next.map((el) => el.id),
    (el) => next.find((n) => n.id === el.id) ?? el
  )
}

/** Visual position of the point a handle drags: corner for corner grips, edge midpoint for edge grips. */
function gripPointForHandle(
  b: { x: number; y: number; width: number; height: number },
  handle: string
): Point {
  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  switch (handle) {
    case "nw":
      return { x: b.x, y: b.y }
    case "n":
      return { x: cx, y: b.y }
    case "ne":
      return { x: b.x + b.width, y: b.y }
    case "e":
      return { x: b.x + b.width, y: cy }
    case "se":
      return { x: b.x + b.width, y: b.y + b.height }
    case "s":
      return { x: cx, y: b.y + b.height }
    case "sw":
      return { x: b.x, y: b.y + b.height }
    case "w":
      return { x: b.x, y: cy }
    default:
      return { x: cx, y: cy }
  }
}

/**
 * The visual point a resize handle moves, used as the snap candidate. Snapping
 * this point translates into an exact pointer nudge for the whole box. For a
 * rotated box the handle sits on the rotated bounds, so the local grip point is
 * rotated about the element center to match what the user sees.
 */
function gripCandidates(preview: Element[], handle: string): Point[] {
  if (preview.length === 1) {
    const el = preview[0]
    if (el.type === "line" || el.type === "stroke") return []
    const b = getBounds(el)
    const local = gripPointForHandle(b, handle)
    const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    return [rotatePoint(local, center, b.rotation * DEG)]
  }
  const b = unionBounds(preview)
  return b ? [gripPointForHandle(b, handle)] : []
}

function applyRotate(
  ia: Extract<Interaction, { mode: "rotate" }>,
  world: Point,
  shift: boolean,
  alt: boolean
) {
  const angleNow = Math.atan2(world.y - ia.center.y, world.x - ia.center.x)
  const delta = angleNow - ia.startAngle
  const step = Math.PI / 12
  // Gentle 15° snapping by default; Shift snaps hard, Alt rotates freely.
  const snappedDelta = alt ? delta : snapRotation(delta, shift ? 0 : step * 0.25, step)
  const map = new Map(ia.originals.map((el) => [el.id, el]))
  const ids = ia.originals.map((el) => el.id)
  if (ia.originals.length === 1) {
    const el = ia.originals[0]
    const center = elementCenter(el)
    // Snap the element's absolute orientation, not the drag delta, so the
    // handle visually lands on 15° multiples of the element itself.
    const target = el.rotation * DEG + snappedDelta
    const snapped = alt ? target : snapRotation(target, shift ? 0 : step * 0.25, step)
    useDoc
      .getState()
      .updateElements(ids, () => rotateElementAbout(el, center, snapped - el.rotation * DEG))
    return
  }
  useDoc.getState().updateElements(ids, (el) => {
    const base = map.get(el.id) ?? el
    return rotateElementAbout(base, ia.center, snappedDelta)
  })
}

/** Snap an angle to `step` multiples when within `tolerance`; 0 tolerance = hard snap. */
function snapRotation(angle: number, tolerance: number, step: number): number {
  const snapped = Math.round(angle / step) * step
  if (tolerance <= 0) return snapped
  return Math.abs(snapped - angle) <= tolerance ? snapped : angle
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable
}

function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-6 py-4 text-center text-sm text-muted-foreground backdrop-blur-sm">
        Pick a tool on the right, then draw on the canvas.
        <br />
        Drag to draw · Space or middle-mouse to pan · Scroll to zoom · Hold Alt to disable snapping
      </div>
    </div>
  )
}
