import { useState } from "react"
import {
  Check,
  ClipboardCopy,
  Download,
  FileImage,
  FileType,
  ImageDown,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDoc } from "@/store/useDoc"
import { useUI, type ExportBackground } from "@/store/useUI"
import {
  buildSvg,
  copyPngToClipboard,
  downloadBlob,
  rasterize,
  sanitizeFilename,
} from "@/lib/exporter"

const BACKGROUNDS: { id: ExportBackground; label: string }[] = [
  { id: "theme", label: "Theme background" },
  { id: "transparent", label: "Transparent" },
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
]

export function ExportMenu() {
  const exportBackground = useUI((s) => s.exportBackground)
  const setExportBackground = useUI((s) => s.setExportBackground)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    setStatus(null)
    try {
      const message = await fn()
      setStatus(message)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Export failed")
    } finally {
      setBusy(false)
      setTimeout(() => setStatus(null), 2600)
    }
  }

  const baseName = () => sanitizeFilename(useDoc.getState().projectName)

  const exportSvg = () =>
    run(async () => {
      const built = await buildSvg(useDoc.getState().elements, useUI.getState().exportBackground)
      downloadBlob(new Blob([built.svg], { type: "image/svg+xml" }), `${baseName()}.svg`)
      return "SVG downloaded"
    })

  const exportRaster = (mime: "image/png" | "image/webp") => () =>
    run(async () => {
      const built = await buildSvg(useDoc.getState().elements, useUI.getState().exportBackground)
      const blob = await rasterize(built, mime, 2)
      const ext = mime === "image/png" ? "png" : "webp"
      downloadBlob(blob, `${baseName()}.${ext}`)
      return `${ext.toUpperCase()} downloaded`
    })

  const copyPng = () =>
    run(async () => {
      const built = await buildSvg(useDoc.getState().elements, useUI.getState().exportBackground)
      await copyPngToClipboard(built)
      return "PNG copied to clipboard"
    })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={busy}>
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}
            Export
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup
          value={exportBackground}
          onValueChange={(v) => setExportBackground(v as ExportBackground)}
        >
          <DropdownMenuLabel>Background</DropdownMenuLabel>
          {BACKGROUNDS.map((b) => (
            <DropdownMenuRadioItem key={b.id} value={b.id}>
              {b.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={exportRaster("image/png")}>
            <ImageDown data-icon="inline-start" />
            Download PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportRaster("image/webp")}>
            <FileImage data-icon="inline-start" />
            Download WEBP
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportSvg}>
            <FileType data-icon="inline-start" />
            Download SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyPng}>
            <ClipboardCopy data-icon="inline-start" />
            Copy PNG to clipboard
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
      </DropdownMenu>
      {status && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
          <Check className="size-3.5" />
          {status}
        </div>
      )}
    </>
  )
}
