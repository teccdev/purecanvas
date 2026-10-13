import {
  Circle,
  Diamond,
  Eraser,
  Hexagon,
  Highlighter,
  Image as ImageIcon,
  LayoutGridCircles,
  MousePointer2,
  Pen,
  PenTool,
  Slash,
  Square,
  Star,
  Triangle,
  Type,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { useUI } from "@/store/useUI"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import type { PenVariant, ShapeKind, Tool } from "@/lib/types"
import { TOOL_SHORTCUTS } from "@/lib/tools"
import { cn } from "@/lib/utils"

const TOOL_ICONS: Record<Tool, LucideIcon> = {
  select: MousePointer2,
  text: Type,
  image: ImageIcon,
  line: Slash,
  shape: Square,
  icon: LayoutGridCircles,
  pen: PenTool,
}

const TOOLS = TOOL_SHORTCUTS.map((t) => ({ ...t, icon: TOOL_ICONS[t.id] }))

const PEN_VARIANTS: { id: PenVariant; label: string; icon: LucideIcon }[] = [
  { id: "pen", label: "Pen", icon: Pen },
  { id: "highlighter", label: "Highlighter", icon: Highlighter },
  { id: "eraser", label: "Eraser", icon: Eraser },
]

const SHAPE_KINDS: { id: ShapeKind; label: string; icon: LucideIcon }[] = [
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "diamond", label: "Diamond", icon: Diamond },
  { id: "star", label: "Star", icon: Star },
  { id: "hexagon", label: "Hexagon", icon: Hexagon },
]

function RailButton({
  active,
  onClick,
  label,
  shortcuts,
  compact,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  shortcuts?: string[]
  compact?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "group relative flex items-center justify-center rounded-xl",
        compact ? "size-9" : "size-11",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
      {!compact && (
        <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 flex max-w-0 -translate-y-1/2 items-center overflow-hidden rounded-md bg-foreground py-1.5 text-xs font-medium whitespace-nowrap text-background opacity-0 transition-all duration-200 ease-out group-hover:max-w-56 group-hover:px-2.5 group-hover:opacity-100">
          {label}
          {shortcuts?.[0] && (
            <kbd className="ml-2 rounded border border-background/25 px-1 text-[10px] opacity-70">
              {shortcuts[0].toUpperCase()}
            </kbd>
          )}
        </span>
      )}
    </button>
  )
}

export function Toolbar() {
  const tool = useUI((s) => s.tool)
  const setTool = useUI((s) => s.setTool)
  const penVariant = useUI((s) => s.penVariant)
  const setPenVariant = useUI((s) => s.setPenVariant)
  const shapeKind = useUI((s) => s.defaults.shapeKind)
  const setDefaults = useUI((s) => s.setDefaults)
  const isMobile = useUI((s) => s.isMobile)
  const portrait = useMediaQuery("(orientation: portrait)")

  // Portrait phones get a bottom horizontal bar; landscape phones / narrow
  // windows get a compact 2×3 grid in the same corner as the desktop rail.
  const bottomBar = isMobile && portrait
  const tools = isMobile
    ? TOOLS.filter((t) => t.id !== "select")
    : TOOLS

  const rootClass = bottomBar
    ? "pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    : "pointer-events-none absolute right-4 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2"

  const railClass = bottomBar
    ? "pointer-events-auto flex flex-row gap-1 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md"
    : isMobile
      ? "pointer-events-auto grid grid-cols-2 gap-1 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md"
      : "pointer-events-auto flex flex-col gap-1 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md"

  const submenuClass = cn(
    "pointer-events-auto rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md",
    bottomBar ? "flex flex-row gap-1" : "flex flex-col gap-1"
  )

  return (
    <div className={rootClass}>
      {tool === "pen" && (
        <div className={submenuClass}>
          {PEN_VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-label={v.label}
              aria-pressed={penVariant === v.id}
              onClick={() => setPenVariant(v.id)}
              className={cn(
                "group relative flex size-9 items-center justify-center rounded-lg",
                penVariant === v.id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <v.icon className="size-4" />
              {!isMobile && (
                <span className="pointer-events-none absolute right-[calc(100%+8px)] top-1/2 flex max-w-0 -translate-y-1/2 overflow-hidden rounded-md bg-foreground py-1.5 text-[11px] whitespace-nowrap text-background opacity-0 transition-all duration-200 group-hover:max-w-56 group-hover:px-2 group-hover:opacity-100">
                  {v.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {tool === "shape" && (
        <div className="pointer-events-auto grid grid-cols-2 gap-1 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
          {SHAPE_KINDS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.label}
              aria-pressed={shapeKind === s.id}
              onClick={() => setDefaults({ shapeKind: s.id })}
              className={cn(
                "group relative flex size-9 items-center justify-center rounded-lg",
                shapeKind === s.id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <s.icon className="size-4" />
            </button>
          ))}
        </div>
      )}
      <div className={railClass}>
        {tools.map((t) => (
          <RailButton
            key={t.id}
            active={tool === t.id}
            onClick={() => {
              setTool(t.id)
              if (t.id === "pen") setPenVariant(penVariant)
            }}
            label={t.label}
            shortcuts={t.shortcuts}
            compact={isMobile}
          >
            <t.icon className={isMobile ? "size-4" : "size-5"} />
          </RailButton>
        ))}
      </div>
    </div>
  )
}
