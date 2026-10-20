import { Copy, Plus, Trash2 } from "lucide-react"
import { cn } from "cn"

interface SlideChipProps {
  /** Screen position of the slide's top-left corner. */
  x: number
  y: number
  index: number
  total: number
  open: boolean
  canDuplicate: boolean
  canDelete: boolean
  canAdd: boolean
  onToggle: () => void
  onOpen: () => void
  onClose: () => void
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/**
 * Non-intrusive slide badge: a small dot pinned to the slide's top-left corner
 * that expands into a pill with the slide number and quick actions on hover.
 */
export function SlideChip({
  x,
  y,
  index,
  total,
  open,
  canDuplicate,
  canDelete,
  canAdd,
  onToggle,
  onOpen,
  onClose,
  onAdd,
  onDuplicate,
  onDelete,
}: SlideChipProps) {
  return (
    <div
      className="pointer-events-auto absolute flex h-3 items-center"
      style={{ left: x, top: y, transform: "translate(-6px, -6px)" }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") onOpen()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") onClose()
      }}
    >
      <button
        type="button"
        aria-label={`Slide ${index + 1} options`}
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "relative z-10 size-3 shrink-0 cursor-pointer rounded-full border shadow-sm transition-colors duration-150",
          "after:absolute after:-inset-2 after:rounded-full after:content-['']",
          open
            ? "border-primary bg-primary"
            : "border-primary/70 bg-card hover:bg-primary/25"
        )}
      />
      <div
        aria-hidden={!open}
        className={cn(
          "flex h-6 items-center overflow-hidden rounded-full bg-card/95 shadow-sm backdrop-blur transition-[max-width,opacity,border-width] duration-200 ease-out",
          open
            ? "max-w-40 border border-border/70 pl-2 pr-0.5 opacity-100"
            : "pointer-events-none max-w-0 border-0 opacity-0"
        )}
      >
        <span className="whitespace-nowrap pr-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          title="Add blank slide after"
          aria-label={`Add blank slide after slide ${index + 1}`}
          disabled={!canAdd}
          tabIndex={open ? 0 : -1}
          onClick={onAdd}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={12} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="Delete slide"
          aria-label={`Delete slide ${index + 1}`}
          disabled={!canDelete}
          tabIndex={open ? 0 : -1}
          onClick={onDelete}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
        >
          <Trash2 size={12} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="Copy slide"
          aria-label={`Copy slide ${index + 1}`}
          disabled={!canDuplicate}
          tabIndex={open ? 0 : -1}
          onClick={onDuplicate}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <Copy size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
