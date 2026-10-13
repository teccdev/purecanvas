import { useEffect, useRef, useState } from "react"
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDoc } from "@/store/useDoc"
import {
  useUI,
  type ExportBackground,
  type ExportFormat,
  type ExportPadding,
  type ExportScope,
} from "@/store/useUI"
import type { Element } from "@/lib/types"
import {
  buildSvg,
  copyPngToClipboard,
  downloadBlob,
  EXPORT_PADDINGS,
  rasterize,
  sanitizeFilename,
} from "@/lib/exporter"

const BACKGROUNDS: { id: ExportBackground; label: string }[] = [
  { id: "theme", label: "Theme background" },
  { id: "transparent", label: "Transparent" },
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
]

const SCOPES: { id: ExportScope; label: string }[] = [
  { id: "all", label: "Whole design" },
  { id: "selection", label: "Selected objects" },
]

const PADDINGS: { id: ExportPadding; label: string }[] = [
  { id: "normal", label: "Normal padding" },
  { id: "small", label: "Small padding" },
  { id: "none", label: "No padding (crop tight)" },
]

const BACKGROUND_SHORT: Record<ExportBackground, string> = {
  theme: "Theme",
  transparent: "Transparent",
  white: "White",
  black: "Black",
}

const FORMATS: { id: ExportFormat; label: string; icon: typeof ImageDown }[] = [
  { id: "png", label: "PNG", icon: ImageDown },
  { id: "webp", label: "WEBP", icon: FileImage },
  { id: "svg", label: "SVG", icon: FileType },
]

const CHECKERBOARD = {
  backgroundImage:
    "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
}

function ExportPreview() {
  const elements = useDoc((s) => s.elements)
  const selectedIds = useUI((s) => s.selectedIds)
  const exportBackground = useUI((s) => s.exportBackground)
  const exportPadding = useUI((s) => s.exportPadding)
  const exportScope = useUI((s) => s.exportScope)
  const exportFormat = useUI((s) => s.exportFormat)
  // Re-render when theme changes so the "theme" background swatch stays honest.
  const theme = useUI((s) => s.theme)

  const [preview, setPreview] = useState<{
    url: string
    width: number
    height: number
  } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(null)

    const timer = window.setTimeout(async () => {
      try {
        const list =
          exportScope === "selection"
            ? elements.filter((el) => selectedIds.includes(el.id) && !el.hidden)
            : elements
        if (exportScope === "selection" && list.length === 0) {
          throw new Error("Select objects to preview")
        }
        const built = await buildSvg(
          list,
          exportBackground,
          EXPORT_PADDINGS[exportPadding]
        )
        if (cancelled) return
        const nextUrl = URL.createObjectURL(
          new Blob([built.svg], { type: "image/svg+xml" })
        )
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = nextUrl
        setPreview({ url: nextUrl, width: built.width, height: built.height })
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setFailed(err instanceof Error ? err.message : "Preview unavailable")
        setLoading(false)
      }
    }, 160)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [elements, selectedIds, exportBackground, exportPadding, exportScope, theme])

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    []
  )

  const surface =
    exportBackground === "transparent"
      ? CHECKERBOARD
      : {
          background:
            exportBackground === "theme"
              ? "var(--background)"
              : exportBackground === "white"
                ? "#ffffff"
                : "#000000",
        }

  return (
    <div className="flex flex-col gap-1.5 p-1">
      <div
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border border-border"
        style={surface}
      >
        {preview && !failed ? (
          <img
            src={preview.url}
            alt="Export preview"
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <span className="px-3 text-center text-[11px] text-muted-foreground">
            {failed ?? "Rendering preview…"}
          </span>
        )}
        {loading && !failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-0.5 text-[10px] tabular-nums text-muted-foreground">
        <span>
          {exportFormat.toUpperCase()}
          {preview ? ` · ${preview.width}×${preview.height}` : ""}
        </span>
        <span>
          {exportScope === "selection" ? "Selected" : "Whole design"} ·{" "}
          {BACKGROUND_SHORT[exportBackground]}
        </span>
      </div>
    </div>
  )
}

export function ExportMenu() {
  const exportBackground = useUI((s) => s.exportBackground)
  const setExportBackground = useUI((s) => s.setExportBackground)
  const exportPadding = useUI((s) => s.exportPadding)
  const setExportPadding = useUI((s) => s.setExportPadding)
  const exportScope = useUI((s) => s.exportScope)
  const setExportScope = useUI((s) => s.setExportScope)
  const exportFormat = useUI((s) => s.exportFormat)
  const setExportFormat = useUI((s) => s.setExportFormat)
  const isMobile = useUI((s) => s.isMobile)
  const [open, setOpen] = useState(false)
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

  const elementsForExport = (): Element[] => {
    const elements = useDoc.getState().elements
    if (useUI.getState().exportScope !== "selection") return elements
    const selected = new Set(useUI.getState().selectedIds)
    const picked = elements.filter((el) => selected.has(el.id) && !el.hidden)
    if (picked.length === 0) throw new Error("Select objects to export")
    return picked
  }

  const build = async () =>
    buildSvg(
      elementsForExport(),
      useUI.getState().exportBackground,
      EXPORT_PADDINGS[useUI.getState().exportPadding]
    )

  const download = () => {
    setOpen(false)
    const format = useUI.getState().exportFormat
    if (format === "svg") {
      run(async () => {
        const built = await build()
        downloadBlob(new Blob([built.svg], { type: "image/svg+xml" }), `${baseName()}.svg`)
        return "SVG downloaded"
      })
      return
    }
    const mime = format === "png" ? "image/png" : "image/webp"
    run(async () => {
      const built = await build()
      const blob = await rasterize(built, mime, 2)
      downloadBlob(blob, `${baseName()}.${format}`)
      return `${format.toUpperCase()} downloaded`
    })
  }

  const copyPng = () => {
    setOpen(false)
    run(async () => {
      const built = await build()
      await copyPngToClipboard(built)
      return "PNG copied to clipboard"
    })
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
        render={
          isMobile ? (
            <Button variant="outline" size="icon-sm" aria-label="Export" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={busy}>
              {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}
              Export
            </Button>
          )
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuRadioGroup
          value={exportScope}
          onValueChange={(v) => setExportScope(v as ExportScope)}
        >
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          {SCOPES.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
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
        <DropdownMenuRadioGroup
          value={exportPadding}
          onValueChange={(v) => setExportPadding(v as ExportPadding)}
        >
          <DropdownMenuLabel>Padding</DropdownMenuLabel>
          {PADDINGS.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              {p.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={exportFormat}
          onValueChange={(v) => setExportFormat(v as ExportFormat)}
        >
          <DropdownMenuLabel>Format</DropdownMenuLabel>
          {FORMATS.map((f) => {
            const Icon = f.icon
            return (
              <DropdownMenuRadioItem key={f.id} value={f.id}>
                <Icon data-icon="inline-start" />
                {f.label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1.5 p-1">
          <Button
            variant="default"
            size="sm"
            className="w-full font-semibold"
            disabled={busy}
            onClick={download}
          >
            {busy ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={copyPng}
          >
            <ClipboardCopy data-icon="inline-start" />
            Copy as PNG
          </Button>
        </div>
        <DropdownMenuSeparator />
        <ExportPreview />
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
