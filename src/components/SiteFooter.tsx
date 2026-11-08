import { useState } from "react";
import { X } from "lucide-react";

const LINK_CLASS_NAME =
    "text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * Minimal bottom-right footer with secondary links. Dismissing the footer
 * hides it for the current page session; it returns on reload.
 */
export function SiteFooter() {
    const [hidden, setHidden] = useState(false);

    if (hidden) return null;

    return (
        <footer className="absolute right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/85 py-1 pr-1 pl-3 text-[11px] whitespace-nowrap shadow-sm backdrop-blur-md">
            <a href="/privacy" className={LINK_CLASS_NAME}>
                Privacy
            </a>
            <span aria-hidden="true" className="text-border">
                ·
            </span>
            <a
                href="mailto:teccin+purecanvas@proton.me?subject=PureCanvas%20Feature%20Request"
                className={LINK_CLASS_NAME}
            >
                Feature request
            </a>
            <span aria-hidden="true" className="text-border">
                ·
            </span>
            <a
                href="https://github.com/teccdev/purecanvas"
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS_NAME}
            >
                GitHub
            </a>
            <button
                type="button"
                aria-label="Hide footer"
                onClick={() => setHidden(true)}
                className="-mr-0.5 flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
                <X className="size-3" />
            </button>
        </footer>
    );
}
