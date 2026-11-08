import { useEffect, useState } from "react";
import { Canvas } from "@/components/canvas/Canvas";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { Toolbar } from "@/components/Toolbar";
import { TopBar } from "@/components/TopBar";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { LayersPanel } from "@/components/LayersPanel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { useUI } from "@/store/useUI";
import { useDoc } from "@/store/useDoc";
import { cn } from "@/lib/utils";
import { useAutosave } from "@/hooks/useAutosave";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { bootstrapProject } from "@/lib/projects";
import { ensureFontLoaded } from "@/lib/fonts";
import { MobileWelcomeDialog } from "@/components/MobileWelcomeDialog";
import { Presenter } from "@/components/Presenter";

let booted = false;

export default function App() {
    const theme = useUI((s) => s.theme);
    const layersOpen = useUI((s) => s.layersOpen);
    const isMobile = useUI((s) => s.isMobile);
    const propertiesOpen = useUI((s) => s.propertiesOpen);
    const toggleProperties = useUI((s) => s.toggleProperties);
    const projectId = useDoc((s) => s.projectId);
    const artboardEnabled = useDoc((s) => s.artboard.enabled);

    const [bootError, setBootError] = useState<string | null>(null);

    useAutosave();
    useKeyboardShortcuts();
    useMobileViewport();

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;
    }, [theme]);

    // The freeform (infinite) canvas shows the grid; Canvas mode hides it,
    // unless the user has taken manual control of the grid toggle.
    useEffect(() => {
        useUI.getState().syncGridToArtboard(artboardEnabled);
    }, [artboardEnabled]);

    useEffect(() => {
        if (booted) return;
        booted = true;
        ensureFontLoaded("Inter");
        void bootstrapProject().catch((err: unknown) => {
            console.error("Failed to open workspace", err);
            setBootError(
                err instanceof Error ? err.message : "Unknown storage error",
            );
        });
    }, []);

    return (
        <TooltipProvider>
            <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
                <h1 className="sr-only">
                    PureCanvas — local-first vector design app
                </h1>
                <Canvas />
                <TopBar />
                <PropertiesPanel />
                {layersOpen && <LayersPanel />}
                <Toolbar />

                {isMobile && (
                    <button
                        type="button"
                        aria-label="Properties"
                        aria-pressed={propertiesOpen}
                        onClick={toggleProperties}
                        className={cn(
                            "absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-30 flex size-11 items-center justify-center rounded-2xl border border-border shadow-lg backdrop-blur-md transition-colors",
                            propertiesOpen
                                ? "bg-primary text-primary-foreground"
                                : "bg-background/85 text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                    >
                        <SlidersHorizontal className="size-5" />
                    </button>
                )}

                {!isMobile && <SiteFooter />}
                {isMobile && <MobileWelcomeDialog />}
                <Presenter />
                {!projectId && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
                        {bootError ? (
                            <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 text-center shadow-lg">
                                <p className="text-sm font-semibold">
                                    Couldn’t open your workspace
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {bootError}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    className="mt-4 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                                >
                                    Reload
                                </button>
                            </div>
                        ) : (
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        )}
                    </div>
                )}
            </div>
            <Toaster />
        </TooltipProvider>
    );
}
