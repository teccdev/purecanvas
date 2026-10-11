import { useEffect, useId } from "react";
import { create } from "zustand";
import { X } from "lucide-react";
import { cn } from "cn";

/** Zustand store that tracks the vertical stacking order of floating buttons. */
interface FloatingButtonStore {
    /** Ordered list of button IDs, bottom-most first. */
    slots: string[];
    /** Register a button ID (appends to end of list). */
    register: (id: string) => void;
    /** Unregister a button ID (removes from list, others shift up). */
    unregister: (id: string) => void;
}

const useFloatingButtonStore = create<FloatingButtonStore>()((set) => ({
    slots: [],
    register: (id) =>
        set((s) =>
            s.slots.includes(id) ? s : { ...s, slots: [...s.slots, id] },
        ),
    unregister: (id) =>
        set((s) => ({ ...s, slots: s.slots.filter((slot) => slot !== id) })),
}));

interface FloatingButtonProps {
    /** URL the button links to. If provided, renders as an `<a>`. */
    href?: string;
    /** Optional callback fired when the button is clicked. */
    onClick?: () => void;
    /** Icon displayed before the label. */
    icon: React.ReactNode;
    /** Visible button text. */
    label: string;
    /** Add extra emphasis. */
    emphasize?: boolean;
    /** Accessible label for the dismiss (close) button. */
    ariaLabel?: string;
}

/** Spacing between docked buttons (px). */
const SLOT_HEIGHT = 52;
/** Base distance from the bottom edge (px). */
const BASE_OFFSET = 16;

const ACTION_CLASS_NAME =
    "flex h-9 items-center gap-2 rounded-2xl border border-border bg-background/85 px-3 text-sm font-medium shadow-lg backdrop-blur-md outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * A floating action button that docks to the bottom-left. Multiple
 * `<FloatingButton>` instances automatically stack vertically, each in its
 * own slot. Pass `href` to render a link, `onClick` to render an action
 * button (or both). Dismissing a button hides it for the current page
 * session; it returns on reload.
 */
export function FloatingButton({
    href,
    onClick,
    icon,
    label,
    emphasize,
    ariaLabel = "Hide",
}: FloatingButtonProps) {
    const buttonId = useId();

    // Register / unregister on mount / unmount
    useEffect(() => {
        const store = useFloatingButtonStore.getState();
        store.register(buttonId);
        return () => store.unregister(buttonId);
    }, [buttonId]);

    // Read current slot position so we re-render when others register / unregister
    const slots = useFloatingButtonStore((s) => s.slots);
    const slot = slots.indexOf(buttonId);

    if (slot === -1) return null;

    const bottom = BASE_OFFSET + slot * SLOT_HEIGHT;

    const dismiss = () => {
        // Unregister immediately so sibling buttons shift up to fill the gap.
        const store = useFloatingButtonStore.getState();
        store.unregister(buttonId);
    };

    const content = (
        <>
            {icon}
            {label}
        </>
    );

    const action = href ? (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClick}
            className={ACTION_CLASS_NAME}
        >
            {content}
        </a>
    ) : (
        <button
            type="button"
            onClick={onClick}
            className={cn(ACTION_CLASS_NAME, emphasize && "border-foreground")}
        >
            {content}
        </button>
    );

    return (
        <div
            className="pointer-events-none absolute left-4 z-30"
            style={{ bottom }}
        >
            <div className="group/floating pointer-events-auto relative">
                {action}
                <button
                    type="button"
                    aria-label={ariaLabel}
                    onClick={dismiss}
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/floating:opacity-100 group-focus-within/floating:opacity-100"
                >
                    <X className="size-3" />
                </button>
            </div>
        </div>
    );
}
