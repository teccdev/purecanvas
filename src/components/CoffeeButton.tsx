import { useState } from "react"
import { Coffee, X } from "lucide-react"

const HIDE_KEY = "purecanvas-coffee-hidden-until"
const HIDE_MS = 4 * 60 * 60 * 1000
const COFFEE_URL = "https://buymeacoffee.com/glintsoftware"

function isHidden(): boolean {
  try {
    const until = Number(localStorage.getItem(HIDE_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

export function CoffeeButton() {
  const [hidden, setHidden] = useState(isHidden)

  if (hidden) return null

  const dismiss = () => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_MS))
    } catch {
      /* private mode */
    }
    setHidden(true)
  }

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-30">
      <div className="group/coffee pointer-events-auto relative">
        <a
          href={COFFEE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-2 rounded-2xl border border-border bg-background/85 px-3 text-sm font-medium shadow-lg backdrop-blur-md outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Coffee className="size-4 shrink-0" />
          Buy me a coffee
        </a>
        <button
          type="button"
          aria-label="Hide for 4 hours"
          onClick={dismiss}
          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/coffee:opacity-100 group-focus-within/coffee:opacity-100"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
