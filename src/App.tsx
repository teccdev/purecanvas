import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { Canvas } from "@/components/canvas/Canvas";
import { CodeXml, DollarSign, Lightbulb, Loader2, SlidersHorizontal } from "lucide-react";
import { FloatingButton } from "@/components/FloatingButton";
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
import { SponsorDialog } from "@/components/SponsorDialog";
import { MobileWelcomeDialog } from "@/components/MobileWelcomeDialog";

let booted = false;

export default function App() {
    const theme = useUI((s) => s.theme);
    const layersOpen = useUI((s) => s.layersOpen);
    const isMobile = useUI((s) => s.isMobile);
    const propertiesOpen = useUI((s) => s.propertiesOpen);
    const toggleProperties = useUI((s) => s.toggleProperties);
    const projectId = useDoc((s) => s.projectId);

    const [sponsorDialogOpen, setSponsorDialogOpen] = useState(false);

    useAutosave();
    useKeyboardShortcuts();
    useMobileViewport();

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;
    }, [theme]);

    useEffect(() => {
        if (booted) return;
        booted = true;
        ensureFontLoaded("Inter");
        void bootstrapProject();
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
                            "absolute left-4 bottom-20 z-30 flex size-11 items-center justify-center rounded-2xl border border-border shadow-lg backdrop-blur-md transition-colors",
                            propertiesOpen
                                ? "bg-primary text-primary-foreground"
                                : "bg-background/85 text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                    >
                        <SlidersHorizontal className="size-5" />
                    </button>
                )}

                {!isMobile && (
                    <>
                        <FloatingButton
                            onClick={() => setSponsorDialogOpen(true)}
                            icon={<DollarSign className="size-4.5 shrink-0" />}
                            label="Your ad here! - $20"
                            emphasize
                        />
                        <FloatingButton
                            href="mailto:teccin+purecanvas@proton.me?subject=PureCanvas%20Feature%20Request"
                            icon={<Lightbulb className="size-4.5 shrink-0" />}
                            label="Feature request"
                        />
                        <FloatingButton
                            href="https://github.com/teccdev/purecanvas"
                            icon={<CodeXml className="size-4.5 shrink-0" />}
                            label="View on GitHub"
                        />
                        {/*<FloatingButton
                            href="https://buymeacoffee.com/glintsoftware"
                            icon={<Coffee className="size-4 shrink-0" />}
                            label="Buy me a coffee"
                        />*/}
                    </>
                )}

                <SponsorDialog
                    open={sponsorDialogOpen}
                    onOpenChange={setSponsorDialogOpen}
                    priceUSD={20}
                    time="3 months"
                />
                {isMobile && <MobileWelcomeDialog />}
                {!projectId && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
            <Toaster />
            <Analytics />
        </TooltipProvider>
    );
}
