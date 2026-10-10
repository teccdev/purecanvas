import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useDoc } from "@/store/useDoc";
import { useUI } from "@/store/useUI";
import { FONTS, ensureFontLoaded } from "@/lib/fonts";
import {
    ArrowDown,
    ArrowDownToLine,
    ArrowUp,
    ArrowUpToLine,
    Group,
    ImageIcon,
    Plus,
    Trash2,
    Ungroup,
} from "lucide-react";
import { IconPicker } from "./IconPicker";
import { StockImagePanel } from "./StockImagePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type {
    Element,
    GradientFill,
    GradientStop,
    GradientType,
    Shadow,
    ShapeKind,
} from "@/lib/types";
import { defaultGradient, gradientCss, makeStopColor } from "@/lib/gradient";
import { defaultShadow } from "@/lib/shadow";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-b border-border px-3 py-3 last:border-b-0">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {title}
            </p>
            {children}
        </div>
    );
}

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    // Native color pickers fire input events faster than frames; coalesce to
    // one update per frame so dragging a color stays smooth.
    const rafRef = useRef(0);
    const pendingRef = useRef<string | null>(null);
    const flushRef = useRef<() => void>(() => {});

    const flush = useCallback(() => {
        rafRef.current = 0;
        const v = pendingRef.current;
        pendingRef.current = null;
        if (v !== null) onChange(v);
    }, [onChange]);

    useEffect(() => {
        flushRef.current = flush;
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [flush]);

    const handleLive = useCallback((v: string) => {
        pendingRef.current = v;
        if (!rafRef.current)
            rafRef.current = requestAnimationFrame(() => flushRef.current());
    }, []);

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
                    <span
                        className="absolute inset-0"
                        style={{ background: value }}
                    />
                    <input
                        type="color"
                        value={
                            /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"
                        }
                        onInput={(e) => handleLive(e.currentTarget.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                    />
                </label>
            </div>
        </div>
    );
}

function FontSelect({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <Select
            value={value}
            onValueChange={(v) => {
                if (!v) return;
                onChange(v);
            }}
            onOpenChange={(open) => {
                // Load every family so dropdown items can preview their own font.
                if (open)
                    for (const f of FONTS)
                        ensureFontLoaded(f.family, f.weights);
            }}
        >
            <SelectTrigger className="w-full">
                <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                    {FONTS.map((f) => (
                        <SelectItem key={f.family} value={f.family}>
                            <span
                                style={{
                                    fontFamily: `"${f.family}", sans-serif`,
                                }}
                            >
                                {f.family}
                            </span>
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
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
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    onChange: (v: number) => void;
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
                    const next = Array.isArray(v) ? v[0] : v;
                    if (typeof next === "number") onChange(next);
                }}
            />
        </div>
    );
}

function OptionRow<T extends string>({
    options,
    value,
    onChange,
}: {
    options: { id: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
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
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

const ALIGN_OPTIONS = [
    { id: "left" as const, label: "Left" },
    { id: "center" as const, label: "Center" },
    { id: "right" as const, label: "Right" },
];

const SHAPE_OPTIONS: { id: ShapeKind; label: string }[] = [
    { id: "rect", label: "Rect" },
    { id: "ellipse", label: "Ellipse" },
    { id: "triangle", label: "Triangle" },
    { id: "diamond", label: "Diamond" },
    { id: "star", label: "Star" },
    { id: "hexagon", label: "Hexagon" },
];

type FillMode = "solid" | GradientType;

const FILL_MODE_OPTIONS: { id: FillMode; label: string }[] = [
    { id: "solid", label: "Solid" },
    { id: "linear", label: "Linear" },
    { id: "radial", label: "Radial" },
];

function GradientEditor({
    gradient,
    onChange,
    onCommit,
}: {
    gradient: GradientFill;
    onChange: (g: GradientFill) => void;
    onCommit: (g: GradientFill) => void;
}) {
    const stops = gradient.stops;
    const setStops = (next: GradientStop[], commit = false) => {
        const g = { ...gradient, stops: next };
        if (commit) onCommit(g);
        else onChange(g);
    };
    return (
        <div className="flex flex-col gap-2">
            <span
                className="h-7 rounded-md border border-input"
                style={{ background: gradientCss(gradient) }}
            />
            {gradient.type === "linear" && (
                <SliderField
                    label="Angle"
                    value={gradient.angle}
                    min={0}
                    max={360}
                    suffix="°"
                    onChange={(v) => onChange({ ...gradient, angle: v })}
                />
            )}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                        Stops
                    </Label>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Add gradient stop"
                        title="Add stop"
                        onClick={() => {
                            // Insert into the widest gap so repeated adds spread out.
                            const sorted = [...stops].sort(
                                (a, b) => a.offset - b.offset,
                            );
                            let at = 0.5;
                            let bestGap = -1;
                            for (let i = 0; i < sorted.length - 1; i++) {
                                const gap =
                                    sorted[i + 1].offset - sorted[i].offset;
                                if (gap > bestGap) {
                                    bestGap = gap;
                                    at =
                                        (sorted[i].offset +
                                            sorted[i + 1].offset) /
                                        2;
                                }
                            }
                            const ref =
                                sorted.find((s) => s.offset >= at) ??
                                sorted[sorted.length - 1];
                            setStops(
                                [
                                    ...stops,
                                    {
                                        offset: at,
                                        color: makeStopColor(
                                            ref?.color ?? "#818cf8",
                                        ),
                                    },
                                ].sort((a, b) => a.offset - b.offset),
                                true,
                            );
                        }}
                    >
                        <Plus className="size-3.5" />
                    </Button>
                </div>
                {stops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input">
                            <span
                                className="absolute inset-0"
                                style={{ background: stop.color }}
                            />
                            <input
                                type="color"
                                value={
                                    /^#[0-9a-f]{6}$/i.test(stop.color)
                                        ? stop.color
                                        : "#000000"
                                }
                                onChange={(e) =>
                                    setStops(
                                        stops.map((s, j) =>
                                            j === i
                                                ? {
                                                      ...s,
                                                      color: e.currentTarget
                                                          .value,
                                                  }
                                                : s,
                                        ),
                                    )
                                }
                                className="absolute inset-0 cursor-pointer opacity-0"
                            />
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(stop.offset * 100)}
                            onChange={(e) => {
                                const offset =
                                    Number(e.currentTarget.value) / 100;
                                setStops(
                                    stops.map((s, j) =>
                                        j === i ? { ...s, offset } : s,
                                    ),
                                );
                            }}
                            className="h-1.5 flex-1 cursor-pointer accent-primary"
                            aria-label={`Stop ${i + 1} position`}
                        />
                        <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                            {Math.round(stop.offset * 100)}%
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Remove gradient stop"
                            title="Remove stop"
                            disabled={stops.length <= 2}
                            onClick={() =>
                                setStops(
                                    stops.filter((_, j) => j !== i),
                                    true,
                                )
                            }
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ShapeFillControls({
    fill,
    gradient,
    onFillChange,
    onGradientChange,
    onGradientCommit,
}: {
    fill: string;
    gradient: GradientFill | null;
    onFillChange: (v: string) => void;
    onGradientChange: (g: GradientFill) => void;
    onGradientCommit: (g: GradientFill | null) => void;
}) {
    const mode: FillMode = gradient ? gradient.type : "solid";
    return (
        <>
            <OptionRow
                options={FILL_MODE_OPTIONS}
                value={mode}
                onChange={(next) => {
                    if (next === "solid") {
                        onGradientCommit(null);
                    } else {
                        onGradientCommit(
                            gradient
                                ? { ...gradient, type: next }
                                : defaultGradient(next, fill),
                        );
                    }
                }}
            />
            {mode === "solid" || !gradient ? (
                <ColorField label="Fill" value={fill} onChange={onFillChange} />
            ) : (
                <GradientEditor
                    gradient={gradient}
                    onChange={onGradientChange}
                    onCommit={onGradientCommit}
                />
            )}
        </>
    );
}

/** Element types that support a drop shadow (everything except Pen strokes). */
const SHADOW_KINDS = new Set(["text", "image", "line", "shape", "icon"]);

function ShadowControls({
    shadow,
    onChange,
    onCommit,
}: {
    shadow: Shadow | null;
    onChange: (s: Shadow) => void;
    onCommit: (s: Shadow | null) => void;
}) {
    const enabled = !!shadow;
    const s = shadow ?? defaultShadow();
    return (
        <>
            <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Enabled</Label>
                <Switch
                    checked={enabled}
                    onCheckedChange={(v) =>
                        onCommit(v ? (shadow ?? defaultShadow()) : null)
                    }
                />
            </div>
            {enabled && (
                <>
                    <ColorField
                        label="Color"
                        value={s.color}
                        onChange={(v) => onChange({ ...s, color: v })}
                    />
                    <SliderField
                        label="Blur"
                        value={s.blur}
                        min={0}
                        max={60}
                        onChange={(v) => onChange({ ...s, blur: v })}
                    />
                    <SliderField
                        label="Offset X"
                        value={s.offsetX}
                        min={-60}
                        max={60}
                        onChange={(v) => onChange({ ...s, offsetX: v })}
                    />
                    <SliderField
                        label="Offset Y"
                        value={s.offsetY}
                        min={-60}
                        max={60}
                        onChange={(v) => onChange({ ...s, offsetY: v })}
                    />
                    <SliderField
                        label="Opacity"
                        value={s.opacity}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => onChange({ ...s, opacity: v })}
                    />
                </>
            )}
        </>
    );
}

export function PropertiesPanel() {
    const elements = useDoc((s) => s.elements);
    const selectedIds = useUI((s) => s.selectedIds);
    const defaults = useUI((s) => s.defaults);
    const setDefaults = useUI((s) => s.setDefaults);
    const tool = useUI((s) => s.tool);
    const penVariant = useUI((s) => s.penVariant);

    const selected = elements.filter((el) => selectedIds.includes(el.id));
    const primary = selected[0];
    const kind = primary?.type ?? tool;
    const shapeKind =
        primary?.type === "shape" ? primary.shape : defaults.shapeKind;
    // Google Symbols are filled-path SVGs: stroke width and a separate fill
    // color don't apply, and "rounded" selects the rounded Material family.
    const iconLib = primary?.type === "icon" ? primary.lib : defaults.iconLib;

    // Continuous controls (sliders, color pickers) fire many events per gesture.
    // Push history once per gesture instead of on every frame.
    const gestureRef = useRef<{ key: string; time: number } | null>(null);
    const beginGesture = (key: string) => {
        const now = Date.now();
        const g = gestureRef.current;
        if (!g || g.key !== key || now - g.time > 600) {
            useDoc.getState().pushHistory();
            gestureRef.current = { key, time: now };
        } else {
            g.time = now;
        }
    };
    const patchLive = (key: string, patch: (el: Element) => Element) => {
        if (selectedIds.length === 0) return;
        beginGesture(key);
        useDoc.getState().updateElements(selectedIds, patch);
    };

    const patchSelected = (patch: (el: Element) => Element) => {
        if (selectedIds.length === 0) return;
        useDoc.getState().pushHistory();
        useDoc.getState().updateElements(selectedIds, patch);
    };

    const patchType = (
        type: Element["type"],
        patch: Record<string, unknown>,
    ) => {
        patchSelected((el) =>
            el.type === type ? ({ ...el, ...patch } as Element) : el,
        );
    };

    const patchTypeLive = (
        type: Element["type"],
        key: string,
        patch: Record<string, unknown>,
    ) => {
        patchLive(key, (el) =>
            el.type === type ? ({ ...el, ...patch } as Element) : el,
        );
    };

    // Lines and strokes are point-based; the rotation field does nothing for them.
    const rotationSupported = selected.some(
        (el) => el.type !== "line" && el.type !== "stroke",
    );

    return (
        <div className="pointer-events-auto absolute left-4 top-20 z-30 w-64 max-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-border bg-background/85 shadow-lg backdrop-blur-md">
            <ScrollArea className="max-h-[calc(100dvh-6rem)]">
                {selected.length > 0 ? (
                    <>
                        <Section
                            title={`${
                                selected.length > 1 &&
                                selected.every(
                                    (el) =>
                                        el.groupId &&
                                        el.groupId === selected[0].groupId,
                                )
                                    ? selected[0].groupName || "Group"
                                    : primary.type
                            } · ${selected.length} selected`}
                        >
                            <SliderField
                                label="Opacity"
                                value={primary.opacity}
                                min={0}
                                max={1}
                                step={0.05}
                                onChange={(v) =>
                                    patchLive("opacity", (el) => ({
                                        ...el,
                                        opacity: v,
                                    }))
                                }
                            />
                            {rotationSupported && (
                                <SliderField
                                    label="Rotation"
                                    value={primary.rotation}
                                    min={-180}
                                    max={180}
                                    step={15}
                                    suffix="°"
                                    onChange={(v) =>
                                        patchLive("rotation", (el) => ({
                                            ...el,
                                            rotation: v,
                                        }))
                                    }
                                />
                            )}
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">
                                    Layer
                                </Label>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label="Move layer up"
                                        title="Move up"
                                        onClick={() =>
                                            useDoc
                                                .getState()
                                                .reorderLayers(
                                                    selectedIds,
                                                    "up",
                                                )
                                        }
                                    >
                                        <ArrowUp className="size-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label="Move layer down"
                                        title="Move down"
                                        onClick={() =>
                                            useDoc
                                                .getState()
                                                .reorderLayers(
                                                    selectedIds,
                                                    "down",
                                                )
                                        }
                                    >
                                        <ArrowDown className="size-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label="Move layer to top"
                                        title="Bring to front"
                                        onClick={() =>
                                            useDoc
                                                .getState()
                                                .reorderLayers(
                                                    selectedIds,
                                                    "top",
                                                )
                                        }
                                    >
                                        <ArrowUpToLine className="size-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label="Move layer to bottom"
                                        title="Send to back"
                                        onClick={() =>
                                            useDoc
                                                .getState()
                                                .reorderLayers(
                                                    selectedIds,
                                                    "bottom",
                                                )
                                        }
                                    >
                                        <ArrowDownToLine className="size-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 flex-1 text-xs"
                                    disabled={selected.length < 2}
                                    title="Group (Ctrl+G)"
                                    onClick={() =>
                                        useDoc
                                            .getState()
                                            .groupElements(selectedIds)
                                    }
                                >
                                    <Group className="size-3.5" />
                                    Group
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 flex-1 text-xs"
                                    disabled={
                                        !selected.some((el) => el.groupId)
                                    }
                                    title="Ungroup (Ctrl+Shift+G)"
                                    onClick={() =>
                                        useDoc
                                            .getState()
                                            .ungroupElements(selectedIds)
                                    }
                                >
                                    <Ungroup className="size-3.5" />
                                    Ungroup
                                </Button>
                            </div>
                        </Section>

                        {kind === "text" && (
                            <Section title="Text">
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Font
                                    </Label>
                                    <FontSelect
                                        value={
                                            primary.type === "text"
                                                ? primary.fontFamily
                                                : defaults.fontFamily
                                        }
                                        onChange={(v) => {
                                            setDefaults({ fontFamily: v });
                                            ensureFontLoaded(v);
                                            patchType("text", {
                                                fontFamily: v,
                                            });
                                        }}
                                    />
                                </div>
                                <SliderField
                                    label="Size"
                                    value={
                                        primary.type === "text"
                                            ? primary.fontSize
                                            : defaults.fontSize
                                    }
                                    min={8}
                                    max={200}
                                    onChange={(v) => {
                                        setDefaults({ fontSize: v });
                                        patchTypeLive("text", "fontSize", {
                                            fontSize: v,
                                        });
                                    }}
                                />
                                <SliderField
                                    label="Weight"
                                    value={
                                        primary.type === "text"
                                            ? primary.fontWeight
                                            : defaults.fontWeight
                                    }
                                    min={100}
                                    max={900}
                                    step={100}
                                    onChange={(v) => {
                                        setDefaults({ fontWeight: v });
                                        patchTypeLive("text", "fontWeight", {
                                            fontWeight: v,
                                        });
                                    }}
                                />
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Align
                                    </Label>
                                    <OptionRow
                                        options={ALIGN_OPTIONS}
                                        value={
                                            primary.type === "text"
                                                ? primary.align
                                                : defaults.textAlign
                                        }
                                        onChange={(v) => {
                                            setDefaults({ textAlign: v });
                                            patchType("text", { align: v });
                                        }}
                                    />
                                </div>
                                <ColorField
                                    label="Color"
                                    value={
                                        primary.type === "text"
                                            ? primary.color
                                            : defaults.color
                                    }
                                    onChange={(v) => {
                                        setDefaults({ color: v });
                                        patchTypeLive("text", "color", {
                                            color: v,
                                        });
                                    }}
                                />
                                <ColorField
                                    label="Outline"
                                    value={
                                        primary.type === "text"
                                            ? (primary.stroke ??
                                              defaults.textStroke)
                                            : defaults.textStroke
                                    }
                                    onChange={(v) => {
                                        setDefaults({ textStroke: v });
                                        patchTypeLive("text", "stroke", {
                                            stroke: v,
                                        });
                                    }}
                                />
                                <SliderField
                                    label="Outline width"
                                    value={
                                        primary.type === "text"
                                            ? (primary.strokeWidth ?? 0)
                                            : defaults.textStrokeWidth
                                    }
                                    min={0}
                                    max={20}
                                    step={0.5}
                                    onChange={(v) => {
                                        setDefaults({ textStrokeWidth: v });
                                        patchTypeLive("text", "strokeWidth", {
                                            strokeWidth: v,
                                        });
                                    }}
                                />
                            </Section>
                        )}

                        {kind === "shape" && (
                            <Section title="Shape">
                                <OptionRow
                                    options={SHAPE_OPTIONS}
                                    value={shapeKind}
                                    onChange={(v) => {
                                        setDefaults({ shapeKind: v });
                                        patchType("shape", { shape: v });
                                    }}
                                />
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        Filled
                                    </Label>
                                    <Switch
                                        checked={
                                            primary.type === "shape"
                                                ? primary.filled
                                                : defaults.filled
                                        }
                                        onCheckedChange={(v) => {
                                            setDefaults({ filled: v });
                                            patchType("shape", { filled: v });
                                        }}
                                    />
                                </div>
                                <ShapeFillControls
                                    fill={
                                        primary.type === "shape"
                                            ? primary.fill
                                            : defaults.fill
                                    }
                                    gradient={
                                        primary.type === "shape"
                                            ? (primary.gradient ?? null)
                                            : defaults.gradient
                                    }
                                    onFillChange={(v) => {
                                        setDefaults({ fill: v });
                                        patchTypeLive("shape", "fill", {
                                            fill: v,
                                        });
                                    }}
                                    onGradientChange={(g) => {
                                        setDefaults({ gradient: g });
                                        patchLive("gradient", (el) =>
                                            el.type === "shape"
                                                ? { ...el, gradient: g }
                                                : el,
                                        );
                                    }}
                                    onGradientCommit={(g) => {
                                        setDefaults({ gradient: g });
                                        patchSelected((el) =>
                                            el.type === "shape"
                                                ? { ...el, gradient: g }
                                                : el,
                                        );
                                    }}
                                />
                                <ColorField
                                    label="Stroke"
                                    value={
                                        primary.type === "shape"
                                            ? primary.stroke
                                            : defaults.color
                                    }
                                    onChange={(v) => {
                                        setDefaults({ color: v });
                                        patchTypeLive("shape", "stroke", {
                                            stroke: v,
                                        });
                                    }}
                                />
                                <SliderField
                                    label="Stroke width"
                                    value={
                                        primary.type === "shape"
                                            ? primary.strokeWidth
                                            : defaults.strokeWidth
                                    }
                                    min={0}
                                    max={40}
                                    onChange={(v) => {
                                        setDefaults({ strokeWidth: v });
                                        patchTypeLive("shape", "strokeWidth", {
                                            strokeWidth: v,
                                        });
                                    }}
                                />
                                {shapeKind !== "ellipse" && (
                                    <SliderField
                                        label="Corner radius"
                                        value={
                                            primary.type === "shape"
                                                ? primary.radius
                                                : defaults.cornerRadius
                                        }
                                        min={0}
                                        max={80}
                                        onChange={(v) => {
                                            setDefaults({ cornerRadius: v });
                                            patchTypeLive("shape", "radius", {
                                                radius: v,
                                            });
                                        }}
                                    />
                                )}
                            </Section>
                        )}

                        {kind === "line" && (
                            <Section title="Line">
                                <ColorField
                                    label="Color"
                                    value={
                                        primary.type === "line"
                                            ? primary.color
                                            : defaults.color
                                    }
                                    onChange={(v) => {
                                        setDefaults({ color: v });
                                        patchTypeLive("line", "color", {
                                            color: v,
                                        });
                                    }}
                                />
                                <SliderField
                                    label="Weight"
                                    value={
                                        primary.type === "line"
                                            ? primary.strokeWidth
                                            : defaults.strokeWidth
                                    }
                                    min={1}
                                    max={40}
                                    onChange={(v) => {
                                        setDefaults({ strokeWidth: v });
                                        patchTypeLive("line", "strokeWidth", {
                                            strokeWidth: v,
                                        });
                                    }}
                                />
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        Start arrow
                                    </Label>
                                    <Switch
                                        checked={
                                            primary.type === "line"
                                                ? primary.arrowStart
                                                : defaults.arrowStart
                                        }
                                        onCheckedChange={(v) => {
                                            setDefaults({ arrowStart: v });
                                            patchType("line", {
                                                arrowStart: v,
                                            });
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        End arrow
                                    </Label>
                                    <Switch
                                        checked={
                                            primary.type === "line"
                                                ? primary.arrowEnd
                                                : defaults.arrowEnd
                                        }
                                        onCheckedChange={(v) => {
                                            setDefaults({ arrowEnd: v });
                                            patchType("line", { arrowEnd: v });
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        Rounded ends
                                    </Label>
                                    <Switch
                                        checked={
                                            primary.type === "line"
                                                ? (primary.rounded ?? true)
                                                : defaults.lineRounded
                                        }
                                        onCheckedChange={(v) => {
                                            setDefaults({ lineRounded: v });
                                            patchType("line", { rounded: v });
                                        }}
                                    />
                                </div>
                            </Section>
                        )}

                        {kind === "icon" && (
                            <Section title="Icon">
                                <IconPicker
                                    lib={
                                        primary.type === "icon"
                                            ? primary.lib
                                            : defaults.iconLib
                                    }
                                    name={
                                        primary.type === "icon"
                                            ? primary.name
                                            : defaults.iconName
                                    }
                                    onChange={(lib, name) => {
                                        setDefaults({
                                            iconLib: lib,
                                            iconName: name,
                                        });
                                        patchType("icon", { lib, name });
                                    }}
                                />
                                <ColorField
                                    label="Color"
                                    value={
                                        primary.type === "icon"
                                            ? primary.color
                                            : defaults.color
                                    }
                                    onChange={(v) => {
                                        setDefaults({ color: v });
                                        patchTypeLive("icon", "color", {
                                            color: v,
                                        });
                                    }}
                                />
                                {iconLib === "lucide" && (
                                    <SliderField
                                        label="Stroke width"
                                        value={
                                            primary.type === "icon"
                                                ? primary.strokeWidth
                                                : defaults.iconStrokeWidth
                                        }
                                        min={0}
                                        max={6}
                                        step={0.25}
                                        onChange={(v) => {
                                            setDefaults({ iconStrokeWidth: v });
                                            patchTypeLive(
                                                "icon",
                                                "strokeWidth",
                                                { strokeWidth: v },
                                            );
                                        }}
                                    />
                                )}
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        Filled
                                    </Label>
                                    <Switch
                                        checked={
                                            primary.type === "icon"
                                                ? (primary.filled ?? false)
                                                : defaults.iconFilled
                                        }
                                        onCheckedChange={(v) => {
                                            setDefaults({ iconFilled: v });
                                            patchType("icon", { filled: v });
                                        }}
                                    />
                                </div>
                                {iconLib === "lucide" && (
                                    <ColorField
                                        label="Fill color"
                                        value={
                                            primary.type === "icon"
                                                ? (primary.fill ??
                                                  defaults.iconFill)
                                                : defaults.iconFill
                                        }
                                        onChange={(v) => {
                                            setDefaults({ iconFill: v });
                                            patchTypeLive("icon", "fill", {
                                                fill: v,
                                            });
                                        }}
                                    />
                                )}
                                {iconLib === "material" && (
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-muted-foreground">
                                            Rounded
                                        </Label>
                                        <Switch
                                            checked={
                                                primary.type === "icon"
                                                    ? primary.rounded === true
                                                    : defaults.iconRounded
                                            }
                                            onCheckedChange={(v) => {
                                                setDefaults({ iconRounded: v });
                                                patchType("icon", {
                                                    rounded: v,
                                                });
                                            }}
                                        />
                                    </div>
                                )}
                            </Section>
                        )}

                        {kind === "image" && (
                            <Section title="Image">
                                <SliderField
                                    label="Corner radius"
                                    value={
                                        primary.type === "image"
                                            ? primary.radius
                                            : 0
                                    }
                                    min={0}
                                    max={200}
                                    onChange={(v) =>
                                        patchTypeLive("image", "radius", {
                                            radius: v,
                                        })
                                    }
                                />
                                <ColorField
                                    label="Outline"
                                    value={
                                        primary.type === "image"
                                            ? (primary.stroke ??
                                              defaults.imageStroke)
                                            : defaults.imageStroke
                                    }
                                    onChange={(v) => {
                                        setDefaults({ imageStroke: v });
                                        patchTypeLive("image", "stroke", {
                                            stroke: v,
                                        });
                                    }}
                                />
                                <SliderField
                                    label="Outline width"
                                    value={
                                        primary.type === "image"
                                            ? (primary.strokeWidth ?? 0)
                                            : defaults.imageStrokeWidth
                                    }
                                    min={0}
                                    max={40}
                                    onChange={(v) => {
                                        setDefaults({ imageStrokeWidth: v });
                                        patchTypeLive("image", "strokeWidth", {
                                            strokeWidth: v,
                                        });
                                    }}
                                />
                            </Section>
                        )}

                        {SHADOW_KINDS.has(kind) && (
                            <Section title="Shadow">
                                <ShadowControls
                                    shadow={primary.shadow ?? null}
                                    onChange={(s) => {
                                        setDefaults({ shadow: s });
                                        patchLive("shadow", (el) =>
                                            el.type === "stroke"
                                                ? el
                                                : { ...el, shadow: s },
                                        );
                                    }}
                                    onCommit={(s) => {
                                        setDefaults({ shadow: s });
                                        patchSelected((el) =>
                                            el.type === "stroke"
                                                ? el
                                                : { ...el, shadow: s },
                                        );
                                    }}
                                />
                            </Section>
                        )}
                    </>
                ) : (
                    <>
                        {tool === "select" && (
                            <Section title="Welcome to PureCanvas!">
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                    Pick a tool on the right to start creating.
                                    <ul className="list-disc ml-4">
                                        <li>
                                            Select items by left-clicking or
                                            drawing a box around them.
                                        </li>
                                        <li>
                                            Scroll to zoom and drag with middle
                                            mouse button to pan.
                                        </li>
                                    </ul>
                                </p>
                            </Section>
                        )}
                        {tool === "text" && (
                            <Section title="Text defaults">
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Font
                                    </Label>
                                    <FontSelect
                                        value={defaults.fontFamily}
                                        onChange={(v) => {
                                            setDefaults({ fontFamily: v });
                                            ensureFontLoaded(v);
                                        }}
                                    />
                                </div>
                                <SliderField
                                    label="Size"
                                    value={defaults.fontSize}
                                    min={8}
                                    max={200}
                                    onChange={(v) =>
                                        setDefaults({ fontSize: v })
                                    }
                                />
                                <SliderField
                                    label="Weight"
                                    value={defaults.fontWeight}
                                    min={100}
                                    max={900}
                                    step={100}
                                    onChange={(v) =>
                                        setDefaults({ fontWeight: v })
                                    }
                                />
                                <OptionRow
                                    options={ALIGN_OPTIONS}
                                    value={defaults.textAlign}
                                    onChange={(v) =>
                                        setDefaults({ textAlign: v })
                                    }
                                />
                                <ColorField
                                    label="Color"
                                    value={defaults.color}
                                    onChange={(v) => setDefaults({ color: v })}
                                />
                                <ColorField
                                    label="Outline"
                                    value={defaults.textStroke}
                                    onChange={(v) =>
                                        setDefaults({ textStroke: v })
                                    }
                                />
                                <SliderField
                                    label="Outline width"
                                    value={defaults.textStrokeWidth}
                                    min={0}
                                    max={20}
                                    step={0.5}
                                    onChange={(v) =>
                                        setDefaults({ textStrokeWidth: v })
                                    }
                                />
                            </Section>
                        )}
                        {tool === "shape" && (
                            <Section title="Shape defaults">
                                <OptionRow
                                    options={SHAPE_OPTIONS}
                                    value={defaults.shapeKind}
                                    onChange={(v) =>
                                        setDefaults({ shapeKind: v })
                                    }
                                />
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        Filled
                                    </Label>
                                    <Switch
                                        checked={defaults.filled}
                                        onCheckedChange={(v) =>
                                            setDefaults({ filled: v })
                                        }
                                    />
                                </div>
                                <ShapeFillControls
                                    fill={defaults.fill}
                                    gradient={defaults.gradient}
                                    onFillChange={(v) =>
                                        setDefaults({ fill: v })
                                    }
                                    onGradientChange={(g) =>
                                        setDefaults({ gradient: g })
                                    }
                                    onGradientCommit={(g) =>
                                        setDefaults({ gradient: g })
                                    }
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
                                    onChange={(v) =>
                                        setDefaults({ strokeWidth: v })
                                    }
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
                                    onChange={(v) =>
                                        setDefaults({ strokeWidth: v })
                                    }
                                />
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        Start arrow
                                    </Label>
                                    <Switch
                                        checked={defaults.arrowStart}
                                        onCheckedChange={(v) =>
                                            setDefaults({ arrowStart: v })
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        End arrow
                                    </Label>
                                    <Switch
                                        checked={defaults.arrowEnd}
                                        onCheckedChange={(v) =>
                                            setDefaults({ arrowEnd: v })
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        Rounded ends
                                    </Label>
                                    <Switch
                                        checked={defaults.lineRounded}
                                        onCheckedChange={(v) =>
                                            setDefaults({ lineRounded: v })
                                        }
                                    />
                                </div>
                            </Section>
                        )}
                        {tool === "icon" && (
                            <Section title="Icon defaults">
                                <IconPicker
                                    lib={defaults.iconLib}
                                    name={defaults.iconName}
                                    onChange={(lib, name) =>
                                        setDefaults({
                                            iconLib: lib,
                                            iconName: name,
                                        })
                                    }
                                />
                                <ColorField
                                    label="Color"
                                    value={defaults.color}
                                    onChange={(v) => setDefaults({ color: v })}
                                />
                                {defaults.iconLib === "lucide" && (
                                    <SliderField
                                        label="Stroke width"
                                        value={defaults.iconStrokeWidth}
                                        min={0}
                                        max={6}
                                        step={0.25}
                                        onChange={(v) =>
                                            setDefaults({ iconStrokeWidth: v })
                                        }
                                    />
                                )}
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        Filled
                                    </Label>
                                    <Switch
                                        checked={defaults.iconFilled}
                                        onCheckedChange={(v) =>
                                            setDefaults({ iconFilled: v })
                                        }
                                    />
                                </div>
                                {defaults.iconLib === "lucide" && (
                                    <ColorField
                                        label="Fill color"
                                        value={defaults.iconFill}
                                        onChange={(v) =>
                                            setDefaults({ iconFill: v })
                                        }
                                    />
                                )}
                                {defaults.iconLib === "material" && (
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-muted-foreground">
                                            Rounded
                                        </Label>
                                        <Switch
                                            checked={defaults.iconRounded}
                                            onCheckedChange={(v) =>
                                                setDefaults({ iconRounded: v })
                                            }
                                        />
                                    </div>
                                )}
                            </Section>
                        )}
                        {tool === "image" && (
                            <>
                                <Section title="Stock images">
                                    <StockImagePanel />
                                </Section>
                                <Section title="Upload">
                                    <button
                                        onClick={() =>
                                            window.dispatchEvent(
                                                new CustomEvent(
                                                    "open-image-upload",
                                                ),
                                            )
                                        }
                                        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/50 px-3 py-6 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                                    >
                                        <ImageIcon className="size-4" />
                                        Upload image from device
                                    </button>
                                </Section>
                                <Section title="Image defaults">
                                    <ColorField
                                        label="Outline"
                                        value={defaults.imageStroke}
                                        onChange={(v) =>
                                            setDefaults({ imageStroke: v })
                                        }
                                    />
                                    <SliderField
                                        label="Outline width"
                                        value={defaults.imageStrokeWidth}
                                        min={0}
                                        max={40}
                                        onChange={(v) =>
                                            setDefaults({ imageStrokeWidth: v })
                                        }
                                    />
                                </Section>
                            </>
                        )}
                        {SHADOW_KINDS.has(tool) && (
                            <Section title="Shadow defaults">
                                <ShadowControls
                                    shadow={defaults.shadow}
                                    onChange={(s) => setDefaults({ shadow: s })}
                                    onCommit={(s) => setDefaults({ shadow: s })}
                                />
                            </Section>
                        )}
                        {tool === "pen" && (
                            <Section title="Pen defaults">
                                <ColorField
                                    label="Color"
                                    value={
                                        penVariant === "highlighter"
                                            ? defaults.fill
                                            : defaults.color
                                    }
                                    onChange={(v) =>
                                        setDefaults(
                                            penVariant === "highlighter"
                                                ? { fill: v }
                                                : { color: v },
                                        )
                                    }
                                />
                                <SliderField
                                    label="Pen width"
                                    value={defaults.penWidth}
                                    min={1}
                                    max={40}
                                    onChange={(v) =>
                                        setDefaults({ penWidth: v })
                                    }
                                />
                                <SliderField
                                    label="Highlighter width"
                                    value={defaults.highlighterWidth}
                                    min={4}
                                    max={60}
                                    onChange={(v) =>
                                        setDefaults({ highlighterWidth: v })
                                    }
                                />
                            </Section>
                        )}
                    </>
                )}
            </ScrollArea>
        </div>
    );
}
