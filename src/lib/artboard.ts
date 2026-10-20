import type { Artboard, Bounds, Element, SlideAxis } from "./types"
import { unionBounds } from "./geometry"

export const DEFAULT_ARTBOARD_WIDTH = 1920
export const DEFAULT_ARTBOARD_HEIGHT = 1080
export const MIN_ARTBOARD_SIZE = 1
export const MAX_ARTBOARD_SIZE = 20000
/** World-space gutter between slides in a strip. */
export const SLIDE_GAP = 64
export const MAX_SLIDES = 40

export interface ArtboardPreset {
  id: string
  label: string
  width: number
  height: number
}

/** Common canvas sizes offered in the canvas menu. */
export const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { id: "landscape", label: "Landscape", width: 1920, height: 1080 },
  { id: "square", label: "Square", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait", width: 1080, height: 1920 },
  { id: "slide", label: "Slide", width: 1280, height: 720 },
  { id: "uhd", label: "4K", width: 3840, height: 2160 },
  { id: "a4", label: "A4", width: 2480, height: 3508 },
]

/** Quick canvas fills offered in the canvas menu (`null` = theme surface). */
export const CANVAS_BACKGROUNDS: Array<{ value: string | null; label: string }> = [
  { value: null, label: "Theme" },
  { value: "#ffffff", label: "White" },
  { value: "#0a0a0a", label: "Black" },
  { value: "#f5f0e8", label: "Cream" },
  { value: "#e0e7ff", label: "Lavender" },
  { value: "#dcfce7", label: "Mint" },
  { value: "#fee2e2", label: "Blush" },
]

/** A disabled artboard of the default size, centered on a world point. */
export function makeArtboard(centerX = 0, centerY = 0): Artboard {
  return {
    enabled: false,
    x: centerX - DEFAULT_ARTBOARD_WIDTH / 2,
    y: centerY - DEFAULT_ARTBOARD_HEIGHT / 2,
    width: DEFAULT_ARTBOARD_WIDTH,
    height: DEFAULT_ARTBOARD_HEIGHT,
    background: null,
    slides: false,
    slideCount: 1,
    slideAxis: "horizontal",
  }
}

/** Fill in fields added after a project was first saved. */
export function normalizeArtboard(input?: Partial<Artboard> | null): Artboard {
  const base = makeArtboard()
  if (!input) return base
  const axis: SlideAxis = input.slideAxis === "vertical" ? "vertical" : "horizontal"
  return {
    enabled: Boolean(input.enabled),
    x: Number.isFinite(input.x) ? (input.x as number) : base.x,
    y: Number.isFinite(input.y) ? (input.y as number) : base.y,
    width: Number.isFinite(input.width) ? clampSize(input.width) : base.width,
    height: Number.isFinite(input.height) ? clampSize(input.height) : base.height,
    background:
      typeof input.background === "string" && input.background.trim()
        ? input.background
        : null,
    slides: Boolean(input.slides),
    slideCount: clampSlideCount(input.slideCount),
    slideAxis: axis,
  }
}

/** Clamp a dimension to a whole number of world pixels. */
export function clampSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return MIN_ARTBOARD_SIZE
  return Math.min(MAX_ARTBOARD_SIZE, Math.max(MIN_ARTBOARD_SIZE, Math.round(value!)))
}

export function clampSlideCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_SLIDES, Math.max(1, Math.round(value!)))
}

/** Number of frames in the strip (1 when slides are off). */
export function slideTotal(a: Artboard): number {
  return a.slides ? clampSlideCount(a.slideCount) : 1
}

/** Axis-aligned bounds of one slide. Slides flow from the artboard origin. */
export function slideFrame(a: Artboard, index: number): Bounds {
  const stepX = a.slideAxis === "horizontal" ? a.width + SLIDE_GAP : 0
  const stepY = a.slideAxis === "vertical" ? a.height + SLIDE_GAP : 0
  return {
    x: a.x + stepX * index,
    y: a.y + stepY * index,
    width: a.width,
    height: a.height,
    rotation: 0,
  }
}

/** World-space offset from one slide's origin to the next. */
export function slideStep(a: Artboard): { x: number; y: number } {
  return a.slideAxis === "horizontal"
    ? { x: a.width + SLIDE_GAP, y: 0 }
    : { x: 0, y: a.height + SLIDE_GAP }
}

/** Every frame in the strip, first slide first. */
export function slideFrames(a: Artboard): Bounds[] {
  return Array.from({ length: slideTotal(a) }, (_, i) => slideFrame(a, i))
}

/** Union of all frames, used to frame or fit the whole strip. */
export function stripBounds(a: Artboard): Bounds {
  const frames = slideFrames(a)
  const last = frames[frames.length - 1]
  return {
    x: a.x,
    y: a.y,
    width: last.x + last.width - a.x,
    height: last.y + last.height - a.y,
    rotation: 0,
  }
}

/**
 * Frames to show in the presenter. Without a canvas area, present the design's
 * own content bounds instead of a single letterboxed slide.
 */
export function presentFrames(elements: Element[], a: Artboard): Bounds[] {
  if (a.enabled) return slideFrames(a)
  const b = unionBounds(elements)
  if (!b) return [{ x: -480, y: -320, width: 960, height: 640, rotation: 0 }]
  const pad = 48
  return [
    {
      x: b.x - pad,
      y: b.y - pad,
      width: b.width + pad * 2,
      height: b.height + pad * 2,
      rotation: 0,
    },
  ]
}

/** Center of the content bounds, or the world origin when there is no content. */
export function contentCenter(elements: Element[]): { x: number; y: number } {
  const b = unionBounds(elements)
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : { x: 0, y: 0 }
}

/** Axis-aligned bounds of the artboard, for export framing. */
export function artboardBounds(a: Artboard): Bounds {
  return { x: a.x, y: a.y, width: a.width, height: a.height, rotation: 0 }
}

/** Id of the preset matching these exact dimensions, if any. */
export function matchPreset(width: number, height: number): string | null {
  return (
    ARTBOARD_PRESETS.find((p) => p.width === width && p.height === height)?.id ??
    null
  )
}
