import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import type { ReactNode } from "react"
import { FONTS, ensureFontLoaded } from "@/lib/fonts"
import { IconPicker } from "./IconPicker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Element, ShapeKind } from "@/lib/types"
import { cn } from "@/lib/utils"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-3 py-3 last:border-b-0">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-20 font-mono text-xs"
        />
        <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input">
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v
          if (typeof next === "number") onChange(next)
        }}
      />
    </div>
  )
}

function OptionRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md border border-border px-2 py-1 text-xs transition-colors",
            value === o.id
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const ALIGN_OPTIONS = [
  { id: "left" as const, label: "Left" },
  { id: "center" as const, label: "Center" },
  { id: "right" as const, label: "Right" },
]

const SHAPE_OPTIONS: { id: ShapeKind; label: string }[] = [
  { id: "rect", label: "Rect" },
  { id: "ellipse", label: "Ellipse" },
  { id: "triangle", label: "Triangle" },
  { id: "diamond", label: "Diamond" },
  { id: "star", label: "Star" },
  { id: "hexagon", label: "Hexagon" },
]

export function PropertiesPanel() {
  const elements = useDoc((s) => s.elements)
  const selectedIds = useUI((s) => s.selectedIds)
  const defaults = useUI((s) => s.defaults)
  const setDefaults = useUI((s) => s.setDefaults)
  const tool = useUI((s) => s.tool)
  const penVariant = useUI((s) => s.penVariant)

  const selected = elements.filter((el) => selectedIds.includes(el.id))
  const primary = selected[0]
  const kind = primary?.type ?? tool

  const patchSelected = (patch: (el: Element) => Element) => {
    if (selectedIds.length === 0) return
    useDoc.getState().pushHistory()
    useDoc.getState().updateElements(selectedIds, patch)
  }

  const patchType = (type: Element["type"], patch: Record<string, unknown>) => {
    patchSelected((el) => (el.type === type ? ({ ...el, ...patch } as Element) : el))
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-20 z-30 w-64 overflow-hidden rounded-2xl border border-border bg-background/85 shadow-lg backdrop-blur-md">
      <ScrollArea className="max-h-[calc(100vh-12rem)]">
        {selected.length > 0 ? (
          <>
            <Section title={`${primary.type} · ${selected.length} selected`}>
              <SliderField
                label="Opacity"
                value={primary.opacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => patchSelected((el) => ({ ...el, opacity: v }))}
              />
              <SliderField
                label="Rotation"
                value={primary.rotation}
                min={-180}
                max={180}
                suffix="°"
                onChange={(v) => patchSelected((el) => ({ ...el, rotation: v }))}
              />
            </Section>

            {kind === "text" && (
              <Section title="Text">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Font</Label>
                  <Select
                    value={defaults.fontFamily}
                    onValueChange={(v) => {
                      if (!v) return
                      setDefaults({ fontFamily: v })
                      ensureFontLoaded(v)
                      patchType("text", { fontFamily: v })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {FONTS.map((f) => (
                          <SelectItem key={f.family} value={f.family}>
                            {f.family}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <SliderField
                  label="Size"
                  value={primary.type === "text" ? primary.fontSize : defaults.fontSize}
                  min={8}
                  max={200}
                  onChange={(v) => {
                    setDefaults({ fontSize: v })
                    patchType("text", { fontSize: v })
                  }}
                />
                <SliderField
                  label="Weight"
                  value={primary.type === "text" ? primary.fontWeight : defaults.fontWeight}
                  min={100}
                  max={900}
                  step={100}
                  onChange={(v) => {
                    setDefaults({ fontWeight: v })
                    patchType("text", { fontWeight: v })
                  }}
                />
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Align</Label>
                  <OptionRow
                    options={ALIGN_OPTIONS}
                    value={primary.type === "text" ? primary.align : defaults.textAlign}
                    onChange={(v) => {
                      setDefaults({ textAlign: v })
                      patchType("text", { align: v })
                    }}
                  />
                </div>
                <ColorField
                  label="Color"
                  value={primary.type === "text" ? primary.color : defaults.color}
                  onChange={(v) => {
                    setDefaults({ color: v })
                    patchType("text", { color: v })
                  }}
                />
              </Section>
            )}

            {kind === "shape" && (
              <Section title="Shape">
                <OptionRow
                  options={SHAPE_OPTIONS}
                  value={primary.type === "shape" ? primary.shape : defaults.shapeKind}
                  onChange={(v) => {
                    setDefaults({ shapeKind: v })
                    patchType("shape", { shape: v })
                  }}
                />
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Filled</Label>
                  <Switch
                    checked={primary.type === "shape" ? primary.filled : defaults.filled}
                    onCheckedChange={(v) => {
                      setDefaults({ filled: v })
                      patchType("shape", { filled: v })
                    }}
                  />
                </div>
                <ColorField
                  label="Fill"
                  value={primary.type === "shape" ? primary.fill : defaults.fill}
                  onChange={(v) => {
                    setDefaults({ fill: v })
                    patchType("shape", { fill: v })
                  }}
                />
                <ColorField
                  label="Stroke"
                  value={primary.type === "shape" ? primary.stroke : defaults.color}
                  onChange={(v) => {
                    setDefaults({ color: v })
                    patchType("shape", { stroke: v })
                  }}
                />
                <SliderField
                  label="Stroke width"
                  value={primary.type === "shape" ? primary.strokeWidth : defaults.strokeWidth}
                  min={0}
                  max={40}
                  onChange={(v) => {
                    setDefaults({ strokeWidth: v })
                    patchType("shape", { strokeWidth: v })
                  }}
                />
                <SliderField
                  label="Corner radius"
                  value={primary.type === "shape" ? primary.radius : defaults.cornerRadius}
                  min={0}
                  max={80}
                  onChange={(v) => {
                    setDefaults({ cornerRadius: v })
                    patchType("shape", { radius: v })
                  }}
                />
              </Section>
            )}

            {kind === "line" && (
              <Section title="Line">
                <ColorField
                  label="Color"
                  value={primary.type === "line" ? primary.color : defaults.color}
                  onChange={(v) => {
                    setDefaults({ color: v })
                    patchType("line", { color: v })
                  }}
                />
                <SliderField
                  label="Weight"
                  value={primary.type === "line" ? primary.strokeWidth : defaults.strokeWidth}
                  min={1}
                  max={40}
                  onChange={(v) => {
                    setDefaults({ strokeWidth: v })
                    patchType("line", { strokeWidth: v })
                  }}
                />
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Start arrow</Label>
                  <Switch
                    checked={primary.type === "line" ? primary.arrowStart : defaults.arrowStart}
                    onCheckedChange={(v) => {
                      setDefaults({ arrowStart: v })
                      patchType("line", { arrowStart: v })
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">End arrow</Label>
                  <Switch
                    checked={primary.type === "line" ? primary.arrowEnd : defaults.arrowEnd}
                    onCheckedChange={(v) => {
                      setDefaults({ arrowEnd: v })
                      patchType("line", { arrowEnd: v })
                    }}
                  />
                </div>
              </Section>
            )}

            {kind === "icon" && (
              <Section title="Icon">
                <IconPicker
                  lib={primary.type === "icon" ? primary.lib : defaults.iconLib}
                  name={primary.type === "icon" ? primary.name : defaults.iconName}
                  color={primary.type === "icon" ? primary.color : defaults.color}
                  onChange={(lib, name) => {
                    setDefaults({ iconLib: lib, iconName: name })
                    patchType("icon", { lib, name })
                  }}
                />
                <ColorField
                  label="Color"
                  value={primary.type === "icon" ? primary.color : defaults.color}
                  onChange={(v) => {
                    setDefaults({ color: v })
                    patchType("icon", { color: v })
                  }}
                />
                <SliderField
                  label="Stroke width"
                  value={primary.type === "icon" ? primary.strokeWidth : defaults.iconStrokeWidth}
                  min={0.5}
                  max={6}
                  step={0.25}
                  onChange={(v) => {
                    setDefaults({ iconStrokeWidth: v })
                    patchType("icon", { strokeWidth: v })
                  }}
                />
              </Section>
            )}

            {kind === "image" && (
              <Section title="Image">
                <SliderField
                  label="Corner radius"
                  value={primary.type === "image" ? primary.radius : 0}
                  min={0}
                  max={200}
                  onChange={(v) => patchType("image", { radius: v })}
                />
              </Section>
            )}
          </>
        ) : (
          <>
            <Section title="Quick tips">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pick a tool on the right and draw. Drag a box to select, or click an item. Hold
                Space to pan, Ctrl/⌘ + scroll to zoom.
              </p>
            </Section>
            {tool === "text" && (
              <Section title="Text defaults">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Font</Label>
                  <Select
                    value={defaults.fontFamily}
                    onValueChange={(v) => {
                      if (!v) return
                      setDefaults({ fontFamily: v })
                      ensureFontLoaded(v)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {FONTS.map((f) => (
                          <SelectItem key={f.family} value={f.family}>
                            {f.family}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <SliderField
                  label="Size"
                  value={defaults.fontSize}
                  min={8}
                  max={200}
                  onChange={(v) => setDefaults({ fontSize: v })}
                />
                <SliderField
                  label="Weight"
                  value={defaults.fontWeight}
                  min={100}
                  max={900}
                  step={100}
                  onChange={(v) => setDefaults({ fontWeight: v })}
                />
                <OptionRow
                  options={ALIGN_OPTIONS}
                  value={defaults.textAlign}
                  onChange={(v) => setDefaults({ textAlign: v })}
                />
                <ColorField
                  label="Color"
                  value={defaults.color}
                  onChange={(v) => setDefaults({ color: v })}
                />
              </Section>
            )}
            {tool === "shape" && (
              <Section title="Shape defaults">
                <OptionRow
                  options={SHAPE_OPTIONS}
                  value={defaults.shapeKind}
                  onChange={(v) => setDefaults({ shapeKind: v })}
                />
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Filled</Label>
                  <Switch
                    checked={defaults.filled}
                    onCheckedChange={(v) => setDefaults({ filled: v })}
                  />
                </div>
                <ColorField
                  label="Fill"
                  value={defaults.fill}
                  onChange={(v) => setDefaults({ fill: v })}
                />
                <ColorField
                  label="Stroke"
                  value={defaults.color}
                  onChange={(v) => setDefaults({ color: v })}
                />
                <SliderField
                  label="Stroke width"
                  value={defaults.strokeWidth}
                  min={0}
                  max={40}
                  onChange={(v) => setDefaults({ strokeWidth: v })}
                />
              </Section>
            )}
            {tool === "line" && (
              <Section title="Line defaults">
                <ColorField
                  label="Color"
                  value={defaults.color}
                  onChange={(v) => setDefaults({ color: v })}
                />
                <SliderField
                  label="Weight"
                  value={defaults.strokeWidth}
                  min={1}
                  max={40}
                  onChange={(v) => setDefaults({ strokeWidth: v })}
                />
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Start arrow</Label>
                  <Switch
                    checked={defaults.arrowStart}
                    onCheckedChange={(v) => setDefaults({ arrowStart: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">End arrow</Label>
                  <Switch
                    checked={defaults.arrowEnd}
                    onCheckedChange={(v) => setDefaults({ arrowEnd: v })}
                  />
                </div>
              </Section>
            )}
            {tool === "icon" && (
              <Section title="Icon defaults">
                <IconPicker
                  lib={defaults.iconLib}
                  name={defaults.iconName}
                  color={defaults.color}
                  onChange={(lib, name) => setDefaults({ iconLib: lib, iconName: name })}
                />
                <ColorField
                  label="Color"
                  value={defaults.color}
                  onChange={(v) => setDefaults({ color: v })}
                />
                <SliderField
                  label="Stroke width"
                  value={defaults.iconStrokeWidth}
                  min={0.5}
                  max={6}
                  step={0.25}
                  onChange={(v) => setDefaults({ iconStrokeWidth: v })}
                />
              </Section>
            )}
            {tool === "pen" && (
              <Section title="Pen defaults">
                <ColorField
                  label="Color"
                  value={penVariant === "highlighter" ? defaults.fill : defaults.color}
                  onChange={(v) =>
                    setDefaults(penVariant === "highlighter" ? { fill: v } : { color: v })
                  }
                />
                <SliderField
                  label="Pen width"
                  value={defaults.penWidth}
                  min={1}
                  max={40}
                  onChange={(v) => setDefaults({ penWidth: v })}
                />
                <SliderField
                  label="Highlighter width"
                  value={defaults.highlighterWidth}
                  min={4}
                  max={60}
                  onChange={(v) => setDefaults({ highlighterWidth: v })}
                />
              </Section>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  )
}
