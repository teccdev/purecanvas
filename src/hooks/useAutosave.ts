import { useEffect } from "react"
import { useDoc } from "@/store/useDoc"
import { db } from "@/lib/db"

/** Debounced autosave of the active project into Dexie. */
export function useAutosave() {
  const projectId = useDoc((s) => s.projectId)
  const projectName = useDoc((s) => s.projectName)
  const elements = useDoc((s) => s.elements)
  const camera = useDoc((s) => s.camera)
  const artboard = useDoc((s) => s.artboard)

  useEffect(() => {
    if (!projectId) return
    const timer = setTimeout(() => {
      void (async () => {
        const existing = await db.projects.get(projectId)
        if (!existing) return
        await db.projects.update(projectId, {
          name: projectName,
          elements,
          camera,
          artboard,
          updatedAt: Date.now(),
        })
      })().catch(() => {
        /* ignore transient persistence errors */
      })
    }, 700)
    return () => clearTimeout(timer)
  }, [projectId, projectName, elements, camera, artboard])
}
