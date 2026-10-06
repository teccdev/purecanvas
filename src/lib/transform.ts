import type { Element, StrokeElement, TextElement } from "./types"
import { DEG, rotatePoint, type Point } from "./geometry"

export function translateElement(el: Element, dx: number, dy: number): Element {
  if (el.type === "line") {
    return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy, x: el.x + dx, y: el.y + dy }
  }
  if (el.type === "stroke") {
    return {
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      points: el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    }
  }
  return { ...el, x: el.x + dx, y: el.y + dy }
}

export function rotateElementAbout(el: Element, pivot: Point, angle: number): Element {
  if (el.type === "line") {
    const a = rotatePoint({ x: el.x1, y: el.y1 }, pivot, angle)
    const b = rotatePoint({ x: el.x2, y: el.y2 }, pivot, angle)
    return { ...el, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  }
  if (el.type === "stroke") {
    return {
      ...el,
      points: el.points.map((p) => rotatePoint(p, pivot, angle)),
    }
  }
  const center = { x: el.x + el.width / 2, y: el.y + el.height / 2 }
  const nc = rotatePoint(center, pivot, angle)
  return {
    ...el,
    x: nc.x - el.width / 2,
    y: nc.y - el.height / 2,
    rotation: el.rotation + angle / DEG,
  }
}

export function scaleElementAbout(
  el: Element,
  anchor: Point,
  sx: number,
  sy: number
): Element {
  if (el.type === "line") {
    return {
      ...el,
      x1: anchor.x + (el.x1 - anchor.x) * sx,
      y1: anchor.y + (el.y1 - anchor.y) * sy,
      x2: anchor.x + (el.x2 - anchor.x) * sx,
      y2: anchor.y + (el.y2 - anchor.y) * sy,
    }
  }
  if (el.type === "stroke") {
    const s: StrokeElement = {
      ...el,
      points: el.points.map((p) => ({
        ...p,
        x: anchor.x + (p.x - anchor.x) * sx,
        y: anchor.y + (p.y - anchor.y) * sy,
      })),
    }
    return s
  }
  const bx = anchor.x + (el.x - anchor.x) * sx
  const by = anchor.y + (el.y - anchor.y) * sy
  const bw = Math.max(1, el.width * sx)
  const bh = Math.max(1, el.height * sy)
  if (el.type === "text") {
    return {
      ...el,
      x: bx,
      y: by,
      width: bw,
      height: bh,
      fontSize: Math.max(2, el.fontSize * Math.max(Math.abs(sx), Math.abs(sy))),
    }
  }
  return { ...el, x: bx, y: by, width: bw, height: bh }
}

export interface HandleAnchor {
  ax: -1 | 0 | 1
  ay: -1 | 0 | 1
}

export function handleToAnchor(handle: string): HandleAnchor {
  const ax: -1 | 0 | 1 = handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0
  const ay: -1 | 0 | 1 = handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0
  return { ax, ay }
}

const MIN_SIZE = 4

/**
 * Resize a single rotation-aware box element by dragging a handle.
 */
export function resizeBox(
  el: TextElement | Extract<Element, { type: "shape" | "image" | "icon" }>,
  handle: string,
  pointer: Point,
  opts: { shift: boolean; alt: boolean }
): Element {
  const w0 = el.width
  const h0 = el.height
  const cx0 = el.x + w0 / 2
  const cy0 = el.y + h0 / 2
  const theta = el.rotation * DEG
  const center: Point = { x: cx0, y: cy0 }
  const p = rotatePoint(pointer, center, -theta)

  const { ax, ay } = handleToAnchor(handle)
  const left = el.x
  const right = el.x + w0
  const top = el.y
  const bottom = el.y + h0

  let newLeft = left
  let newRight = right
  let newTop = top
  let newBottom = bottom

  if (ax !== 0) {
    if (ax === 1) newRight = Math.max(left + MIN_SIZE, p.x)
    else newLeft = Math.min(right - MIN_SIZE, p.x)
  }
  if (ay !== 0) {
    if (ay === 1) newBottom = Math.max(top + MIN_SIZE, p.y)
    else newTop = Math.min(bottom - MIN_SIZE, p.y)
  }

  if (opts.alt && ax !== 0 && ay !== 0) {
    const dx = Math.abs(p.x - cx0)
    const dy = Math.abs(p.y - cy0)
    newLeft = cx0 - dx
    newRight = cx0 + dx
    newTop = cy0 - dy
    newBottom = cy0 + dy
  }

  let w = Math.max(MIN_SIZE, newRight - newLeft)
  let h = Math.max(MIN_SIZE, newBottom - newTop)

  const uniform = el.type === "text" || (opts.shift && ax !== 0 && ay !== 0)
  if (uniform) {
    let s = 1
    if (ax !== 0 && ay !== 0) s = Math.max(w / w0, h / h0)
    else if (ax !== 0) s = w / w0
    else if (ay !== 0) s = h / h0
    w = Math.max(MIN_SIZE, w0 * s)
    h = Math.max(MIN_SIZE, h0 * s)
    if (ax === 1) newLeft = right - w
    else if (ax === -1) newLeft = left
    else newLeft = cx0 - w / 2
    if (ay === 1) newTop = bottom - h
    else if (ay === -1) newTop = top
    else newTop = cy0 - h / 2
    newRight = newLeft + w
    newBottom = newTop + h
  } else {
    if (ax === 0) {
      newLeft = cx0 - w / 2
      newRight = cx0 + w / 2
    }
    if (ay === 0) {
      newTop = cy0 - h / 2
      newBottom = cy0 + h / 2
    }
  }

  const axisCenter: Point = { x: (newLeft + newRight) / 2, y: (newTop + newBottom) / 2 }
  const worldCenter = rotatePoint(axisCenter, center, theta)

  const result: Record<string, unknown> = {
    x: worldCenter.x - w / 2,
    y: worldCenter.y - h / 2,
    width: w,
    height: h,
  }
  if (el.type === "text") {
    result.fontSize = Math.max(2, el.fontSize * Math.max(w / w0, h / h0))
  }
  return { ...el, ...result } as Element
}

export function boundsFixedAnchor(
  bounds: { x: number; y: number; width: number; height: number },
  handle: string
): Point {
  const { ax, ay } = handleToAnchor(handle)
  const { x, y, width, height } = bounds
  return {
    x: ax === -1 ? x + width : ax === 1 ? x : x + width / 2,
    y: ay === -1 ? y + height : ay === 1 ? y : y + height / 2,
  }
}
