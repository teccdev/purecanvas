import type { ShapeKind } from "./types"

export function shapePath(kind: ShapeKind, w: number, h: number, radius = 0): string {
  switch (kind) {
    case "rect": {
      const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2))
      if (r <= 0) return `M 0 0 H ${w} V ${h} H 0 Z`
      return [
        `M ${r} 0`,
        `H ${w - r}`,
        `A ${r} ${r} 0 0 1 ${w} ${r}`,
        `V ${h - r}`,
        `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
        `H ${r}`,
        `A ${r} ${r} 0 0 1 0 ${h - r}`,
        `V ${r}`,
        `A ${r} ${r} 0 0 1 ${r} 0`,
        "Z",
      ].join(" ")
    }
    case "ellipse": {
      const rx = w / 2
      const ry = h / 2
      return [
        `M 0 ${ry}`,
        `A ${rx} ${ry} 0 1 1 ${w} ${ry}`,
        `A ${rx} ${ry} 0 1 1 0 ${ry}`,
        "Z",
      ].join(" ")
    }
    case "triangle":
      return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`
    case "diamond":
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`
    case "hexagon": {
      const cx = w / 2
      const cy = h / 2
      const rx = w / 2
      const ry = h / 2
      const pts: string[] = []
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6
        pts.push(`${cx + rx * Math.cos(a)} ${cy + ry * Math.sin(a)}`)
      }
      return `M ${pts.join(" L ")} Z`
    }
    case "star": {
      const cx = w / 2
      const cy = h / 2
      const spikes = 5
      const outer = Math.min(w, h) / 2
      const inner = outer * 0.4
      const step = Math.PI / spikes
      let rot = -Math.PI / 2
      const pts: string[] = []
      for (let i = 0; i < spikes; i++) {
        pts.push(`${cx + Math.cos(rot) * outer} ${cy + Math.sin(rot) * outer}`)
        rot += step
        pts.push(`${cx + Math.cos(rot) * inner} ${cy + Math.sin(rot) * inner}`)
        rot += step
      }
      return `M ${pts.join(" L ")} Z`
    }
    default:
      return `M 0 0 H ${w} V ${h} H 0 Z`
  }
}
