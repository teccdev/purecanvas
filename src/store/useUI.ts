import { create } from "zustand";
import type { GradientFill, PenVariant, Shadow, ShapeKind, Tool } from "@/lib/types";

export type Theme = "dark" | "light";
export type ExportBackground = "transparent" | "theme" | "white" | "black";
export type ExportPadding = "normal" | "small" | "none";
export type ExportScope = "all" | "selection";
export type ExportFormat = "png" | "webp" | "svg";

interface Defaults {
    color: string;
    fill: string;
    /** Gradient applied to new shapes; null means solid fill. */
    gradient: GradientFill | null;
    /** Drop shadow applied to new elements (all but Pen strokes); null means none. */
    shadow: Shadow | null;
    strokeWidth: number;
    filled: boolean;
    cornerRadius: number;
    shapeKind: ShapeKind;
    penWidth: number;
    highlighterWidth: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    textAlign: "left" | "center" | "right";
    arrowStart: boolean;
    arrowEnd: boolean;
    lineRounded: boolean;
    iconLib: "lucide" | "material";
    iconName: string;
    iconStrokeWidth: number;
    iconFilled: boolean;
    iconFill: string;
    iconRounded: boolean;
    textStroke: string;
    textStrokeWidth: number;
    imageStroke: string;
    imageStrokeWidth: number;
}

interface UIState {
    theme: Theme;
    tool: Tool;
    penVariant: PenVariant;
    selectedIds: string[];
    editingTextId: string | null;
    defaults: Defaults;
    layersOpen: boolean;
    exportBackground: ExportBackground;
    exportPadding: ExportPadding;
    exportScope: ExportScope;
    exportFormat: ExportFormat;
    zoomRequest: { value: number; nonce: number } | null;

    setTheme: (t: Theme) => void;
    toggleTheme: () => void;
    setTool: (t: Tool) => void;
    setPenVariant: (v: PenVariant) => void;
    setSelection: (ids: string[]) => void;
    addToSelection: (ids: string[]) => void;
    toggleSelection: (id: string) => void;
    clearSelection: () => void;
    setEditingText: (id: string | null) => void;
    setDefaults: (patch: Partial<Defaults>) => void;
    setLayersOpen: (open: boolean) => void;
    setExportBackground: (b: ExportBackground) => void;
    setExportPadding: (p: ExportPadding) => void;
    setExportScope: (scope: ExportScope) => void;
    setExportFormat: (format: ExportFormat) => void;
    requestZoom: (value: number) => void;
}

const initialDefaults: Defaults = {
    color: "#e5e7eb",
    fill: "#818cf8",
    gradient: null,
    shadow: null,
    strokeWidth: 3,
    filled: true,
    cornerRadius: 8,
    shapeKind: "rect",
    penWidth: 4,
    highlighterWidth: 18,
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: 600,
    textAlign: "left",
    arrowStart: false,
    arrowEnd: false,
    lineRounded: true,
    iconLib: "lucide",
    iconName: "Star",
    iconStrokeWidth: 2,
    iconFilled: false,
    iconFill: "#818cf8",
    iconRounded: false,
    textStroke: "#111827",
    textStrokeWidth: 0,
    imageStroke: "#111827",
    imageStrokeWidth: 0,
};

function readStoredTheme(): Theme | null {
    try {
        const saved = localStorage.getItem("purecanvas-theme");
        return saved === "light" || saved === "dark" ? saved : null;
    } catch {
        return null;
    }
}

function storeTheme(theme: Theme): void {
    try {
        localStorage.setItem("purecanvas-theme", theme);
    } catch {
        /* storage unavailable (private mode / blocked) */
    }
}

function getInitialTheme(): Theme {
    return readStoredTheme() ?? "dark";
}

const EXPORT_BACKGROUNDS: ExportBackground[] = [
    "transparent",
    "theme",
    "white",
    "black",
];
const EXPORT_PADDING_VALUES: ExportPadding[] = ["normal", "small", "none"];
const EXPORT_SCOPES: ExportScope[] = ["all", "selection"];
const EXPORT_FORMATS: ExportFormat[] = ["png", "webp", "svg"];

interface StoredExport {
    background?: ExportBackground;
    padding?: ExportPadding;
    scope?: ExportScope;
    format?: ExportFormat;
}

function readStoredExport(): StoredExport {
    try {
        const raw = localStorage.getItem("purecanvas-export");
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<StoredExport>;
        return {
            background: EXPORT_BACKGROUNDS.includes(
                parsed.background as ExportBackground
            )
                ? (parsed.background as ExportBackground)
                : undefined,
            padding: EXPORT_PADDING_VALUES.includes(parsed.padding as ExportPadding)
                ? (parsed.padding as ExportPadding)
                : undefined,
            scope: EXPORT_SCOPES.includes(parsed.scope as ExportScope)
                ? (parsed.scope as ExportScope)
                : undefined,
            format: EXPORT_FORMATS.includes(parsed.format as ExportFormat)
                ? (parsed.format as ExportFormat)
                : undefined,
        };
    } catch {
        return {};
    }
}

function storeExport(next: StoredExport): void {
    try {
        localStorage.setItem("purecanvas-export", JSON.stringify(next));
    } catch {
        /* storage unavailable (private mode / blocked) */
    }
}

const initialExport = readStoredExport();

export const useUI = create<UIState>((set, get) => ({
    theme: getInitialTheme(),
    tool: "select",
    penVariant: "pen",
    selectedIds: [],
    editingTextId: null,
    defaults: initialDefaults,
    layersOpen: false,
    exportBackground: initialExport.background ?? "theme",
    exportPadding: initialExport.padding ?? "normal",
    exportScope: initialExport.scope ?? "all",
    exportFormat: initialExport.format ?? "png",
    zoomRequest: null,

    setTheme: (t) => {
        storeTheme(t);
        set({ theme: t });
    },
    toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        storeTheme(next);
        set({ theme: next });
    },
    setTool: (t) => set({ tool: t, editingTextId: null }),
    setPenVariant: (v) => set({ penVariant: v, tool: "pen" }),
    setSelection: (ids) => set({ selectedIds: ids }),
    addToSelection: (ids) =>
        set((s) => ({
            selectedIds: Array.from(new Set([...s.selectedIds, ...ids])),
        })),
    toggleSelection: (id) =>
        set((s) => ({
            selectedIds: s.selectedIds.includes(id)
                ? s.selectedIds.filter((x) => x !== id)
                : [...s.selectedIds, id],
        })),
    clearSelection: () => set({ selectedIds: [] }),
    setEditingText: (id) => set({ editingTextId: id }),
    setDefaults: (patch) =>
        set((s) => ({ defaults: { ...s.defaults, ...patch } })),
    setLayersOpen: (open) => set({ layersOpen: open }),
    setExportBackground: (b) => {
        set({ exportBackground: b });
        storeExport({
            background: b,
            padding: get().exportPadding,
            scope: get().exportScope,
            format: get().exportFormat,
        });
    },
    setExportPadding: (p) => {
        set({ exportPadding: p });
        storeExport({
            background: get().exportBackground,
            padding: p,
            scope: get().exportScope,
            format: get().exportFormat,
        });
    },
    setExportScope: (scope) => {
        set({ exportScope: scope });
        storeExport({
            background: get().exportBackground,
            padding: get().exportPadding,
            scope,
            format: get().exportFormat,
        });
    },
    setExportFormat: (format) => {
        set({ exportFormat: format });
        storeExport({
            background: get().exportBackground,
            padding: get().exportPadding,
            scope: get().exportScope,
            format,
        });
    },
    requestZoom: (value) => set({ zoomRequest: { value, nonce: Date.now() } }),
}));
