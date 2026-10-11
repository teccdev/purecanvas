import { gridSpacing } from "@/lib/snapping"

export function DotGridBackground({
  camX,
  camY,
  zoom,
}: {
  camX: number
  camY: number
  zoom: number
}) {
  const spacing = gridSpacing(zoom)
  const screenSpacing = spacing * zoom
  const r = Math.max(2, Math.min(3, 1.1 * Math.sqrt(zoom)))
  const offsetX = ((camX % screenSpacing) + screenSpacing) % screenSpacing
  const offsetY = ((camY % screenSpacing) + screenSpacing) % screenSpacing

  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full text-border"
      aria-hidden="true"
    >
      <defs>
        {/* Pattern tiles clip their contents, so a dot at the tile
            origin renders as a single quadrant. Center the dot in
            the tile and shift the tile by half a spacing so dots
            still land on multiples of the world spacing. */}
        <pattern
          id="dot-grid"
          x={offsetX - screenSpacing / 2}
          y={offsetY - screenSpacing / 2}
          width={screenSpacing}
          height={screenSpacing}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={screenSpacing / 2}
            cy={screenSpacing / 2}
            r={r}
            fill="currentColor"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  )
}
