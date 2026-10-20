import { useEffect, useState } from "react"
import {
  ArrowDown,
  ArrowRight,
  Frame,
  Maximize,
  Minus,
  Move,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import { clamp } from "@/lib/geometry"
import {
  ARTBOARD_PRESETS,
  CANVAS_BACKGROUNDS,
  MAX_SLIDES,
  contentCenter,
  matchPreset,
  stripBounds,
} from "@/lib/artboard"
import { cn } from "@/lib/utils"

/** Frame the canvas (or the whole slide strip) in the viewport. */
function fitViewToArtboard(): void {
  const b = stripBounds(useDoc.getState().artboard)
  const rect = { width: window.innerWidth, height: window.innerHeight }
  // Keep breathing room on every side, and leave space for the slide labels.
  const pad = 64
  const zoom = clamp(
    Math.min(
      (rect.width - pad * 2) / b.width,
      (rect.height - pad * 2) / b.height
    ),
    0.05,
    8
  )
  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  useDoc.getState().setCamera({
    zoom,
    x: rect.width / 2 - cx * zoom,
    y: rect.height / 2 - cy * zoom,
  })
}

function ensureEnabled(): void {
  if (!useDoc.getState().artboard.enabled) useDoc.getState().enableArtboard()
}

export function ArtboardMenu() {
  const artboard = useDoc((s) => s.artboard)
  const isMobile = useUI((s) => s.isMobile)
  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(String(artboard.width))
  const [height, setHeight] = useState(String(artboard.height))

  // Reflect size changes made from preset buttons (or elsewhere) in the inputs.
  useEffect(() => {
    setWidth(String(artboard.width))
    setHeight(String(artboard.height))
  }, [artboard.width, artboard.height])

  const activePreset = matchPreset(artboard.width, artboard.height)

  const fitView = () => {
    ensureEnabled()
    fitViewToArtboard()
  }

  const centerOnContent = () => {
    ensureEnabled()
    const a = useDoc.getState().artboard
    const strip = stripBounds(a)
    const c = contentCenter(useDoc.getState().elements)
    const deltaX = c.x - (strip.x + strip.width / 2)
    const deltaY = c.y - (strip.y + strip.height / 2)
    useDoc.getState().setArtboard({ x: a.x + deltaX, y: a.y + deltaY })
  }

  const applySize = () => {
    const nextWidth = parseFloat(width)
    const nextHeight = parseFloat(height)
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) {
      // Ignore empty/garbage input instead of collapsing the canvas to 1px.
      setWidth(String(artboard.width))
      setHeight(String(artboard.height))
      return
    }
    useDoc.getState().resizeArtboard(nextWidth, nextHeight)
  }

  const sizeInput = (
    id: string,
    value: string,
    setValue: (v: string) => void,
    label: string
  ) => (
    <div className="flex flex-1 flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={applySize}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            applySize()
            e.currentTarget.blur()
          }
        }}
        className="h-7"
      />
    </div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant={artboard.enabled ? "secondary" : "ghost"}
            size={isMobile ? "icon-sm" : "sm"}
            aria-label={artboard.enabled ? "Canvas settings" : "Add canvas area"}
            aria-pressed={artboard.enabled}
            className={cn(
              !artboard.enabled &&
                "border border-dashed border-primary/60 bg-primary/5 text-foreground hover:bg-primary/10"
            )}
            onClick={() => {
              // The prominent button turns the canvas on (and frames it) in one
              // click; the menu then lets the user fine-tune the size.
              if (!useDoc.getState().artboard.enabled) fitView()
            }}
          >
            {isMobile ? (
              <Frame />
            ) : (
              <>
                <Frame data-icon="inline-start" />
                {artboard.enabled
                  ? artboard.slides
                    ? `${artboard.slideCount} slide${artboard.slideCount === 1 ? "" : "s"}`
                    : `${artboard.width}×${artboard.height}`
                  : "Canvas"}
              </>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Canvas</span>
          <Switch
            size="sm"
            checked={artboard.enabled}
            aria-label="Show canvas"
            onCheckedChange={(on) => {
              if (on) fitView()
              else useDoc.getState().disableArtboard()
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {ARTBOARD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={activePreset === p.id}
              onClick={() => useDoc.getState().resizeArtboard(p.width, p.height)}
              className={cn(
                "flex flex-col items-start rounded-lg border px-2 py-1.5 text-left transition-colors",
                activePreset === p.id
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <span className="text-xs font-medium">{p.label}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {p.width} × {p.height}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          {sizeInput("artboard-width", width, setWidth, "Width")}
          <span className="pb-1.5 text-muted-foreground">×</span>
          {sizeInput("artboard-height", height, setHeight, "Height")}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Background</Label>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {artboard.background ?? "Theme"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CANVAS_BACKGROUNDS.map((bg) => {
              const active = artboard.background === bg.value
              return (
                <button
                  key={bg.label}
                  type="button"
                  title={bg.label}
                  aria-label={`${bg.label} background`}
                  aria-pressed={active}
                  onClick={() => useDoc.getState().setArtboardBackground(bg.value)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md border text-[10px] font-medium transition-shadow",
                    active
                      ? "border-primary ring-2 ring-ring/60"
                      : "border-border hover:ring-2 hover:ring-ring/30"
                  )}
                  style={
                    bg.value
                      ? { background: bg.value, color: isDarkColor(bg.value) ? "#fff" : "#111" }
                      : { background: "var(--background)", color: "var(--foreground)" }
                  }
                >
                  {bg.value === null ? "T" : ""}
                </button>
              )
            })}
            <input
              type="color"
              value={artboard.background ?? "#ffffff"}
              onChange={(e) => useDoc.getState().setArtboardBackground(e.target.value)}
              aria-label="Custom background color"
              title="Custom color"
              className="size-6 cursor-pointer rounded-md border border-border bg-transparent p-0"
            />
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Slides</span>
            <span className="text-[10px] text-muted-foreground">
              A continuous strip of canvas areas
            </span>
          </div>
          <Switch
            size="sm"
            checked={artboard.slides}
            aria-label="Show slides"
            onCheckedChange={(on) => {
              ensureEnabled()
              useDoc.getState().setSlides(on)
            }}
          />
        </div>

        {artboard.slides && (
          <>
            <div className="flex items-center gap-1.5">
              <Button
                variant={artboard.slideAxis === "horizontal" ? "secondary" : "outline"}
                size="sm"
                className="h-7 flex-1"
                aria-pressed={artboard.slideAxis === "horizontal"}
                onClick={() => useDoc.getState().setSlideAxis("horizontal")}
              >
                <ArrowRight data-icon="inline-start" />
                Horizontal
              </Button>
              <Button
                variant={artboard.slideAxis === "vertical" ? "secondary" : "outline"}
                size="sm"
                className="h-7 flex-1"
                aria-pressed={artboard.slideAxis === "vertical"}
                onClick={() => useDoc.getState().setSlideAxis("vertical")}
              >
                <ArrowDown data-icon="inline-start" />
                Vertical
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs tabular-nums text-muted-foreground">
                {artboard.slideCount} slide{artboard.slideCount === 1 ? "" : "s"}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon-xs"
                  aria-label="Remove slide"
                  disabled={artboard.slideCount <= 1}
                  onClick={() => useDoc.getState().removeSlide()}
                >
                  <Minus />
                </Button>
                <Button
                  variant="outline"
                  size="icon-xs"
                  aria-label="Add slide"
                  disabled={artboard.slideCount >= MAX_SLIDES}
                  onClick={() => useDoc.getState().addSlide()}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1" onClick={fitView}>
            <Maximize data-icon="inline-start" />
            Fit view
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={centerOnContent}
          >
            <Move data-icon="inline-start" />
            Center
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Pick a readable foreground for a hex canvas swatch. */
function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const raw = m[1]
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return r * 0.299 + g * 0.587 + b * 0.114 < 140
}
