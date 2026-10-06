export interface FontDef {
  family: string
  category: "sans" | "serif" | "display" | "mono" | "handwriting"
  weights: number[]
}

export const FONTS: FontDef[] = [
  { family: "Inter", category: "sans", weights: [400, 500, 600, 700, 800] },
  { family: "Geist", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Poppins", category: "sans", weights: [400, 500, 600, 700, 800] },
  { family: "Montserrat", category: "sans", weights: [400, 500, 600, 700, 800] },
  { family: "DM Sans", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Space Grotesk", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800] },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700] },
  { family: "Merriweather", category: "serif", weights: [400, 700] },
  { family: "Libre Baskerville", category: "serif", weights: [400, 700] },
  { family: "Caveat", category: "handwriting", weights: [400, 500, 600, 700] },
  { family: "Shadows Into Light", category: "handwriting", weights: [400] },
  { family: "Permanent Marker", category: "handwriting", weights: [400] },
  { family: "Bebas Neue", category: "display", weights: [400] },
  { family: "Abril Fatface", category: "display", weights: [400] },
  { family: "JetBrains Mono", category: "mono", weights: [400, 500, 600, 700] },
  { family: "Fira Code", category: "mono", weights: [400, 500, 600, 700] },
]

const loaded = new Set<string>()

function fontKey(family: string, weights: number[]): string {
  return `${family}:${weights.join(",")}`
}

/** Load a Google Font into the current document (idempotent). */
export function ensureFontLoaded(family: string, weights: number[] = [400]): void {
  const key = fontKey(family, weights)
  if (loaded.has(key)) return
  loaded.add(key)
  const enabled = weights.length ? weights : [400]
  const spec = `${family.replace(/ /g, "+")}:wght@${enabled.sort((a, b) => a - b).join(";")}`
  const url = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = url
  link.dataset.purefont = family
  document.head.appendChild(link)
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

let embedCache = ""

/** Build @font-face CSS with embedded woff2 fonts for SVG export. */
export async function buildFontEmbedCSS(families: string[]): Promise<string> {
  if (embedCache && families.every((f) => embedCache.includes(`font-family:'${f}'`))) {
    return embedCache
  }
  const unique = Array.from(new Set(families.filter(Boolean)))
  const parts: string[] = []
  await Promise.all(
    unique.map(async (family) => {
      try {
        const spec = `${family.replace(/ /g, "+")}:wght@400;500;600;700`
        const cssRes = await fetch(
          `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
        )
        if (!cssRes.ok) return
        const css = await cssRes.text()
        const blocks = css.split("@font-face").slice(1)
        for (const block of blocks) {
          const weightMatch = block.match(/font-weight:\s*(\d+)/)
          const urlMatch = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)
          if (!urlMatch) continue
          const dataUrl = await fetchAsDataUrl(urlMatch[1])
          if (!dataUrl) continue
          const weight = weightMatch ? weightMatch[1] : "400"
          parts.push(
            `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(${dataUrl}) format('woff2');}`
          )
        }
      } catch {
        /* ignore */
      }
    })
  )
  embedCache = parts.join("\n")
  return embedCache
}
