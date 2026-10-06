export function DotGridBackground({
  camX,
  camY,
  zoom,
}: {
  camX: number
  camY: number
  zoom: number
}) {
  let spacing = 32
  while (spacing * zoom < 14) spacing *= 2
  while (spacing * zoom > 72) spacing /= 2
  const screenSpacing = spacing * zoom
  const r = Math.max(0.6, Math.min(1.6, 1.1 * Math.sqrt(zoom)))
  const offsetX = ((camX % screenSpacing) + screenSpacing) % screenSpacing
  const offsetY = ((camY % screenSpacing) + screenSpacing) % screenSpacing

  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full text-border"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="dot-grid"
          x={offsetX}
          y={offsetY}
          width={screenSpacing}
          height={screenSpacing}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={screenSpacing / 2} cy={screenSpacing / 2} r={r} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  )
}
