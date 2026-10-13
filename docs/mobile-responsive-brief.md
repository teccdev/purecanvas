# PureCanvas — Responsive/Mobile UI Build Brief

## Goal

Make PureCanvas (a local-first browser vector-design app, Vite + React + TS, Tailwind v4, Zustand) usable on **mobile and small screens**. ~90% of current new visitors are on mobile and the app is nearly unusable there. Do NOT degrade the desktop experience.

## Architecture facts (already verified — trust these)

- **`src/App.tsx`** mounts `<Canvas />`, `<TopBar />`, `<PropertiesPanel />`, `<Toolbar />`, plus three `<FloatingButton>`s (Sponsor, Feature request, GitHub). These are unconditionally mounted.
- **`src/components/Toolbar.tsx`** — the tool rail. Currently `absolute right-4 top-1/2`, `flex flex-col gap-2` (a 1×7 vertical column) of `select/text/image/line/shape/icon/pen` (`RailButton`, `size-11` each). Also renders floating sub-menus when `tool === "pen"` (penVariant rail) or `tool === "shape"` (2-col grid of shape kinds). Tools come from `TOOL_SHORTCUTS` in `src/lib/tools.ts`.
- **`src/components/TopBar.tsx`** — one single-row header, `absolute inset-x-0 top-0`, `flex items-center justify-between`. Left cluster: logo img + "PureCanvas" text + project-name Input + Undo/Redo + zoom group + fit. Right cluster: Layers toggle, Theme toggle, `<ProjectsDialog />`, `<ExportMenu />`.
- **`src/components/FloatingButton.tsx`** — bottom-left docked buttons with a sliding dismiss (X). Used for Sponsor / Feature request / GitHub / Buy-me-coffee.
- **`src/components/PropertiesPanel.tsx`** — a large right-side panel (~1580 lines) with per-element properties, plus the `IconPicker` and `StockImagePanel`. Currently always mounted as a side panel.
- **`src/store/useUI.ts`** — Zustand UI store. Holds `tool`, `penVariant`, `selectedIds`, `defaults`, `layersOpen`, etc. This is where you add responsive state.
- **`src/components/canvas/Canvas.tsx`** (~1189 lines) — the SVG canvas. Uses a single pointer-event interaction state machine (`interaction.current` of type `Interaction`). Modes: `pan`, `marquee` (box-select), `move`, `resize`, `rotate`, `draw-shape`, `draw-line`, `draw-pen`, `erase`. **Current select logic:** clicking an element sets `move`; clicking empty space sets `marquee`; pan is via Space-key or middle-mouse-button (no touch pan/zoom yet). Wheel handler zooms toward cursor.

## What to build

### 0. Responsive detection + state (foundation — do this first)

In `useUI.ts`, add an `isMobile` boolean (or a richer `viewport: "mobile" | "desktop"`) plus a `propertiesOpen: boolean` (drawer on mobile) and a small breakpoint store or `useMediaQuery` hook. Detect small screens. Use a sane breakpoint: treat **width ≤ 768px** and/or **coarse pointer** (`(pointer: coarse)` or `(hover: none)`) as mobile. The cheapest reliable signal: `matchMedia('(pointer: coarse)')` plus `max-width: 768px`. Expose so components subscribe via `useUI((s) => s.isMobile)`.

Also add a **`isMobile` flag / media hook** so your handlers can branch without re-routing the whole store.

### 1. HORIZONTAL small screens (landscape phones, narrow windows)

- **Toolbar** → make it **smaller** and a **2×3 grid** (not 1×7). Drop the `railbutton` label tooltips (no hover on touch). Use a compact icon-only layout.
- **Remove the Select tool** from the toolbar entirely on mobile — selection happens via taps/gestures on the canvas instead.
- **Hide all Floating Buttons** on mobile (Sponsor / Feature request / GitHub).
- **Properties panel → a Drawer.** Replace the side panel with a button that opens the properties in a drawer (slide-in from the right, or bottom sheet). Add `propertiesOpen` state to the UI store. The drawer must include everything the side panel had (including IconPicker and StockImagePanel usage), just as an overlay.
- **Projects + Export buttons → icon-only** (strip their text labels on mobile; keep icons + aria-labels).
- **FULL MOBILE CONTROL SUPPORT (the important part):**
  - **Pan:** one-finger drag always pans the canvas (when not interacting with an element/tool). Set `touch-action: none` on the SVG so the browser doesn't hijack the gesture.
  - **Zoom:** pinch-to-zoom toward the focal point (the existing wheel handler gives you the math — mirror it for pointer `pointerType === "touch"` with two pointers, or use a native gesture). Also keep on-screen zoom buttons.
  - **Select by tapping objects:** a quick single-finger tap on an element selects it (enter `move` mode like a desktop click).
  - **Box-select by tapping AND HOLDING for ~2 s then dragging** (long-press drag). If the finger is NOT held 2 s, a drag should just **pan** instead of box-select. Implement a timer: on pointerdown, wait 2 s before committing to `marquee`; if the pointer moves past a small threshold before 2 s, treat the gesture as pan instead.
  - **Suspend gestures while using the Pen tool:** when `tool === "pen"`, disable pan-on-drag of empty space and disable long-press box-select, so drawing strokes works naturally. Pen drawing already works via pointer events; make sure mobile touch doesn't pan while the pen is active.

### 2. VERTICAL small screens (portrait phones)

- **Move the toolbar to the bottom** and make it **horizontal** (a bottom `flex-row` bar, not the right-side vertical rail).
- **Redesign the top bar.** Remove the "PureCanvas" logo *text* (keep the small logo icon). **Split the top bar into two layers** so everything fits: layer 1 the project name / actions, layer 2 the zoom + layers/theme/projects/export controls. Nothing should overflow or wrap awkwardly.
- **Hide Floating Buttons** (same as horizontal).
- **Properties panel → Drawer** (same as horizontal — reuse one drawer implementation).

### 3. First-entry mobile welcome dialog

Add a **dialog shown on the user's first entry while on mobile** that welcomes them and recommends the desktop version for a better experience. Persist "dismissed" in `localStorage` so it only shows once (e.g. key `purecanvas-mobile-welcome-seen`). Keep it skippable (a dismiss/Continue button). Don't block the app behind it — show it as an overlay they can close, and only on mobile.

## Constraints & gotchas

- **Do not break desktop.** Guard all mobile behavior behind the `isMobile` flag/media query. Desktop layout/gestures stay exactly as they are now.
- **Don't touch `TODO.md`** — it contains Austin's own edits (currently shows as modified in git). Leave it.
- Tailwind v4 — use existing utility classes and the `cn()` helper (`src/lib/utils.ts`). Accent is green/cyan family (this is PureCanvas, not the Glint brand).
- Keep TypeScript strict and type-safe (the project builds with `tsc -b && vite build` and lints with `oxlint`). Run both and get them passing.
- Reuse the existing UI primitives in `src/components/ui/` (Button, Drawer if one exists, Dialog, etc.). shadcn/ui (Base UI) is configured — use `@/components/ui/*` patterns; if a Drawer primitive is missing, build a lightweight one with framer-motion style transitions or plain CSS transitions matching the app's aesthetic (rounded-2xl, backdrop-blur, `bg-background/85`, `border-border`, shadow-lg).
- Touch handling: set `touch-action: none` on the SVG root so the browser doesn't scroll/zoom the page during canvas gestures. Make sure preventDefault is applied for touch pointers. Beware not to break text editing in `<input>` / contentEditable / the TextEditor component on mobile.
- The `ElementView`, `SelectionOverlay`, `DotGridBackground`, `TextEditor` components should keep working unchanged — you shouldn't need deep edits there.

## Verification

- `npm run build` (tsc + vite) passes with zero errors.
- `npm run lint` passes (0 errors).
- Manual: with the dev server running on port 5173, verify the responsive behavior by resizing the window / using the browser device toolbar at both a narrow-landscape and narrow-portrait size:
  - Toolbar 2×3 + no Select tool (horizontal) / bottom horizontal bar (vertical).
  - Floating buttons hidden.
  - Properties open in a drawer, not the side panel.
  - Projects + Export icon-only.
  - Pan with one finger, pinch zoom, tap-to-select, long-press box-select, pen gestures not panning.
  - Mobile welcome dialog shows once then persists dismissal.

Commit your changes on a branch **`feat/mobile-responsive`** (created from `master`). Do NOT push. Report exactly which files you changed and what each change does.