import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import type {
  Camera,
  Element,
  LineElement,
  ShapeElement,
  StrokeElement,
  StrokePoint,
  TextElement,
} from "@/lib/types"
import {
  DEG,
  clamp,
  elementCenter,
  getBounds,
  pointInElement,
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
import { createImageElement } from "@/lib/assets"
import { ElementView } from "./ElementView"
import { SelectionOverlay } from "./SelectionOverlay"
import { DotGridBackground } from "./DotGridBackground"
import { TextEditor } from "./TextEditor"
import { registerSceneRoot } from "@/lib/exporter"

type Interaction =
  | { mode: "pan"; startClient: Point; startCam: Camera }
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

export function Canvas() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const interaction = useRef<Interaction | null>(null)
  const marqueeRef = useRef<{ start: Point; end: Point } | null>(null)

  const elements = useDoc((s) => s.elements)
  const camera = useDoc((s) => s.camera)
  const tool = useUI((s) => s.tool)
  const selectedIds = useUI((s) => s.selectedIds)
  const zoomRequest = useUI((s) => s.zoomRequest)

  const [draft, setDraft] = useState<Element | null>(null)
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)

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

  // Space key pans.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isEditableTarget(e.target)) setSpaceDown(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  // Wheel: zoom with ctrl/meta, otherwise pan.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const cam = useDoc.getState().camera
      if (e.ctrlKey || e.metaKey) {
        const screen = getScreen(e)
        const world = screenToWorld(screen, cam)
        const factor = Math.exp(-e.deltaY * 0.0015)
        const zoom = clamp(cam.zoom * factor, 0.05, 8)
        useDoc
          .getState()
          .setCamera({ zoom, x: screen.x - world.x * zoom, y: screen.y - world.y * zoom })
      } else {
        useDoc.getState().setCamera({ x: cam.x - e.deltaX, y: cam.y - e.deltaY })
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
      addElements([el])
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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
      for (const file of files) {
        const world = getWorld({ clientX: e.clientX, clientY: e.clientY })
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

      if (e.button === 1 || spaceDown) {
        interaction.current = {
          mode: "pan",
          startClient: { x: e.clientX, y: e.clientY },
          startCam: useDoc.getState().camera,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
        return
      }
      if (e.button !== 0) return
      if (e.pointerType === "touch") e.preventDefault()

      const handleEl = target.closest?.("[data-handle]") as SVGElement | null
      const elementEl = target.closest?.("[data-element-id]") as SVGElement | null

      switch (ui.tool) {
        case "select": {
          if (handleEl?.dataset.handle) {
            startResizeOrRotate(handleEl.dataset.handle, world)
          } else if (elementEl?.dataset.elementId) {
            const id = elementEl.dataset.elementId
            const additive = e.shiftKey || e.metaKey || e.ctrlKey
            let ids = ui.selectedIds
            if (additive) {
              if (!ids.includes(id)) {
                ui.addToSelection([id])
                ids = [...ids, id]
              }
            } else if (!ids.includes(id)) {
              ui.setSelection([id])
              ids = [id]
            }
            const originals = useDoc
              .getState()
              .elements.filter((el) => ids.includes(el.id) && !el.locked)
              .map((el) => structuredClone(el))
            interaction.current = { mode: "move", startWorld: world, originals, pushed: false }
          } else {
            if (!e.shiftKey && !e.metaKey && !e.ctrlKey) ui.clearSelection()
            interaction.current = { mode: "marquee", startWorld: world, additive: e.shiftKey }
            marqueeRef.current = { start: world, end: world }
            setMarquee({ start: world, end: world })
          }
          break
        }
        case "shape": {
          interaction.current = { mode: "draw-shape", startWorld: world }
          setDraft(makeShapeDraft(world, world, false, ui.defaults))
          break
        }
        case "line": {
          interaction.current = { mode: "draw-line", startWorld: world }
          setDraft(makeLineDraft(world, world, false, ui.defaults))
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
          const el: TextElement = {
            id: uid(),
            type: "text",
            text: "",
            x: world.x,
            y: world.y,
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
          }
          useDoc.getState().addElements([el])
          useUI.getState().setTool("select")
          useUI.getState().setEditingText(el.id)
          return
        }
        case "icon": {
          const d = ui.defaults
          const size = 96
          const el: Element = {
            id: uid(),
            type: "icon",
            x: world.x - size / 2,
            y: world.y - size / 2,
            width: size,
            height: size,
            rotation: 0,
            opacity: 1,
            lib: d.iconLib,
            name: d.iconName,
            color: d.color,
            strokeWidth: d.iconStrokeWidth,
          }
          useDoc.getState().addElements([el])
          return
        }
        case "image": {
          fileInputRef.current?.click()
          return
        }
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [eraseAt, getWorld, spaceDown, startResizeOrRotate]
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const ia = interaction.current
      if (!ia) return
      const world = getWorld(e)

      switch (ia.mode) {
        case "pan": {
          const dx = e.clientX - ia.startClient.x
          const dy = e.clientY - ia.startClient.y
          useDoc.getState().setCamera({ x: ia.startCam.x + dx, y: ia.startCam.y + dy })
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
          const map = new Map(ia.originals.map((el) => [el.id, el]))
          useDoc.getState().updateElements(ia.originals.map((el) => el.id), (el) => {
            const base = map.get(el.id)
            return base ? translateElement(base, dx, dy) : el
          })
          break
        }
        case "resize": {
          if (!ia.pushed) {
            useDoc.getState().pushHistory()
            ia.pushed = true
          }
          applyResize(ia, world, e)
          break
        }
        case "rotate": {
          if (!ia.pushed) {
            useDoc.getState().pushHistory()
            ia.pushed = true
          }
          applyRotate(ia, world, e.shiftKey)
          break
        }
        case "draw-shape": {
          setDraft(makeShapeDraft(ia.startWorld, world, e.shiftKey, useUI.getState().defaults))
          break
        }
        case "draw-line": {
          setDraft(makeLineDraft(ia.startWorld, world, e.shiftKey, useUI.getState().defaults))
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
    [eraseAt, getWorld]
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

  const onPointerUp = useCallback(() => {
    const ia = interaction.current
    interaction.current = null
    const d = useUI.getState().defaults

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
          const ids = useDoc
            .getState()
            .elements.filter((el) => {
              if (el.hidden || el.locked) return false
              const eb = getBounds(el)
              return (
                eb.x < b.x + b.width &&
                eb.x + eb.width > b.x &&
                eb.y < b.y + b.height &&
                eb.y + eb.height > b.y
              )
            })
            .map((el) => el.id)
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
      setDraft(null)
    } else if (ia?.mode === "draw-line" && draft?.type === "line") {
      const line: LineElement = { ...draft, id: uid() }
      if (Math.hypot(line.x2 - line.x1, line.y2 - line.y1) < 4) {
        line.x2 = line.x1 + 160
        line.y2 = line.y1
      }
      useDoc.getState().addElements([line])
      setDraft(null)
    } else if (ia?.mode === "draw-pen" && draft?.type === "stroke") {
      finalizeStroke(ia.points, d)
      setDraft(null)
    } else {
      setDraft(null)
    }
  }, [draft, finalizeStroke])

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

  const cursor = spaceDown
    ? "grab"
    : tool === "select"
      ? "default"
      : tool === "text"
        ? "text"
        : "crosshair"

  return (
    <div
      className="relative size-full overflow-hidden"
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
      >
        <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
          <g ref={setSceneRoot}>
            {elements.map((el) => (
              <ElementView key={el.id} el={el} />
            ))}
            {draft && <ElementView el={draft} />}
          </g>
        </g>
        <SelectionOverlay />
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
    stroke: d.color,
    strokeWidth: d.strokeWidth,
    filled: d.filled,
    radius: d.cornerRadius,
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
  shift: boolean
): Element {
  const b = getBounds(el)
  const anchor = boundsFixedAnchor(b, handle)
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

function applyResize(
  ia: Extract<Interaction, { mode: "resize" }>,
  world: Point,
  e: ReactPointerEvent
) {
  const opts = { shift: e.shiftKey, alt: e.altKey }
  if (ia.originals.length === 1) {
    const el = ia.originals[0]
    if (el.type === "line" && (ia.handle === "line-start" || ia.handle === "line-end")) {
      const other = ia.handle === "line-start" ? { x: el.x2, y: el.y2 } : { x: el.x1, y: el.y1 }
      let end = world
      if (e.shiftKey) {
        const angle = Math.atan2(world.y - other.y, world.x - other.x)
        const step = Math.PI / 12
        const snapped = Math.round(angle / step) * step
        const len = Math.hypot(world.x - other.x, world.y - other.y)
        end = { x: other.x + Math.cos(snapped) * len, y: other.y + Math.sin(snapped) * len }
      }
      const next: LineElement =
        ia.handle === "line-start"
          ? { ...el, x1: end.x, y1: end.y }
          : { ...el, x2: end.x, y2: end.y }
      useDoc.getState().updateElements([el.id], () => next)
      return
    }
    if (el.type === "stroke") {
      useDoc.getState().updateElements([el.id], () => scaleFromHandle(el, ia.handle, world, e.shiftKey))
      return
    }
    if (el.type === "line") return
    useDoc
      .getState()
      .updateElements([el.id], () => resizeBox(el, ia.handle, world, opts))
    return
  }

  const b = unionBounds(ia.originals)
  if (!b) return
  const anchor = boundsFixedAnchor(b, ia.handle)
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
  useDoc.getState().updateElements(ia.originals.map((el) => el.id), (el) => {
    const base = map.get(el.id)
    return base ? scaleElementAbout(base, anchor, sx, sy) : el
  })
}

function applyRotate(
  ia: Extract<Interaction, { mode: "rotate" }>,
  world: Point,
  shift: boolean
) {
  const angleNow = Math.atan2(world.y - ia.center.y, world.x - ia.center.x)
  let delta = angleNow - ia.startAngle
  const step = Math.PI / 12
  if (shift) delta = Math.round(delta / step) * step
  const map = new Map(ia.originals.map((el) => [el.id, el]))
  const ids = ia.originals.map((el) => el.id)
  if (ia.originals.length === 1) {
    const el = ia.originals[0]
    const center = elementCenter(el)
    let a = delta
    if (shift) {
      const targetRot = Math.round((el.rotation * DEG + delta) / step) * step
      a = targetRot - el.rotation * DEG
    }
    useDoc.getState().updateElements(ids, () => rotateElementAbout(el, center, a))
    return
  }
  useDoc.getState().updateElements(ids, (el) => {
    const base = map.get(el.id) ?? el
    return rotateElementAbout(base, ia.center, delta)
  })
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
        Drag to draw · Space or middle-mouse to pan · Ctrl + scroll to zoom
      </div>
    </div>
  )
}
