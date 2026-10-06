let measureCtx: CanvasRenderingContext2D | null = null

function getCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx
  const canvas = document.createElement("canvas")
  measureCtx = canvas.getContext("2d")
  return measureCtx
}

export function measureText(text: string, font: string): number {
  const ctx = getCtx()
  if (!ctx) return text.length * 8
  ctx.font = font
  return ctx.measureText(text).width
}

export function fontString(weight: number, size: number, family: string): string {
  return `${weight} ${size}px "${family}", sans-serif`
}

export interface WrappedLine {
  text: string
  width: number
}

/**
 * Word-wrap text to a maximum width. Respects explicit newlines.
 */
export function wrapText(
  text: string,
  font: string,
  maxWidth: number
): WrappedLine[] {
  const lines: WrappedLine[] = []
  const paragraphs = text.split("\n")
  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push({ text: "", width: 0 })
      continue
    }
    const words = paragraph.split(/(\s+)/)
    let current = ""
    for (const word of words) {
      const candidate = current + word
      const width = measureText(candidate, font)
      if (width > maxWidth && current.trim() !== "") {
        lines.push({ text: current.replace(/\s+$/, ""), width: measureText(current, font) })
        current = word.replace(/^\s+/, "")
      } else {
        current = candidate
      }
    }
    lines.push({ text: current, width: measureText(current, font) })
  }
  return lines
}
