import { memo, useEffect, useState } from "react"
import { getLucideIcon, loadMaterialIcon, type MaterialIconData } from "@/lib/icons"
import { useAssetUrl } from "@/lib/imageCache"
import { catmullRomPath } from "@/lib/geometry"
import { shapePath } from "@/lib/shapes"
import { fontString, wrapText } from "@/lib/text"
import type { Element, IconElement, ImageElement, LineElement, ShapeElement, StrokeElement, TextElement } from "@/lib/types"
import { uid } from "@/lib/id"

function MaterialIcon({ el }: { el: IconElement }) {
  const [data, setData] = useState<MaterialIconData | null>(null)
  useEffect(() => {
    let alive = true
    loadMaterialIcon(el.name).then((d) => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
  }, [el.name])
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
  return (
    <Icon
      x={0}
      y={0}
      width={el.width}
      height={el.height}
      color={el.color}
      strokeWidth={el.strokeWidth}
    />
  )
}

function TextView({ el }: { el: TextElement }) {
  const font = fontString(el.fontWeight, el.fontSize, el.fontFamily)
  const lines = el.text === "" ? [{ text: "", width: 0 }] : wrapText(el.text, font, el.width)
  const lineHeight = el.fontSize * el.lineHeight
  return (
    <text
      x={0}
      y={el.fontSize}
      fontFamily={`"${el.fontFamily}", sans-serif`}
      fontSize={el.fontSize}
      fontWeight={el.fontWeight}
      fill={el.color}
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
        strokeLinecap="round"
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
        strokeLinecap="round"
        pointerEvents="stroke"
      />
    </>
  )
}

function ShapeView({ el }: { el: ShapeElement }) {
  const d = shapePath(el.shape, el.width, el.height, el.radius)
  return (
    <path
      d={d}
      fill={el.filled ? el.fill : "none"}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth}
      strokeLinejoin="round"
    />
  )
}

function ImageView({ el }: { el: ImageElement }) {
  const url = useAssetUrl(el.assetId)
  const clipId = `clip-${el.id}`
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

function ElementInner({ el }: { el: Element }) {
  switch (el.type) {
    case "text":
      return <TextView el={el} />
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

export const ElementView = memo(function ElementView({ el }: { el: Element }) {
  if (el.hidden) return null
  const isPointBased = el.type === "line" || el.type === "stroke"
  const transform = isPointBased ? undefined : BoxTransform({ el })
  return (
    <g
      data-element-id={el.id}
      data-element-type={el.type}
      transform={transform}
      opacity={el.opacity}
      style={{ pointerEvents: el.locked ? "none" : "auto" }}
    >
      <ElementInner el={el} />
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
