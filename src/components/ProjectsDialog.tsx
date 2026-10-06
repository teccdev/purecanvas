import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { db } from "@/lib/db"
import { useDoc } from "@/store/useDoc"
import { createAndOpenProject, openProject, removeProject, renameProject } from "@/lib/projects"
import { cn } from "@/lib/utils"

export function ProjectsDialog() {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const activeId = useDoc((s) => s.projectId)

  const projects = useLiveQuery(
    () => db.projects.orderBy("updatedAt").reverse().toArray(),
    [],
    []
  )

  const commitRename = (id: string) => {
    const name = draft.trim() || "Untitled"
    void renameProject(id, name)
    setEditingId(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <FolderOpen data-icon="inline-start" />
            Projects
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Projects</DialogTitle>
          <DialogDescription>
            Your projects are stored locally in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={async () => {
              await createAndOpenProject()
              setOpen(false)
            }}
          >
            <Plus data-icon="inline-start" />
            New project
          </Button>
        </div>
        <ScrollArea className="h-72">
          <div className="flex flex-col gap-1 pr-3">
            {projects.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No projects yet.
              </p>
            )}
            {projects.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:bg-accent",
                  activeId === p.id && "border-border bg-secondary/60"
                )}
              >
                {editingId === p.id ? (
                  <>
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(p.id)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      className="h-7 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Save name"
                      onClick={() => commitRename(p.id)}
                    >
                      <Check />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Cancel"
                      onClick={() => setEditingId(null)}
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col items-start text-left"
                      onClick={async () => {
                        await openProject(p.id)
                        setOpen(false)
                      }}
                    >
                      <span className="w-full truncate text-sm">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(p.updatedAt).toLocaleString()}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Rename project"
                      onClick={() => {
                        setEditingId(p.id)
                        setDraft(p.name)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Delete project">
                            <Trash2 />
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete “{p.name}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the project and its images. This cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void removeProject(p.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
