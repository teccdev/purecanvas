import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import { presentFrames } from "@/lib/artboard"
import { ElementView } from "./canvas/ElementView"

/**
 * Fullscreen presenter: shows one canvas/slide at a time without exporting.
 * Arrow keys, space, and swipe switch slides; Escape exits.
 */
export function Presenter() {
  const presenting = useUI((s) => s.presenting)
  const presentIndex = useUI((s) => s.presentIndex)
  const setPresentIndex = useUI((s) => s.setPresentIndex)
  const stopPresenting = useUI((s) => s.stopPresenting)
  const elements = useDoc((s) => s.elements)
  const artboard = useDoc((s) => s.artboard)
  const theme = useUI((s) => s.theme)

  const overlayRef = useRef<HTMLDivElement | null>(null)
  const swipeStart = useRef<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const frames = presentFrames(elements, artboard)
  const index = Math.min(Math.max(0, presentIndex), frames.length - 1)
  const frame = frames[index]
  const count = frames.length

  // Keep the index in range when the slide count changes mid-presentation.
  useEffect(() => {
    if (!presenting) return
    if (presentIndex > count - 1) setPresentIndex(count - 1)
  }, [presenting, presentIndex, count, setPresentIndex])

  // Enter fullscreen and lock page scrolling for the duration.
  useEffect(() => {
    if (!presenting) return
    const el = overlayRef.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFullscreenChange)
    if (el && !document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {
        /* fullscreen can be blocked; the overlay still works */
      })
    }
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      setFullscreen(false)
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
      }
    }
  }, [presenting])

  const go = useCallback(
    (delta: number) => {
      setPresentIndex(Math.min(Math.max(0, index + delta), count - 1))
    },
    [index, count, setPresentIndex]
  )

  // Capture keys before the editor shortcuts so arrows/space don't move objects.
  useEffect(() => {
    if (!presenting) return
    const onKeyDown = (event: KeyboardEvent) => {
      const next = ["arrowright", "arrowdown", "pagedown", " ", "enter"]
      const prev = ["arrowleft", "arrowup", "pageup", "backspace"]
      const key = event.key.toLowerCase()
      if (key === "escape") {
        stopPresenting()
      } else if (key === "home") {
        setPresentIndex(0)
      } else if (key === "end") {
        setPresentIndex(count - 1)
      } else if (next.includes(key)) {
        go(1)
      } else if (prev.includes(key)) {
        go(-1)
      } else {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [presenting, go, count, stopPresenting, setPresentIndex])

  if (!presenting) return null

  const background =
    (artboard.enabled ? artboard.background : null) ??
    (theme === "dark" ? "#0a0a0a" : "#ffffff")

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void overlayRef.current?.requestFullscreen?.().catch(() => {})
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Presentation"
    >
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") swipeStart.current = e.clientX
        }}
        onPointerUp={(e) => {
          if (swipeStart.current == null) return
          const delta = e.clientX - swipeStart.current
          swipeStart.current = null
          if (Math.abs(delta) > 48) go(delta < 0 ? 1 : -1)
        }}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        <svg
          viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={`Slide ${index + 1} of ${count}`}
        >
          <rect
            x={frame.x}
            y={frame.y}
            width={frame.width}
            height={frame.height}
            fill={background}
          />
          {elements.map((el) => (
            <ElementView key={el.id} el={el} />
          ))}
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/60 p-1 text-white shadow-xl backdrop-blur-md">
          <button
            type="button"
            aria-label="Previous slide"
            disabled={index === 0}
            onClick={() => go(-1)}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-14 text-center text-xs tabular-nums text-white/80">
            {index + 1} / {count}
          </span>
          <button
            type="button"
            aria-label="Next slide"
            disabled={index === count - 1}
            onClick={() => go(1)}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-5" />
          </button>
          <span className="mx-1 h-5 w-px bg-white/15" />
          <button
            type="button"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={toggleFullscreen}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
          >
            <Maximize2 className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Exit presentation"
            onClick={stopPresenting}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
          >
            <X className="size-4.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
