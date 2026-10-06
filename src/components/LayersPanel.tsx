import { useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { Element } from "@/lib/types"

function elementLabel(el: Element): string {
  if (el.type === "text") return el.text.trim() || "Text"
  if (el.type === "shape") return el.shape
  if (el.type === "icon") return el.name
  return el.type
}

export function LayersPanel() {
  const elements = useDoc((s) => s.elements)
  const selectedIds = useUI((s) => s.selectedIds)
  const setSelection = useUI((s) => s.setSelection)
  const toggleSelection = useUI((s) => s.toggleSelection)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const ordered = [...elements].reverse()

  return (
    <div className="pointer-events-auto absolute right-20 top-20 z-30 w-60 overflow-hidden rounded-2xl border border-border bg-background/85 shadow-lg backdrop-blur-md">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Layers
        </p>
      </div>
      <ScrollArea className="max-h-[40vh]">
        <div className="flex flex-col gap-0.5 p-1.5">
          {ordered.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nothing here yet.
            </p>
          )}
          {ordered.map((el) => {
            const index = elements.findIndex((e) => e.id === el.id)
            const selected = selectedIds.includes(el.id)
            return (
              <div
                key={el.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-1.5 py-1",
                  selected ? "bg-secondary text-secondary-foreground" : "hover:bg-accent"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs capitalize"
                  onClick={(e) => {
                    if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelection(el.id)
                    else setSelection([el.id])
                  }}
                  onDoubleClick={() => setRenamingId(el.id)}
                >
                  {renamingId === el.id ? (
                    <input
                      autoFocus
                      defaultValue={el.name ?? elementLabel(el)}
                      onBlur={(e) => {
                        const name = e.target.value
                        useDoc.getState().updateElement(el.id, { name })
                        setRenamingId(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur()
                        if (e.key === "Escape") setRenamingId(null)
                      }}
                      className="w-full rounded bg-background px-1 text-xs text-foreground outline-none"
                    />
                  ) : (
                    el.name ?? elementLabel(el)
                  )}
                </button>
                <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 has-[button:focus-visible]:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Move layer up"
                    onClick={() => useDoc.getState().moveLayer(el.id, index + 1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Move layer down"
                    onClick={() => useDoc.getState().moveLayer(el.id, index - 1)}
                  >
                    <ChevronDown />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={el.hidden ? "Show layer" : "Hide layer"}
                  className={cn(!el.hidden && "opacity-0 group-hover:opacity-100")}
                  onClick={() => useDoc.getState().updateElement(el.id, { hidden: !el.hidden })}
                >
                  {el.hidden ? <EyeOff /> : <Eye />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={el.locked ? "Unlock layer" : "Lock layer"}
                  className={cn(!el.locked && "opacity-0 group-hover:opacity-100")}
                  onClick={() => useDoc.getState().updateElement(el.id, { locked: !el.locked })}
                >
                  {el.locked ? <Lock /> : <LockOpen />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete layer"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => useDoc.getState().removeElements([el.id])}
                >
                  <Trash2 />
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
