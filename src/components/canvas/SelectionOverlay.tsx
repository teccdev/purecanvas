import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import type { Bounds } from "@/lib/types"
import type { Point } from "@/lib/geometry"
import { boundsCorners, getBounds, unionBounds, worldToScreen } from "@/lib/geometry"

export type HandleId =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rot"
  | "line-start"
  | "line-end"

const HANDLE_ORDER: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function normal(toward: Point, from: Point): Point {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

export function SelectionOverlay() {
  const elements = useDoc((s) => s.elements)
  const camera = useDoc((s) => s.camera)
  const selectedIds = useUI((s) => s.selectedIds)
  const editingTextId = useUI((s) => s.editingTextId)

  const selected = elements.filter((e) => selectedIds.includes(e.id) && !e.hidden)
  if (selected.length === 0) return null

  const isSingle = selected.length === 1
  const single = isSingle ? selected[0] : null
  const bounds: Bounds =
    single && single.type !== "line" && single.type !== "stroke"
      ? getBounds(single)
      : (unionBounds(selected) as Bounds)

  const toPoly = (b: Bounds) =>
    boundsCorners(b)
      .map((p) => worldToScreen(p, camera))
      .map((p) => `${p.x},${p.y}`)
      .join(" ")

  const corners = boundsCorners(bounds)
  const screenCorners = corners.map((p) => worldToScreen(p, camera))
  const polyPoints = screenCorners.map((p) => `${p.x},${p.y}`).join(" ")

  const centerWorld = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const topMidWorld = mid(corners[0], corners[1])
  const dir = normal(topMidWorld, centerWorld)
  const topMidScreen = worldToScreen(topMidWorld, camera)
  const rotHandle = { x: topMidScreen.x + dir.x * 30, y: topMidScreen.y + dir.y * 30 }

  const edges: Record<HandleId, Point> = {
    nw: screenCorners[0],
    n: mid(screenCorners[0], screenCorners[1]),
    ne: screenCorners[1],
    e: mid(screenCorners[1], screenCorners[2]),
    se: screenCorners[2],
    s: mid(screenCorners[2], screenCorners[3]),
    sw: screenCorners[3],
    w: mid(screenCorners[3], screenCorners[0]),
    rot: rotHandle,
    "line-start": { x: 0, y: 0 },
    "line-end": { x: 0, y: 0 },
  }

  const isLine = single?.type === "line"
  const isStroke = single?.type === "stroke"
  const showGrips = !isLine && editingTextId !== single?.id

  const lineStart = isLine ? worldToScreen({ x: single.x1, y: single.y1 }, camera) : null
  const lineEnd = isLine ? worldToScreen({ x: single.x2, y: single.y2 }, camera) : null

  return (
    <g id="selection-overlay" pointerEvents="none">
      {!isSingle &&
        selected.map((el) => (
          <polygon
            key={el.id}
            points={toPoly(getBounds(el))}
            fill="none"
            stroke="var(--ring)"
            strokeWidth={1}
            opacity={0.7}
          />
        ))}
      <polygon
        points={polyPoints}
        fill="none"
        stroke="var(--ring)"
        strokeWidth={1.5}
        strokeDasharray={isStroke ? "4 4" : undefined}
      />
      {isLine && lineStart && lineEnd && (
        <>
          <line
            x1={lineStart.x}
            y1={lineStart.y}
            x2={lineEnd.x}
            y2={lineEnd.y}
            stroke="var(--ring)"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />
          {(["line-start", "line-end"] as const).map((h, i) => {
            const p = i === 0 ? lineStart : lineEnd
            return (
              <g key={h} pointerEvents="all" data-handle={h} style={{ cursor: "crosshair" }}>
                <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill="var(--background)"
                  stroke="var(--ring)"
                  strokeWidth={1.5}
                />
              </g>
            )
          })}
        </>
      )}
      {showGrips &&
        HANDLE_ORDER.map((h) => {
          const p = edges[h]
          return (
            <g key={h} pointerEvents="all" data-handle={h} style={{ cursor: cursorFor(h) }}>
              <rect
                x={p.x - 7}
                y={p.y - 7}
                width={14}
                height={14}
                fill="transparent"
              />
              <rect
                x={p.x - 4}
                y={p.y - 4}
                width={8}
                height={8}
                rx={1.5}
                fill="var(--background)"
                stroke="var(--ring)"
                strokeWidth={1.5}
              />
            </g>
          )
        })}
      {showGrips && (
        <>
          <line
            x1={topMidScreen.x}
            y1={topMidScreen.y}
            x2={rotHandle.x}
            y2={rotHandle.y}
            stroke="var(--ring)"
            strokeWidth={1.5}
          />
          <g pointerEvents="all" data-handle="rot" style={{ cursor: "grab" }}>
            <circle cx={rotHandle.x} cy={rotHandle.y} r={14} fill="transparent" />
            <circle
              cx={rotHandle.x}
              cy={rotHandle.y}
              r={6}
              fill="var(--background)"
              stroke="var(--ring)"
              strokeWidth={1.5}
            />
          </g>
        </>
      )}
    </g>
  )
}

function cursorFor(h: HandleId): string {
  switch (h) {
    case "n":
    case "s":
      return "ns-resize"
    case "e":
    case "w":
      return "ew-resize"
    case "ne":
    case "sw":
      return "nesw-resize"
    case "nw":
    case "se":
      return "nwse-resize"
    default:
      return "default"
  }
}
