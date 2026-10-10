export type ElementType = "text" | "image" | "line" | "shape" | "icon" | "stroke"

export interface Shadow {
  /** Shadow color (hex or rgba). */
  color: string
  /** Blur radius in world units. */
  blur: number
  /** Horizontal offset in world units. */
  offsetX: number
  /** Vertical offset in world units. */
  offsetY: number
  /** Shadow opacity, 0-1. */
  opacity: number
}

export interface ElementBase {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  name?: string
  hidden?: boolean
  locked?: boolean
  /** Drop shadow. Rendered for every type except freehand strokes. */
  shadow?: Shadow | null
  /** Shared id of a group. Members select, move, and export together. */
  groupId?: string
  /** Display name, kept in sync across members of `groupId`. */
  groupName?: string
}

export interface TextElement extends ElementBase {
  type: "text"
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  align: "left" | "center" | "right"
  lineHeight: number
  /** Outline color. Unused when `strokeWidth` is 0 or omitted. */
  stroke?: string
  strokeWidth?: number
}

export interface ImageElement extends ElementBase {
  type: "image"
  assetId: string
  naturalWidth: number
  naturalHeight: number
  radius: number
  /** Outline color. Unused when `strokeWidth` is 0 or omitted. */
  stroke?: string
  strokeWidth?: number
}

export interface LineElement extends ElementBase {
  type: "line"
  x1: number
  y1: number
  x2: number
  y2: number
  strokeWidth: number
  color: string
  arrowStart: boolean
  arrowEnd: boolean
  /** Round line caps; older lines without the field default to round. */
  rounded?: boolean
}

export type ShapeKind =
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "star"
  | "hexagon"

export interface GradientStop {
  /** Position along the gradient, 0-1. */
  offset: number
  color: string
}

export type GradientType = "linear" | "radial"

export interface GradientFill {
  type: GradientType
  /** Linear gradient direction in degrees (0 = left→right, 90 = top→bottom). */
  angle: number
  stops: GradientStop[]
}

export interface ShapeElement extends ElementBase {
  type: "shape"
  shape: ShapeKind
  fill: string
  /** When set and `filled`, paints the shape with a gradient instead of `fill`. */
  gradient?: GradientFill | null
  stroke: string
  strokeWidth: number
  filled: boolean
  radius: number
}

export type IconLib = "lucide" | "material"

export interface IconElement extends ElementBase {
  type: "icon"
  lib: IconLib
  name: string
  color: string
  strokeWidth: number
  /** Solid fill. Omitted means stroke-only (Lucide) or unfilled Material. */
  filled?: boolean
  fill?: string
  /**
   * Round stroke caps/joins for Lucide, or the rounded Material style.
   * Omitted keeps the library default (round Lucide, outlined Material).
   */
  rounded?: boolean
}

export interface StrokePoint {
  x: number
  y: number
  pressure?: number
}

export interface StrokeElement extends ElementBase {
  type: "stroke"
  points: StrokePoint[]
  color: string
  strokeWidth: number
  variant: "pen" | "highlighter"
}

export type Element =
  | TextElement
  | ImageElement
  | LineElement
  | ShapeElement
  | IconElement
  | StrokeElement

export interface Camera {
  x: number
  y: number
  zoom: number
}

export type Tool =
  | "select"
  | "text"
  | "image"
  | "line"
  | "shape"
  | "icon"
  | "pen"

export type PenVariant = "pen" | "highlighter" | "eraser"

export interface ProjectRecord {
  id: string
  name: string
  elements: Element[]
  camera: Camera
  createdAt: number
  updatedAt: number
}

export interface AssetRecord {
  id: string
  projectId: string
  name: string
  type: string
  blob: Blob
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}
