import {
    Layers,
    Fullscreen,
    Moon,
    Redo2,
    Sun,
    Undo2,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useDoc } from "@/store/useDoc";
import { useUI } from "@/store/useUI";
import { unionBounds } from "@/lib/geometry";
import { ProjectsDialog } from "./ProjectsDialog";
import { ExportMenu } from "./ExportMenu";
import { toast } from "@/components/ui/toast";

export function TopBar() {
    const projectName = useDoc((s) => s.projectName);
    const camera = useDoc((s) => s.camera);
    const canUndo = useDoc((s) => s.past.length > 0);
    const canRedo = useDoc((s) => s.future.length > 0);
    const theme = useUI((s) => s.theme);
    const toggleTheme = useUI((s) => s.toggleTheme);
    const layersOpen = useUI((s) => s.layersOpen);
    const setLayersOpen = useUI((s) => s.setLayersOpen);
    const requestZoom = useUI((s) => s.requestZoom);
    const isMobile = useUI((s) => s.isMobile);

    const copyLogo = async () => {
        // Rasterize the SVG logo to a PNG so it pastes like any image
        // (an SVG blob isn't accepted as an image by most paste targets).
        const response = await fetch("/favicon.svg");
        const svgBlob = await response.blob();
        const url = URL.createObjectURL(svgBlob);
        try {
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Failed to load logo"));
                img.src = url;
            });
            const size = 512;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas not supported");
            ctx.drawImage(img, 0, 0, size, size);
            const pngBlob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/png"),
            );
            if (!pngBlob) throw new Error("Failed to render logo");
            await navigator.clipboard.write([
                new ClipboardItem({ "image/png": pngBlob }),
            ]);
            toast.add({ title: "Copied logo" });
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    const fitView = () => {
        const b = unionBounds(useDoc.getState().elements);
        const rect = { width: window.innerWidth, height: window.innerHeight };
        if (!b) {
            useDoc
                .getState()
                .setCamera({ x: rect.width / 2, y: rect.height / 2, zoom: 1 });
            return;
        }
        const pad = 120;
        const zoom = Math.min(
            8,
            Math.max(
                0.05,
                Math.min(
                    rect.width / (b.width + pad),
                    rect.height / (b.height + pad),
                ),
            ),
        );
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        useDoc.getState().setCamera({
            zoom,
            x: rect.width / 2 - cx * zoom,
            y: rect.height / 2 - cy * zoom,
        });
    };

    const logo = (
        <img
            src="/favicon.svg"
            width={28}
            height={28}
            className="pl-1.5 cursor-copy"
            onClick={async () => {
                try {
                    await copyLogo();
                } catch {
                    toast.add({
                        title: "Failed to copy logo",
                        type: "error",
                    });
                }
            }}
        />
    );

    const zoomGroup = (
        <>
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
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fit to view"
                onClick={fitView}
            >
                <Fullscreen />
            </Button>
        </>
    );

    const viewGroup = (
        <>
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
        </>
    );

    if (isMobile) {
        return (
            <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col gap-1.5 p-2">
                <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
                    {logo}
                    <Input
                        value={projectName}
                        onChange={(e) =>
                            useDoc.getState().setProjectName(e.target.value)
                        }
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur()
                        }}
                        className="h-7 min-w-0 flex-1 border-transparent bg-transparent shadow-none focus-visible:border-transparent"
                        aria-label="Project name"
                    />
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
                </div>
                <div className="pointer-events-auto flex items-center justify-between rounded-2xl border border-border bg-background/85 p-1 shadow-lg backdrop-blur-md">
                    <div className="flex items-center gap-0.5">{zoomGroup}</div>
                    <div className="flex items-center gap-0.5">{viewGroup}</div>
                </div>
            </header>
        );
    }

    return (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 p-3">
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
                {logo}
                <span className="pr-1.5 text-sm font-semibold tracking-tight select-none">
                    PureCanvas
                </span>
                <Separator orientation="vertical" className="h-5" />
                <Input
                    value={projectName}
                    onChange={(e) =>
                        useDoc.getState().setProjectName(e.target.value)
                    }
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur()
                    }}
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
                {zoomGroup}
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
                {viewGroup}
            </div>
        </header>
    );
}
