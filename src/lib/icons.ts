import { icons as lucideIcons, type LucideIcon } from "lucide-react"

export const LUCIDE_NAMES: string[] = Object.keys(lucideIcons).sort((a, b) =>
  a.localeCompare(b)
)

export function getLucideIcon(name: string): LucideIcon | undefined {
  const icons = lucideIcons as Record<string, LucideIcon>
  // Guard against prototype keys like "__proto__" / "constructor".
  return Object.prototype.hasOwnProperty.call(icons, name) ? icons[name] : undefined
}

export interface MaterialIconData {
  viewBox: string
  inner: string
}

const materialCache = new Map<string, MaterialIconData | null>()
const materialPending = new Map<string, Promise<MaterialIconData | null>>()

const MATERIAL_HOST = "https://fonts.gstatic.com/s/i/short-term/release"

// Material icon names are simple identifiers; reject anything else before it
// is interpolated into the upstream URL.
const MATERIAL_NAME_RE = /^[a-z0-9_]+$/i

const DANGEROUS_SVG_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
])

/**
 * Defense in depth for third-party SVG. Material icon markup is injected with
 * dangerouslySetInnerHTML, so strip anything that could execute or navigate.
 */
function sanitizeSvgInner(svg: SVGSVGElement): string {
  for (const node of Array.from(svg.querySelectorAll("*"))) {
    if (DANGEROUS_SVG_ELEMENTS.has(node.tagName.toLowerCase())) {
      node.remove()
      continue
    }
    for (const attr of Array.from(node.attributes)) {
      const attrName = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (attrName.startsWith("on")) {
        node.removeAttribute(attr.name)
      } else if (
        (attrName === "href" || attrName === "xlink:href" || attrName === "src") &&
        /^(?:javascript|vbscript|data:text\/html):/.test(value)
      ) {
        node.removeAttribute(attr.name)
      }
    }
  }
  return svg.innerHTML
}

export async function loadMaterialIcon(
  name: string,
  opts: { filled?: boolean; rounded?: boolean } = {}
): Promise<MaterialIconData | null> {
  const family = opts.rounded ? "materialsymbolsrounded" : "materialsymbolsoutlined"
  const variant = opts.filled ? "fill1" : "default"
  if (!MATERIAL_NAME_RE.test(name)) return null
  const key = `${family}/${variant}/${name}`
  if (materialCache.has(key)) return materialCache.get(key) ?? null
  if (materialPending.has(key)) return materialPending.get(key) ?? null

  const promise = (async (): Promise<MaterialIconData | null> => {
    try {
      const res = await fetch(`${MATERIAL_HOST}/${family}/${name}/${variant}/24px.svg`)
      if (!res.ok) throw new Error("not found")
      const text = await res.text()
      const doc = new DOMParser().parseFromString(text, "image/svg+xml")
      const svg = doc.querySelector("svg")
      if (!svg) throw new Error("bad svg")
      const viewBox = svg.getAttribute("viewBox") ?? "0 -960 960 960"
      const inner = sanitizeSvgInner(svg)
      const data = { viewBox, inner }
      materialCache.set(key, data)
      return data
    } catch {
      materialCache.set(key, null)
      return null
    } finally {
      materialPending.delete(key)
    }
  })()

  materialPending.set(key, promise)
  return promise
}

const MATERIAL_NAMES_RAW: string[] = [
  "home", "search", "settings", "favorite", "star", "delete", "edit", "add",
  "close", "check", "arrow_forward", "arrow_back", "arrow_upward",
  "arrow_downward", "menu", "more_vert", "more_horiz", "person", "group",
  "lock", "lock_open", "visibility", "visibility_off", "cloud", "cloud_upload",
  "download", "upload", "share", "link", "attachment", "image", "photo_camera",
  "videocam", "mic", "music_note", "movie", "play_arrow", "pause", "stop",
  "skip_next", "skip_previous", "volume_up", "volume_off", "notifications",
  "mail", "chat", "call", "send", "inbox", "drafts", "schedule", "calendar_today",
  "event", "location_on", "map", "navigation", "explore", "public", "language",
  "translate", "school", "work", "business", "store", "shopping_cart",
  "shopping_bag", "payment", "credit_card", "receipt", "local_offer",
  "card_giftcard", "redeem", "inventory", "category", "dashboard", "insights",
  "analytics", "trending_up", "trending_down", "bar_chart", "pie_chart",
  "show_chart", "timeline", "speed", "bolt", "flash_on", "lightbulb",
  "psychology", "emoji_objects", "auto_awesome", "star_half", "bookmark",
  "label", "flag", "check_circle", "cancel", "error", "warning", "info", "help",
  "report", "verified", "shield", "security", "fingerprint", "key", "password",
  "badge", "account_circle", "face", "mood", "sentiment_satisfied", "thumb_up",
  "thumb_down", "pets", "eco", "forest", "park", "wb_sunny", "nightlight",
  "cloudy", "water_drop", "local_fire_department", "ac_unit", "air",
  "flight", "directions_car", "directions_bike", "train", "directions_bus",
  "local_shipping", "two_wheeler", "pedal_bike", "sailing", "anchor",
  "restaurant", "local_cafe", "local_bar", "fastfood", "cake", "icecream",
  "fitness_center", "sports_soccer", "sports_basketball", "sports_tennis",
  "sports_esports", "casino", "theater_comedy", "celebration", "cake",
  "brush", "palette", "draw", "format_paint", "color_lens", "texture",
  "design_services", "architecture", "straighten", "crop", "rotate_right",
  "flip", "layers", "grid_on", "apps", "widgets", "extension", "code", "terminal",
  "data_object", "storage", "memory", "dns", "router", "wifi", "bluetooth",
  "battery_full", "power", "usb", "keyboard", "mouse", "print", "scanner",
  "computer", "laptop", "phone_iphone", "tablet", "watch", "tv", "speaker",
  "headphones", "gamepad", "smart_toy", "rocket_launch", "science", "biotech",
  "medication", "health_and_safety", "monitor_heart", "psychology_alt",
  "construction", "handyman", "build", "engineering", "agriculture",
  "water", "energy", "solar_power", "wind_power", "recycling", "compost",
  "volunteer_activism", "diversity_3", "diversity_1", "interests", "loyalty",
  "diamond", "workspace_premium", "military_tech", "trophy", "sports_score",
  "emoji_events", "workspace_premium", "cake", "cookie", "local_pizza",
  "lunch_dining", "dinner_dining", "brunch_dining", "ramen_dining", "set_meal",
]

export const MATERIAL_NAMES: string[] = Array.from(new Set(MATERIAL_NAMES_RAW))
