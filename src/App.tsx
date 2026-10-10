import { useEffect } from "react"
import { Canvas } from "@/components/canvas/Canvas"
import { CoffeeButton } from "@/components/CoffeeButton"
import { Toolbar } from "@/components/Toolbar"
import { TopBar } from "@/components/TopBar"
import { PropertiesPanel } from "@/components/PropertiesPanel"
import { LayersPanel } from "@/components/LayersPanel"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "./components/ui/toast"
import { Loader2 } from "lucide-react"
import { useUI } from "@/store/useUI"
import { useDoc } from "@/store/useDoc"
import { useAutosave } from "@/hooks/useAutosave"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { bootstrapProject } from "@/lib/projects"
import { ensureFontLoaded } from "@/lib/fonts"

let booted = false

export default function App() {
  const theme = useUI((s) => s.theme)
  const layersOpen = useUI((s) => s.layersOpen)
  const projectId = useDoc((s) => s.projectId)

  useAutosave()
  useKeyboardShortcuts()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    if (booted) return
    booted = true
    ensureFontLoaded("Inter")
    void bootstrapProject()
  }, [])

  return (
    <TooltipProvider>
      <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
        <Canvas />
        <TopBar />
        <PropertiesPanel />
        {layersOpen && <LayersPanel />}
        <Toolbar />
        <CoffeeButton />
        {!projectId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
          </div>
          <Toaster />
    </TooltipProvider>
  )
}
