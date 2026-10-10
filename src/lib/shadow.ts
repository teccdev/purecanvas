import type { Shadow } from "./types"

/** SVG filter id for an element's drop shadow. */
export function shadowId(elementId: string): string {
  return `shadow-${elementId}`
}

/** Starting shadow used when the user first enables one. */
export function defaultShadow(): Shadow {
  return { color: "#000000", blur: 12, offsetX: 0, offsetY: 6, opacity: 0.35 }
}
