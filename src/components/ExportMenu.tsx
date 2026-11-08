import { useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ClipboardCopy,
  Download,
  FileImage,
  FileText,
  FileType,
  ImageDown,
  Loader2,
} from "lucide-react"
import { zipSync } from "fflate"
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
  type ExportSlide,
} from "@/store/useUI"
import type { Artboard, Bounds, Element } from "@/lib/types"
import {
  buildPdf,
  buildSvg,
  copyPngToClipboard,
  downloadBlob,
  EXPORT_PADDINGS,
  rasterize,
  resolveBackgroundColor,
  sanitizeFilename,
} from "@/lib/exporter"
import { slideFrames, slideTotal } from "@/lib/artboard"

const BACKGROUNDS: { id: ExportBackground; label: string }[] = [
  { id: "theme", label: "Theme background" },
  { id: "transparent", label: "Transparent" },
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
]

const SCOPES: { id: ExportScope; label: string }[] = [
  { id: "all", label: "Whole design" },
  { id: "artboard", label: "Canvas area" },
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
  { id: "jpeg", label: "JPEG", icon: FileImage },
  { id: "webp", label: "WEBP", icon: FileImage },
  { id: "svg", label: "SVG", icon: FileType },
  { id: "pdf", label: "PDF", icon: FileText },
]

const CHECKERBOARD = {
  backgroundImage:
    "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
}

function activeScope(scope: ExportScope, artboard: Artboard): ExportScope {
  return scope === "artboard" && !artboard.enabled ? "all" : scope
}

/** Frames that the current export selection will produce. */
function framesForExport(artboard: Artboard, slide: ExportSlide): Bounds[] {
  const all = slideFrames(artboard)
  if (!artboard.slides) return all.slice(0, 1)
  if (slide === "all") return all
  return [all[Math.min(Math.max(0, slide), all.length - 1)]]
}

function isMultiSlide(artboard: Artboard, scope: ExportScope, slide: ExportSlide): boolean {
  return scope === "artboard" && artboard.slides && slide === "all" && slideTotal(artboard) > 1
}

/** Paint used for canvas/slide exports: the canvas color when set. */
function canvasPaint(artboard: Artboard, fallback: ExportBackground): ExportBackground | string {
  return artboard.background ?? fallback
}

function slideChoiceValue(slide: ExportSlide, count: number): string {
  if (slide === "all") return "all"
  return String(Math.min(Math.max(0, slide), count - 1))
}

function zipBlob(files: Record<string, Uint8Array>): Blob {
  const zipped = zipSync(files)
  return new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" })
}

function ExportPreview() {
  const elements = useDoc((s) => s.elements)
  const artboard = useDoc((s) => s.artboard)
  const selectedIds = useUI((s) => s.selectedIds)
  const exportBackground = useUI((s) => s.exportBackground)
  const exportPadding = useUI((s) => s.exportPadding)
  const exportScope = useUI((s) => s.exportScope)
  const exportFormat = useUI((s) => s.exportFormat)
  const exportSlide = useUI((s) => s.exportSlide)
  // Re-render when theme changes so the "theme" background swatch stays honest.
  const theme = useUI((s) => s.theme)

  // The canvas scope falls back to the whole design when no canvas is set.
  const scope = activeScope(exportScope, artboard)
  const multi = isMultiSlide(artboard, scope, exportSlide)
  const frames = useMemo(
    () => (scope === "artboard" ? framesForExport(artboard, exportSlide) : null),
    [scope, artboard, exportSlide]
  )
  const frame = frames ? frames[0] : undefined
  const paint =
    scope === "artboard" ? canvasPaint(artboard, exportBackground) : exportBackground

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
          scope === "selection"
            ? elements.filter((el) => selectedIds.includes(el.id) && !el.hidden)
            : elements
        if (scope === "selection" && list.length === 0) {
          throw new Error("Select objects to preview")
        }
        const built = await buildSvg(
          list,
          paint,
          scope === "artboard" ? 0 : EXPORT_PADDINGS[exportPadding],
          frame
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
  }, [
    elements,
    selectedIds,
    exportBackground,
    exportPadding,
    scope,
    artboard,
    paint,
    frame,
    theme,
  ])

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    []
  )

  const surface =
    paint === "transparent"
      ? CHECKERBOARD
      : {
          background:
            paint === "theme"
              ? "var(--background)"
              : paint === "white"
                ? "#ffffff"
                : paint === "black"
                  ? "#000000"
                  : paint,
        }

  const backgroundLabel =
    scope === "artboard" && artboard.background
      ? "Canvas"
      : BACKGROUND_SHORT[exportBackground]
  const slideIndex =
    exportSlide === "all"
      ? 0
      : Math.min(Math.max(0, exportSlide), slideTotal(artboard) - 1)
  const scopeLabel =
    scope === "selection"
      ? "Selected"
      : scope === "artboard"
        ? artboard.slides
          ? multi
            ? `All ${frames?.length ?? 1} slides`
            : `Slide ${slideIndex + 1}`
          : "Canvas"
        : "Whole design"

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
          {scopeLabel} · {backgroundLabel}
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
  const exportSlide = useUI((s) => s.exportSlide)
  const setExportSlide = useUI((s) => s.setExportSlide)
  const isMobile = useUI((s) => s.isMobile)
  const artboard = useDoc((s) => s.artboard)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // The "Canvas area" scope collapses to "Whole design" when no canvas is set.
  const scope = activeScope(exportScope, artboard)
  const multi = isMultiSlide(artboard, scope, exportSlide)
  const scopes = artboard.enabled
    ? SCOPES.map((s) =>
        s.id === "artboard"
          ? { ...s, label: artboard.slides ? "Slides" : "Canvas area" }
          : s
      )
    : SCOPES.filter((s) => s.id !== "artboard")
  const slideCount = slideTotal(artboard)
  const canvasOwnBackground = scope === "artboard" && artboard.background != null

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

  const effectiveScope = (): ExportScope => {
    const s = useUI.getState().exportScope
    const ab = useDoc.getState().artboard
    return activeScope(s, ab)
  }

  const elementsForExport = (): Element[] => {
    const elements = useDoc.getState().elements
    if (effectiveScope() !== "selection") return elements
    const selected = new Set(useUI.getState().selectedIds)
    const picked = elements.filter((el) => selected.has(el.id) && !el.hidden)
    if (picked.length === 0) throw new Error("Select objects to export")
    return picked
  }

  /** Built pages for the current canvas/slide scope. */
  const buildSlidePages = async () => {
    const ab = useDoc.getState().artboard
    const ui = useUI.getState()
    const frames = framesForExport(ab, ui.exportSlide)
    const paint = canvasPaint(ab, ui.exportBackground)
    const pages = await Promise.all(
      frames.map((frame) => buildSvg(elementsForExport(), paint, 0, frame))
    )
    return { pages, paint }
  }

  const download = () => {
    setOpen(false)
    const format = useUI.getState().exportFormat
    const name = baseName()
    run(async () => {
      if (effectiveScope() === "artboard") {
        const { pages, paint } = await buildSlidePages()
        if (format === "pdf") {
          const blob = await buildPdf(pages, resolveBackgroundColor(paint))
          downloadBlob(blob, `${name}.pdf`)
          return pages.length > 1 ? `PDF downloaded (${pages.length} pages)` : "PDF downloaded"
        }
        if (format === "svg") {
          if (pages.length === 1) {
            downloadBlob(
              new Blob([pages[0].svg], { type: "image/svg+xml" }),
              `${name}.svg`
            )
            return "SVG downloaded"
          }
          const files: Record<string, Uint8Array> = {}
          pages.forEach((page, i) => {
            files[`${name}-${String(i + 1).padStart(2, "0")}.svg`] = new TextEncoder().encode(
              page.svg
            )
          })
          downloadBlob(zipBlob(files), `${name}-slides.zip`)
          return `${pages.length} SVGs downloaded`
        }

        const mime =
          format === "png"
            ? "image/png"
            : format === "jpeg"
              ? "image/jpeg"
              : "image/webp"
        const ext = format === "jpeg" ? "jpg" : format
        const flatten = format === "jpeg" ? resolveBackgroundColor(paint) : undefined
        if (pages.length === 1) {
          const blob = await rasterize(pages[0], mime, 2, flatten)
          downloadBlob(blob, `${name}.${ext}`)
          return `${format.toUpperCase()} downloaded`
        }
        const files: Record<string, Uint8Array> = {}
        for (let i = 0; i < pages.length; i++) {
          const blob = await rasterize(pages[i], mime, 2, flatten)
          files[`${name}-${String(i + 1).padStart(2, "0")}.${ext}`] = new Uint8Array(
            await blob.arrayBuffer()
          )
        }
        downloadBlob(zipBlob(files), `${name}-slides.zip`)
        return `${pages.length} images downloaded`
      }

      // Whole-design and selection exports always produce one page.
      const ui = useUI.getState()
      if (format === "pdf") {
        const built = await buildSvg(
          elementsForExport(),
          ui.exportBackground,
          EXPORT_PADDINGS[ui.exportPadding]
        )
        const blob = await buildPdf([built], resolveBackgroundColor(ui.exportBackground))
        downloadBlob(blob, `${name}.pdf`)
        return "PDF downloaded"
      }
      if (format === "svg") {
        const built = await buildSvg(
          elementsForExport(),
          ui.exportBackground,
          EXPORT_PADDINGS[ui.exportPadding]
        )
        downloadBlob(new Blob([built.svg], { type: "image/svg+xml" }), `${name}.svg`)
        return "SVG downloaded"
      }
      const built = await buildSvg(
        elementsForExport(),
        ui.exportBackground,
        EXPORT_PADDINGS[ui.exportPadding]
      )
      const mime =
        format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp"
      const flatten =
        format === "jpeg" ? resolveBackgroundColor(ui.exportBackground) : undefined
      const blob = await rasterize(built, mime, 2, flatten)
      downloadBlob(blob, `${name}.${format === "jpeg" ? "jpg" : format}`)
      return `${format.toUpperCase()} downloaded`
    })
  }

  const copyPng = () => {
    setOpen(false)
    run(async () => {
      if (effectiveScope() === "artboard") {
        const { pages } = await buildSlidePages()
        if (pages.length !== 1) throw new Error("Choose one slide to copy")
        await copyPngToClipboard(pages[0])
        return "PNG copied to clipboard"
      }
      const ui = useUI.getState()
      const built = await buildSvg(
        elementsForExport(),
        ui.exportBackground,
        EXPORT_PADDINGS[ui.exportPadding]
      )
      await copyPngToClipboard(built)
      return "PNG copied to clipboard"
    })
  }

  const downloadLabel =
    exportFormat === "pdf"
      ? "Download PDF"
      : multi
        ? `Download ${slideCount} slides`
        : "Download"

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
                {busy ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Download data-icon="inline-start" />
                )}
                Export
              </Button>
            )
          }
        />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuRadioGroup
            value={scope}
            onValueChange={(v) => setExportScope(v as ExportScope)}
          >
            <DropdownMenuLabel>Export</DropdownMenuLabel>
            {scopes.map((s) => (
              <DropdownMenuRadioItem key={s.id} value={s.id}>
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          {scope === "artboard" && artboard.slides && slideCount > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={slideChoiceValue(exportSlide, slideCount)}
                onValueChange={(v) =>
                  setExportSlide(v === "all" ? "all" : Number(v))
                }
              >
                <DropdownMenuLabel>Slides</DropdownMenuLabel>
                <DropdownMenuRadioItem value="all">
                  All slides ({slideCount})
                </DropdownMenuRadioItem>
                {Array.from({ length: slideCount }, (_, i) => (
                  <DropdownMenuRadioItem key={i} value={String(i)}>
                    Slide {i + 1}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}

          <DropdownMenuSeparator />
          {canvasOwnBackground ? (
            <DropdownMenuRadioGroup value="canvas">
              <DropdownMenuLabel>Background</DropdownMenuLabel>
              <DropdownMenuRadioItem value="canvas" disabled>
                <span
                  className="size-3 rounded-sm border border-border"
                  style={{ background: artboard.background ?? undefined }}
                />
                Canvas color
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          ) : (
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
          )}

          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={exportPadding}
            onValueChange={(v) => setExportPadding(v as ExportPadding)}
          >
            <DropdownMenuLabel>
              Padding{scope === "artboard" ? " (canvas ignores this)" : ""}
            </DropdownMenuLabel>
            {PADDINGS.map((p) => (
              <DropdownMenuRadioItem
                key={p.id}
                value={p.id}
                disabled={scope === "artboard"}
              >
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
              {downloadLabel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={busy || multi}
              title={multi ? "Choose a single slide to copy" : undefined}
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
