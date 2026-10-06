export type ElementType = "text" | "image" | "line" | "shape" | "icon" | "stroke"

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
}

export interface ImageElement extends ElementBase {
  type: "image"
  assetId: string
  naturalWidth: number
  naturalHeight: number
  radius: number
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
}

export type ShapeKind =
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "star"
  | "hexagon"

export interface ShapeElement extends ElementBase {
  type: "shape"
  shape: ShapeKind
  fill: string
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
