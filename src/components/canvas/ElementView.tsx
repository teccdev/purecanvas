import { memo, useEffect, useState } from "react"
import { getLucideIcon, loadMaterialIcon, type MaterialIconData } from "@/lib/icons"
import { useAssetUrl } from "@/lib/imageCache"
import { catmullRomPath } from "@/lib/geometry"
import { gradientId, linearGradientCoords } from "@/lib/gradient"
import { shadowId } from "@/lib/shadow"
import { shapePath } from "@/lib/shapes"
import { fontString, wrapText } from "@/lib/text"
import type { Element, IconElement, ImageElement, LineElement, Shadow, ShapeElement, StrokeElement, TextElement } from "@/lib/types"
import { uid } from "@/lib/id"

/** Padding around an element's bounds so the shadow isn't clipped. */
function shadowExtent(shadow: Shadow): number {
  return shadow.blur * 3 + Math.max(Math.abs(shadow.offsetX), Math.abs(shadow.offsetY)) + 40
}

/**
 * Drop-shadow filter for an element. Uses userSpaceOnUse so the region can be
 * padded generously (objectBoundingBox collapses to zero height on flat lines).
 */
function ShadowFilter({ el }: { el: Element }) {
  const shadow = el.shadow
  if (!shadow) return null
  const pad = shadowExtent(shadow)
  const x = el.type === "line" ? Math.min(el.x1, el.x2) : 0
  const y = el.type === "line" ? Math.min(el.y1, el.y2) : 0
  const w = el.type === "line" ? Math.abs(el.x2 - el.x1) : el.width
  const h = el.type === "line" ? Math.abs(el.y2 - el.y1) : el.height
  return (
    <defs>
      <filter
        id={shadowId(el.id)}
        filterUnits="userSpaceOnUse"
        x={x - pad}
        y={y - pad}
        width={w + pad * 2}
        height={h + pad * 2}
        colorInterpolationFilters="sRGB"
      >
        <feDropShadow
          dx={shadow.offsetX}
          dy={shadow.offsetY}
          stdDeviation={shadow.blur * 0.5}
          floodColor={shadow.color}
          floodOpacity={shadow.opacity}
        />
      </filter>
    </defs>
  )
}

function MaterialIcon({ el }: { el: IconElement }) {
  const [data, setData] = useState<MaterialIconData | null>(null)
  const filled = el.filled === true
  const rounded = el.rounded === true
  useEffect(() => {
    let alive = true
    loadMaterialIcon(el.name, { filled, rounded }).then((d) => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
  }, [el.name, filled, rounded])
  if (!data) return null
  return (
    <svg
      x={0}
      y={0}
      width={el.width}
      height={el.height}
      viewBox={data.viewBox}
      fill={el.color}
      color={el.color}
      dangerouslySetInnerHTML={{ __html: data.inner }}
    />
  )
}

function IconView({ el }: { el: IconElement }) {
  if (el.lib === "material") return <MaterialIcon el={el} />
  const Icon = getLucideIcon(el.name)
  if (!Icon) return null
  // Lucide ships round caps/joins by default and its stroke icons are not
  // reliably stylable beyond fill/stroke, so only fill/stroke are exposed.
  const filled = el.filled === true
  return (
    <Icon
      x={0}
      y={0}
      width={el.width}
      height={el.height}
      color={el.color}
      stroke={el.strokeWidth > 0 ? el.color : "none"}
      fill={filled ? (el.fill || el.color) : "none"}
      strokeWidth={el.strokeWidth}
    />
  )
}

function TextView({ el, editing }: { el: TextElement; editing?: boolean }) {
  if (editing) return null
  const font = fontString(el.fontWeight, el.fontSize, el.fontFamily)
  const lines = el.text === "" ? [{ text: "", width: 0 }] : wrapText(el.text, font, el.width)
  const lineHeight = el.fontSize * el.lineHeight
  const outline = el.strokeWidth && el.strokeWidth > 0
  return (
    <text
      x={0}
      y={el.fontSize}
      fontFamily={`"${el.fontFamily}", sans-serif`}
      fontSize={el.fontSize}
      fontWeight={el.fontWeight}
      fill={el.color}
      stroke={outline ? el.stroke : "none"}
      // Stroke is centered; fill covers the inner half, so double it to match the control.
      strokeWidth={outline ? el.strokeWidth! * 2 : 0}
      strokeLinejoin="round"
      paintOrder="stroke fill"
      style={{ whiteSpace: "pre" }}
    >
      {lines.map((line, i) => {
        let x = 0
        if (el.align === "center") x = (el.width - line.width) / 2
        else if (el.align === "right") x = el.width - line.width
        return (
          <tspan key={i} x={x} y={el.fontSize + i * lineHeight}>
            {line.text || " "}
          </tspan>
        )
      })}
    </text>
  )
}

function LineView({ el }: { el: LineElement }) {
  const markerId = `arrow-${el.id}`
  const cap = el.rounded !== false ? "round" : "butt"
  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={el.color} />
        </marker>
      </defs>
      <line
        x1={el.x1}
        y1={el.y1}
        x2={el.x2}
        y2={el.y2}
        stroke={el.color}
        strokeWidth={el.strokeWidth}
        strokeLinecap={cap}
        markerStart={el.arrowStart ? `url(#${markerId})` : undefined}
        markerEnd={el.arrowEnd ? `url(#${markerId})` : undefined}
      />
      <line
        x1={el.x1}
        y1={el.y1}
        x2={el.x2}
        y2={el.y2}
        stroke="transparent"
        strokeWidth={Math.max(el.strokeWidth, 14)}
        strokeLinecap={cap}
        pointerEvents="stroke"
      />
    </>
  )
}

function ShapeView({ el }: { el: ShapeElement }) {
  const d = shapePath(el.shape, el.width, el.height, el.radius)
  const grad = el.gradient
  const gradId = gradientId(el.id)
  const useGradient = el.filled && !!grad && grad.stops.length > 0
  const fill = el.filled ? (useGradient ? `url(#${gradId})` : el.fill) : "none"
  return (
    <>
      {useGradient && (
        <defs>
          {grad!.type === "linear" ? (
            <linearGradient id={gradId} {...linearGradientCoords(grad!.angle)}>
              {grad!.stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
          ) : (
            <radialGradient id={gradId} cx={0.5} cy={0.5} r={0.5}>
              {grad!.stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </radialGradient>
          )}
        </defs>
      )}
      <path
        d={d}
        fill={fill}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        // Miter joins so radius 0 renders truly sharp corners.
        strokeLinejoin={el.radius > 0 ? "round" : "miter"}
      />
    </>
  )
}

function ImageView({ el }: { el: ImageElement }) {
  const url = useAssetUrl(el.assetId)
  const clipId = `clip-${el.id}`
  const outline = el.strokeWidth && el.strokeWidth > 0 && el.stroke
  const sw = outline ? el.strokeWidth! : 0
  return (
    <>
      {el.radius > 0 && (
        <defs>
          <clipPath id={clipId}>
            <rect width={el.width} height={el.height} rx={el.radius} ry={el.radius} />
          </clipPath>
        </defs>
      )}
      {url ? (
        <image
          x={0}
          y={0}
          width={el.width}
          height={el.height}
          href={url}
          data-asset-id={el.assetId}
          preserveAspectRatio="none"
          clipPath={el.radius > 0 ? `url(#${clipId})` : undefined}
        />
      ) : (
        <rect width={el.width} height={el.height} fill="rgba(127,127,127,0.15)" />
      )}
      {outline && (
        <rect
          x={-sw / 2}
          y={-sw / 2}
          width={el.width + sw}
          height={el.height + sw}
          rx={el.radius + sw / 2}
          ry={el.radius + sw / 2}
          fill="none"
          stroke={el.stroke}
          strokeWidth={sw}
          strokeLinejoin={el.radius > 0 ? "round" : "miter"}
        />
      )}
    </>
  )
}

function StrokeView({ el }: { el: StrokeElement }) {
  const d = catmullRomPath(el.points)
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={el.color}
        strokeWidth={el.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={el.variant === "highlighter" ? 0.35 : 1}
      />
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(el.strokeWidth, 14)}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="stroke"
      />
    </>
  )
}

function ElementInner({ el, editing }: { el: Element; editing?: boolean }) {
  switch (el.type) {
    case "text":
      return <TextView el={el} editing={editing} />
    case "image":
      return <ImageView el={el} />
    case "line":
      return <LineView el={el} />
    case "shape":
      return <ShapeView el={el} />
    case "icon":
      return <IconView el={el} />
    case "stroke":
      return <StrokeView el={el} />
  }
}

function BoxTransform({ el }: { el: Element }) {
  return `translate(${el.x} ${el.y}) rotate(${el.rotation} ${el.width / 2} ${el.height / 2})`
}

export const ElementView = memo(function ElementView({
  el,
  editing,
}: {
  el: Element
  editing?: boolean
}) {
  if (el.hidden) return null
  const isPointBased = el.type === "line" || el.type === "stroke"
  const transform = isPointBased ? undefined : BoxTransform({ el })
  const shadow = el.type !== "stroke" && el.shadow ? el.shadow : null
  return (
    <g
      data-element-id={el.id}
      data-element-type={el.type}
      transform={transform}
      opacity={el.opacity}
      filter={shadow ? `url(#${shadowId(el.id)})` : undefined}
      style={{ pointerEvents: el.locked ? "none" : "auto" }}
    >
      {shadow && <ShadowFilter el={el} />}
      <ElementInner el={el} editing={editing} />
      {!isPointBased && (
        <rect
          x={0}
          y={0}
          width={el.width}
          height={el.height}
          fill="transparent"
          pointerEvents="all"
        />
      )}
    </g>
  )
})

export function makePlaceholderId(): string {
  return uid("el")
}
