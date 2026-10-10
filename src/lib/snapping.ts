import { boundsCorners, getBounds, type Point } from "./geometry"
import type { Element } from "./types"

/** World spacing of the visible dot grid at a given zoom. */
export function gridSpacing(zoom: number): number {
  let spacing = 32
  while (spacing * zoom < 14) spacing *= 2
  while (spacing * zoom > 72) spacing /= 2
  return spacing
}

export interface SnapTargets {
  /** Snap candidate points: element corners, edge midpoints, centers, endpoints, intersections. */
  points: Point[]
  /** Line segments the pointer can snap onto (anywhere along them). */
  segments: Array<[Point, Point]>
}

const EPS = 1e-9

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function segmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d1x = a2.x - a1.x
  const d1y = a2.y - a1.y
  const d2x = b2.x - b1.x
  const d2y = b2.y - b1.y
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < EPS) return null
  const rx = b1.x - a1.x
  const ry = b1.y - a1.y
  const t = (rx * d2y - ry * d2x) / denom
  const u = (rx * d1y - ry * d1x) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a1.x + d1x * t, y: a1.y + d1y * t }
}

function projectToSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return a
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return { x: a.x + dx * t, y: a.y + dy * t }
}

/** Nearest visible dot-grid intersection to a world point. */
function nearestGridPoint(p: Point, spacing: number): Point {
  return {
    x: Math.round(p.x / spacing) * spacing,
    y: Math.round(p.y / spacing) * spacing,
  }
}

/** Collect snap geometry from the scene, ignoring hidden and excluded elements. */
export function collectSnapTargets(elements: Element[], excludeIds: Set<string>): SnapTargets {
  const points: Point[] = []
  const segments: Array<[Point, Point]> = []
  const lineSegments: Array<[Point, Point]> = []

  for (const el of elements) {
    if (el.hidden || excludeIds.has(el.id)) continue
    if (el.type === "line") {
      const a = { x: el.x1, y: el.y1 }
      const b = { x: el.x2, y: el.y2 }
      points.push(a, b)
      segments.push([a, b])
      lineSegments.push([a, b])
    } else if (el.type === "stroke") {
      const pts = el.points
      if (pts.length > 0) {
        points.push(pts[0], pts[pts.length - 1])
      }
    } else {
      const corners = boundsCorners(getBounds(el))
      points.push(
        ...corners,
        mid(corners[0], corners[1]),
        mid(corners[1], corners[2]),
        mid(corners[2], corners[3]),
        mid(corners[3], corners[0]),
        mid(corners[0], corners[2])
      )
    }
  }

  // Intersections between line elements.
  for (let i = 0; i < lineSegments.length; i++) {
    for (let j = i + 1; j < lineSegments.length; j++) {
      const p = segmentIntersection(
        lineSegments[i][0],
        lineSegments[i][1],
        lineSegments[j][0],
        lineSegments[j][1]
      )
      if (p) points.push(p)
    }
  }

  return { points, segments }
}

export interface SnapResult {
  /** Offset to apply to the candidate points. */
  dx: number
  dy: number
  /** Exact point snapped to (point/grid/endpoint/intersection snap). */
  point: Point | null
  /** World x of an alignment guide, if snapped on the x axis only. */
  xLine: number | null
  /** World y of an alignment guide, if snapped on the y axis only. */
  yLine: number | null
}

/**
 * Find the gentlest snap for a set of candidate points against targets and the
 * visible grid. Prefers exact point snaps, then per-axis alignment.
 * `threshold` is in world units.
 */
export function snapOffset(
  candidates: Point[],
  targets: SnapTargets,
  spacing: number,
  threshold: number
): SnapResult | null {
  const best: {
    two: { dx: number; dy: number; dist: number; point: Point } | null
    x: { dx: number; x: number } | null
    y: { dy: number; y: number } | null
  } = { two: null, x: null, y: null }

  const consider = (c: Point, t: Point, allow2d: boolean) => {
    const dx = t.x - c.x
    const dy = t.y - c.y
    if (allow2d) {
      const dist = Math.hypot(dx, dy)
      if (dist <= threshold && (!best.two || dist < best.two.dist)) {
        best.two = { dx, dy, dist, point: t }
      }
    }
    if (Math.abs(dx) <= threshold && Math.abs(dx) > EPS) {
      if (!best.x || Math.abs(dx) < Math.abs(best.x.dx)) best.x = { dx, x: t.x }
    }
    if (Math.abs(dy) <= threshold && Math.abs(dy) > EPS) {
      if (!best.y || Math.abs(dy) < Math.abs(best.y.dy)) best.y = { dy, y: t.y }
    }
  }

  for (const c of candidates) {
    const grid = nearestGridPoint(c, spacing)
    for (const t of targets.points) consider(c, t, true)
    consider(c, grid, true)
    for (const seg of targets.segments) {
      consider(c, projectToSegment(c, seg[0], seg[1]), true)
    }
  }

  if (best.two) {
    return {
      dx: best.two.dx,
      dy: best.two.dy,
      point: best.two.point,
      xLine: null,
      yLine: null,
    }
  }
  if (best.x || best.y) {
    return {
      dx: best.x ? best.x.dx : 0,
      dy: best.y ? best.y.dy : 0,
      point: null,
      xLine: best.x ? best.x.x : null,
      yLine: best.y ? best.y.y : null,
    }
  }
  return null
}
