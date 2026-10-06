import {
  Layers,
  Maximize,
  Moon,
  Redo2,
  Sun,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import { unionBounds } from "@/lib/geometry"
import { ProjectsDialog } from "./ProjectsDialog"
import { ExportMenu } from "./ExportMenu"

export function TopBar() {
  const projectName = useDoc((s) => s.projectName)
  const camera = useDoc((s) => s.camera)
  const canUndo = useDoc((s) => s.past.length > 0)
  const canRedo = useDoc((s) => s.future.length > 0)
  const theme = useUI((s) => s.theme)
  const toggleTheme = useUI((s) => s.toggleTheme)
  const layersOpen = useUI((s) => s.layersOpen)
  const setLayersOpen = useUI((s) => s.setLayersOpen)
  const requestZoom = useUI((s) => s.requestZoom)

  const fitView = () => {
    const b = unionBounds(useDoc.getState().elements)
    const rect = { width: window.innerWidth, height: window.innerHeight }
    if (!b) {
      useDoc.getState().setCamera({ x: rect.width / 2, y: rect.height / 2, zoom: 1 })
      return
    }
    const pad = 120
    const zoom = Math.min(
      8,
      Math.max(0.05, Math.min(rect.width / (b.width + pad), rect.height / (b.height + pad)))
    )
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    useDoc.getState().setCamera({
      zoom,
      x: rect.width / 2 - cx * zoom,
      y: rect.height / 2 - cy * zoom,
    })
  }

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 p-3">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
        <span className="px-1.5 text-sm font-semibold tracking-tight">PureCanvas</span>
        <Separator orientation="vertical" className="h-5" />
        <Input
          value={projectName}
          onChange={(e) => useDoc.getState().setProjectName(e.target.value)}
          className="h-7 w-40 border-transparent bg-transparent shadow-none focus-visible:border-transparent"
          aria-label="Project name"
        />
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => useDoc.getState().undo()}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={() => useDoc.getState().redo()}
        >
          <Redo2 />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => requestZoom(camera.zoom / 1.2)}
        >
          <ZoomOut />
        </Button>
        <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(camera.zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => requestZoom(camera.zoom * 1.2)}
        >
          <ZoomIn />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Fit to view" onClick={fitView}>
          <Maximize />
        </Button>
      </div>

      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
        <Button
          variant={layersOpen ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Toggle layers"
          aria-pressed={layersOpen}
          onClick={() => setLayersOpen(!layersOpen)}
        >
          <Layers />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <ProjectsDialog />
        <ExportMenu />
      </div>
    </header>
  )
}
