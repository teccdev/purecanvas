import type { GradientFill, GradientType } from "./types"

/** Stable SVG paint-server id for an element's gradient. */
export function gradientId(elementId: string): string {
  return `grad-${elementId}`
}

/**
 * Endpoints for an SVG linearGradient in objectBoundingBox units, derived from
 * a direction in degrees (0 = left→right, 90 = top→bottom, y pointing down).
 */
export function linearGradientCoords(angle: number): {
  x1: number
  y1: number
  x2: number
  y2: number
} {
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad) / 2
  const dy = Math.sin(rad) / 2
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy }
}

/** CSS background value that mirrors the SVG rendering, for previews. */
export function gradientCss(g: GradientFill): string {
  const stops = [...g.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(", ")
  if (g.type === "radial") return `radial-gradient(circle, ${stops})`
  // CSS 0deg points up; SVG 0deg points right, so shift by 90deg.
  return `linear-gradient(${g.angle + 90}deg, ${stops})`
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

/** Blend `hex` toward `target` by `amount` (0-1). Falls back to `hex` if unparsable. */
export function mixColor(hex: string, target: string, amount: number): string {
  const a = parseHex(hex)
  const b = parseHex(target)
  if (!a || !b) return hex
  const t = Math.max(0, Math.min(1, amount))
  return toHex([
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ])
}

/** A pleasant two-stop gradient derived from a base fill color. */
export function defaultGradient(type: GradientType, base: string): GradientFill {
  return {
    type,
    angle: 90,
    stops: [
      { offset: 0, color: mixColor(base, "#ffffff", 0.35) },
      { offset: 1, color: mixColor(base, "#000000", 0.25) },
    ],
  }
}

export function makeStopColor(base: string): string {
  return mixColor(base, "#ffffff", 0.2)
}
