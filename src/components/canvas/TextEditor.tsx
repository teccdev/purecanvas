import { useEffect, useRef } from "react"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import { worldToScreen } from "@/lib/geometry"
import type { TextElement } from "@/lib/types"

export function TextEditor() {
  const editingTextId = useUI((s) => s.editingTextId)
  const setEditingText = useUI((s) => s.setEditingText)
  const elements = useDoc((s) => s.elements)
  const camera = useDoc((s) => s.camera)
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const el = elements.find(
    (e) => e.id === editingTextId && e.type === "text"
  ) as TextElement | undefined

  useEffect(() => {
    if (!el) return
    // Defer focus until after the browser's default mousedown focus handling,
    // otherwise the textarea blurs immediately and commits as empty.
    const raf = requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      node.setSelectionRange(node.value.length, node.value.length)
    })
    return () => cancelAnimationFrame(raf)
  }, [el?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!el) return null

  const screen = worldToScreen({ x: el.x, y: el.y }, camera)
  const fontSize = el.fontSize * camera.zoom

  const commit = () => {
    const current = useDoc.getState().elements.find((e) => e.id === el.id)
    if (current && current.type === "text" && current.text.trim() === "") {
      useDoc.getState().removeElements([el.id])
    }
    setEditingText(null)
  }

  return (
    <textarea
      ref={ref}
      value={el.text}
      spellCheck={false}
      onChange={(e) => {
        const value = e.target.value
        useDoc.getState().updateElements([el.id], (item) =>
          item.id === el.id && item.type === "text" ? { ...item, text: value } : item
        )
        const node = e.target
        node.style.height = "auto"
        node.style.height = `${node.scrollHeight}px`
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          ref.current?.blur()
        }
        e.stopPropagation()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
      style={{
        left: screen.x,
        top: screen.y,
        width: el.width * camera.zoom,
        minHeight: el.height * camera.zoom,
        fontSize,
        fontWeight: el.fontWeight,
        fontFamily: `"${el.fontFamily}", sans-serif`,
        color: el.color,
        lineHeight: el.lineHeight,
        textAlign: el.align,
        whiteSpace: "pre-wrap",
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: "top left",
      }}
    />
  )
}
