import type { Bounds, Camera, Element, LineElement, StrokeElement } from "./types"

export interface Point {
  x: number
  y: number
}

export const DEG = Math.PI / 180

export function rotatePoint(p: Point, origin: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

export function elementCenter(el: Element): Point {
  if (el.type === "line") {
    return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 }
  }
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 }
}

export function getBounds(el: Element): Bounds {
  if (el.type === "line") {
    const x = Math.min(el.x1, el.x2)
    const y = Math.min(el.y1, el.y2)
    return {
      x,
      y,
      width: Math.abs(el.x2 - el.x1),
      height: Math.abs(el.y2 - el.y1),
      rotation: 0,
    }
  }
  if (el.type === "stroke") {
    // Derive from points so bounds never go stale after transforms.
    return boundsOfPoints(el.points)
  }
  return { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation }
}

export function boundsCorners(b: Bounds): Point[] {
  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  const angle = b.rotation * DEG
  const pts: Point[] = [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ]
  return pts.map((p) => rotatePoint(p, { x: cx, y: cy }, angle))
}

export function boundsOfPoints(points: Point[]): Bounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0, rotation: 0 }
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
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: 0 }
}

/** Axis-aligned world bounding box of a set of elements. */
export function unionBounds(elements: Element[]): Bounds | null {
  if (elements.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of elements) {
    for (const c of boundsCorners(getBounds(el))) {
      minX = Math.min(minX, c.x)
      minY = Math.min(minY, c.y)
      maxX = Math.max(maxX, c.x)
      maxY = Math.max(maxY, c.y)
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: 0 }
}

export function screenToWorld(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) / cam.zoom, y: (p.y - cam.y) / cam.zoom }
}

export function worldToScreen(p: Point, cam: Camera): Point {
  return { x: p.x * cam.zoom + cam.x, y: p.y * cam.zoom + cam.y }
}

export function rectsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function pointInBounds(p: Point, b: Bounds): boolean {
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height
}

export function pointInElement(p: Point, el: Element): boolean {
  if (el.type === "line") {
    return pointNearSegment(p, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }, el.strokeWidth / 2 + 6)
  }
  if (el.type === "stroke") {
    return pointNearPolyline(p, el.points, el.strokeWidth / 2 + 6)
  }
  const b = getBounds(el)
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  const local = rotatePoint(p, center, -b.rotation * DEG)
  return pointInBounds(local, b)
}

export function pointNearSegment(p: Point, a: Point, b: Point, tolerance: number): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.hypot(p.x - projX, p.y - projY) <= tolerance
}

export function pointNearPolyline(p: Point, points: Point[], tolerance: number): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (pointNearSegment(p, points[i], points[i + 1], tolerance)) return true
  }
  if (points.length === 1) {
    return Math.hypot(p.x - points[0].x, p.y - points[0].y) <= tolerance
  }
  return false
}

/** Scale a line's endpoints about a fixed anchor. */
export function scaleLine(line: LineElement, anchor: Point, sx: number, sy: number): LineElement {
  return {
    ...line,
    x1: anchor.x + (line.x1 - anchor.x) * sx,
    y1: anchor.y + (line.y1 - anchor.y) * sy,
    x2: anchor.x + (line.x2 - anchor.x) * sx,
    y2: anchor.y + (line.y2 - anchor.y) * sy,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }
}

export function scaleStroke(stroke: StrokeElement, anchor: Point, sx: number, sy: number): StrokeElement {
  return {
    ...stroke,
    points: stroke.points.map((p) => ({
      ...p,
      x: anchor.x + (p.x - anchor.x) * sx,
      y: anchor.y + (p.y - anchor.y) * sy,
    })),
  }
}

/** Simplify a polyline using Ramer–Douglas–Peucker. */
export function simplifyPoints(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points
  const sqTolerance = tolerance * tolerance

  function getSqSegDist(p: Point, a: Point, b: Point): number {
    let x = a.x
    let y = a.y
    let dx = b.x - x
    let dy = b.y - y
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) {
        x = b.x
        y = b.y
      } else if (t > 0) {
        x += dx * t
        y += dy * t
      }
    }
    dx = p.x - x
    dy = p.y - y
    return dx * dx + dy * dy
  }

  function simplifyDPStep(pts: Point[], first: number, last: number, simplified: Point[]) {
    let maxSqDist = sqTolerance
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(pts[i], pts[first], pts[last])
      if (sqDist > maxSqDist) {
        index = i
        maxSqDist = sqDist
      }
    }
    if (index !== -1) {
      if (index - first > 1) simplifyDPStep(pts, first, index, simplified)
      simplified.push(pts[index])
      if (last - index > 1) simplifyDPStep(pts, index, last, simplified)
    }
  }

  const simplified: Point[] = [points[0]]
  simplifyDPStep(points, 0, points.length - 1, simplified)
  simplified.push(points[points.length - 1])
  return simplified
}

/** Build a smooth SVG path from points using Catmull-Rom → Bézier conversion. */
export function catmullRomPath(points: Point[]): string {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y}`
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }
  return d
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
