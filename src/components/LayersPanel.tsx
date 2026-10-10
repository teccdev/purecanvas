import { useRef, useState, type MutableRefObject } from "react"
import {
  ChevronDown,
  ChevronRight,
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

type LayerNode =
  | { kind: "element"; el: Element }
  | { kind: "group"; id: string; name: string; members: Element[] }

/** Front-to-back rows. A group occupies the slot of its front-most member. */
function layerTree(elements: Element[]): LayerNode[] {
  const frontToBack = [...elements].reverse()
  const seen = new Set<string>()
  const rows: LayerNode[] = []
  for (const el of frontToBack) {
    if (!el.groupId) {
      rows.push({ kind: "element", el })
      continue
    }
    if (seen.has(el.groupId)) continue
    seen.add(el.groupId)
    const members = frontToBack.filter((m) => m.groupId === el.groupId)
    rows.push({
      kind: "group",
      id: el.groupId,
      name: members.find((m) => m.groupName)?.groupName || "Group",
      members,
    })
  }
  return rows
}

function LayerRow({
  el,
  selected,
  nested,
  onSelect,
  onRename,
}: {
  el: Element
  selected: boolean
  nested?: boolean
  onSelect: (id: string, additive: boolean) => void
  onRename: (id: string) => void
}) {
  const index = useDoc((s) => s.elements.findIndex((e) => e.id === el.id))
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md px-1.5 py-1",
        nested && "ml-4",
        selected ? "bg-secondary text-secondary-foreground" : "hover:bg-accent",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-xs capitalize"
        onClick={(e) => onSelect(el.id, e.shiftKey || e.metaKey || e.ctrlKey)}
        onDoubleClick={() => onRename(el.id)}
      >
        {el.name ?? elementLabel(el)}
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
}

export function LayersPanel() {
  const elements = useDoc((s) => s.elements)
  const selectedIds = useUI((s) => s.selectedIds)
  const setSelection = useUI((s) => s.setSelection)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const cancelRenameRef = useRef(false)

  const selectIds = (ids: string[], additive: boolean) => {
    if (!additive) {
      setSelection(ids)
      return
    }
    const allIn = ids.every((id) => selectedIds.includes(id))
    setSelection(
      allIn
        ? selectedIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...selectedIds, ...ids])),
    )
  }

  const rows = layerTree(elements)

  return (
    <div className="pointer-events-auto absolute right-20 top-20 z-30 w-60 overflow-hidden rounded-2xl border border-border bg-background/85 shadow-lg backdrop-blur-md">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Layers
        </p>
      </div>
      <ScrollArea className="max-h-[calc(100dvh-8.5rem)]">
        <div className="flex flex-col gap-0.5 p-1.5">
          {rows.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nothing here yet.
            </p>
          )}
          {rows.map((row) => {
            if (row.kind === "element") {
              const el = row.el
              return (
                <div key={el.id}>
                  {renamingId === el.id ? (
                    <RenameField
                      defaultValue={el.name ?? elementLabel(el)}
                      cancelRef={cancelRenameRef}
                      onCommit={(name) => {
                        useDoc.getState().updateElement(el.id, { name })
                        setRenamingId(null)
                      }}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <LayerRow
                      el={el}
                      selected={selectedIds.includes(el.id)}
                      onSelect={(id, additive) => selectIds([id], additive)}
                      onRename={setRenamingId}
                    />
                  )}
                </div>
              )
            }

            const memberIds = elements
              .filter((el) => el.groupId === row.id)
              .map((el) => el.id)
            const allSelected = memberIds.every((id) => selectedIds.includes(id))
            const someSelected = memberIds.some((id) => selectedIds.includes(id))
            const open = !collapsed.has(row.id)
            const allHidden = row.members.every((el) => el.hidden)
            const anyLocked = row.members.some((el) => el.locked)
            return (
              <div key={row.id}>
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-md px-1 py-1",
                    allSelected
                      ? "bg-secondary text-secondary-foreground"
                      : someSelected
                        ? "bg-secondary/60"
                        : "hover:bg-accent",
                  )}
                >
                  <button
                    type="button"
                    aria-label={open ? "Collapse group" : "Expand group"}
                    className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev)
                        if (next.has(row.id)) next.delete(row.id)
                        else next.add(row.id)
                        return next
                      })
                    }
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                  </button>
                  {renamingId === row.id ? (
                    <RenameField
                      defaultValue={row.name}
                      cancelRef={cancelRenameRef}
                      onCommit={(name) => {
                        useDoc.getState().renameGroup(row.id, name)
                        setRenamingId(null)
                      }}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                      onClick={(e) =>
                        selectIds(memberIds, e.shiftKey || e.metaKey || e.ctrlKey)
                      }
                      onDoubleClick={() => setRenamingId(row.id)}
                    >
                      {row.name}
                    </button>
                  )}
                  <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 has-[button:focus-visible]:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Move group up"
                      onClick={() => useDoc.getState().reorderLayers(memberIds, "up")}
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Move group down"
                      onClick={() => useDoc.getState().reorderLayers(memberIds, "down")}
                    >
                      <ChevronDown />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={allHidden ? "Show group" : "Hide group"}
                    className={cn(!allHidden && "opacity-0 group-hover:opacity-100")}
                    onClick={() =>
                      useDoc.getState().updateElements(memberIds, (el) => ({
                        ...el,
                        hidden: !allHidden,
                      }))
                    }
                  >
                    {allHidden ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={anyLocked ? "Unlock group" : "Lock group"}
                    className={cn(!anyLocked && "opacity-0 group-hover:opacity-100")}
                    onClick={() =>
                      useDoc.getState().updateElements(memberIds, (el) => ({
                        ...el,
                        locked: !anyLocked,
                      }))
                    }
                  >
                    {anyLocked ? <Lock /> : <LockOpen />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete group"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => useDoc.getState().removeElements(memberIds)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {open &&
                  row.members.map((el) =>
                    renamingId === el.id ? (
                      <div key={el.id} className="ml-4">
                        <RenameField
                          defaultValue={el.name ?? elementLabel(el)}
                          cancelRef={cancelRenameRef}
                          onCommit={(name) => {
                            useDoc.getState().updateElement(el.id, { name })
                            setRenamingId(null)
                          }}
                          onCancel={() => setRenamingId(null)}
                        />
                      </div>
                    ) : (
                      <LayerRow
                        key={el.id}
                        el={el}
                        nested
                        selected={selectedIds.includes(el.id)}
                        onSelect={(id, additive) => selectIds([id], additive)}
                        onRename={setRenamingId}
                      />
                    ),
                  )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

function RenameField({
  defaultValue,
  cancelRef,
  onCommit,
  onCancel,
}: {
  defaultValue: string
  cancelRef: MutableRefObject<boolean>
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  return (
    <input
      autoFocus
      defaultValue={defaultValue}
      onBlur={(e) => {
        if (cancelRef.current) {
          cancelRef.current = false
          onCancel()
          return
        }
        onCommit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") {
          cancelRef.current = true
          onCancel()
        }
      }}
      className="w-full min-w-0 flex-1 rounded bg-background px-1 text-xs text-foreground outline-none"
    />
  )
}
