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
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  shortcuts?: string[]
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "group relative flex size-11 items-center justify-center rounded-xl",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
      <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 flex max-w-0 -translate-y-1/2 items-center overflow-hidden rounded-md bg-foreground py-1.5 text-xs font-medium whitespace-nowrap text-background opacity-0 transition-all duration-200 ease-out group-hover:max-w-56 group-hover:px-2.5 group-hover:opacity-100">
        {label}
        {shortcuts?.[0] && (
          <kbd className="ml-2 rounded border border-background/25 px-1 text-[10px] opacity-70">
            {shortcuts[0].toUpperCase()}
          </kbd>
        )}
      </span>
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

  return (
    <div className="pointer-events-none absolute right-4 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2">
      {tool === "pen" && (
        <div className="pointer-events-auto flex flex-col gap-1 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
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
              <span className="pointer-events-none absolute right-[calc(100%+8px)] top-1/2 flex max-w-0 -translate-y-1/2 overflow-hidden rounded-md bg-foreground py-1.5 text-[11px] whitespace-nowrap text-background opacity-0 transition-all duration-200 group-hover:max-w-56 group-hover:px-2 group-hover:opacity-100">
                {v.label}
              </span>
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
      <div className="pointer-events-auto flex flex-col gap-1 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
        {TOOLS.map((t) => (
          <RailButton
            key={t.id}
            active={tool === t.id}
            onClick={() => {
              setTool(t.id)
              if (t.id === "pen") setPenVariant(penVariant)
            }}
            label={t.label}
            shortcuts={t.shortcuts}
          >
            <t.icon className="size-5" />
          </RailButton>
        ))}
      </div>
    </div>
  )
}
