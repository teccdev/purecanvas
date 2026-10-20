# PureCanvas — Mobile adjustments (3 items)

Branch: `feat/mobile-responsive` (continue here). These are follow-ups to the responsive UI. Desktop behavior must remain unchanged. Do NOT touch `TODO.md`. Verify `npm run build` and `npm run lint` (0 errors) after. Commit, do NOT push.

## 1. Reduce long-press delay: 2s → 1s

In **`src/components/canvas/Canvas.tsx`**, the constant `LONG_PRESS_MS` is currently `2000`. Change it to `1000`. (Comment says "How long (ms) a finger must rest before a drag becomes a box-select." — update the value only; the logic/timer stays as-is.)

## 2. Properties panel → a designated floating button on the LEFT (more visible)

Currently the mobile "Properties" trigger is a `PanelRight` icon tucked into the top-bar view group (`src/components/TopBar.tsx`). Move it to a **dedicated floating button on the LEFT side of the screen** so it's clearly visible, and keep it active only on mobile:

- Create (or reuse) a floating button that docks on the **left edge** and, when tapped, toggles `useUI().toggleProperties()` (the existing `propertiesOpen` state, which already opens the Drawer).
- **Mobile only:** render this properties floating button when `isMobile` is true. Remove/suppress the `PanelRight` properties toggle from the mobile top-bar view group (the top bar should no longer have a properties trigger — the floating left button replaces it).
- **Desktop:** unchanged. The desktop properties panel stays as a side panel; do not add a floating properties button on desktop.
- Styling: match the app's floating-button aesthetic (rounded-2xl, `bg-background/85`, `border-border`, `shadow-lg`, backdrop-blur). A single icon button (e.g. `PanelRight` / `Settings2` / `SlidersHorizontal`) with an `aria-label="Properties"` is fine. Ensure it sits on the **left** (e.g. `absolute left-4`) and at a comfortable vertical position — visible and not colliding with the toolbar. It should be visually emphasized so users notice it. Consider a bottom-left dock position consistent with the app's existing floating buttons.
- NOTE: the existing `FloatingButton` component docks bottom-left already. Reuse it if it fits (it supports `onClick`, `icon`, `label`, and a dismiss X). But it has a dismiss behavior — for a core properties trigger you may prefer NO dismiss X so users can't accidentally hide it. Either reuse with dismiss disabled or make a small dedicated button. Use your judgment, but the end result must be: mobile users see a clear left-side Properties button that opens the drawer, tapping it again (or the drawer's close) closes it.

## 3. Mobile horizontal mode: 2×3 tool panel pinned to the BOTTOM (not centered/right)

In **`src/components/Toolbar.tsx`**, for **mobile + landscape/non-portrait** (currently the `2×3` grid case — `bottomBar === false` but `isMobile === true`), the tool grid is vertically centered on the right and sits too high. Anchor it to the **bottom** of the screen instead:

- For the mobile non-portrait (2×3 grid) case, change the root container so the grid sticks to the bottom: e.g. `absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]` — centered horizontally near the bottom, instead of `right-4 top-1/2`.
- The grid itself stays `grid grid-cols-2` (2 columns) as now for mobile. Keep `compact` size-9 buttons.
- The **portrait** bottom-bar case must be unaffected (still the horizontal bottom bar).
- **Desktop** (non-mobile) tool rail: completely unchanged (still the right-side vertical rail).
- Submenus (pen variants / shape kinds): they currently render above/beside the rail; make sure in the mobile-2x3-bottom case the pen/shape submenu opens in a sensible spot (above the bottom grid is fine). Don't over-engineer — just ensure it's not off-screen.

## Verification

- `npm run build` passes (0 errors).
- `npm run lint` passes (0 errors).
- Manual (mobile viewport):
  - Landscape/narrow: 2×3 tool grid hugs the bottom of the screen (not high/right).
  - Portrait: bottom horizontal toolbar still works.
  - Long-press ~1s on empty canvas initiates box-select.
  - Left-side Properties floating button opens the drawer; no Properties trigger remains in the mobile top bar; desktop is unchanged.
- Commit on `feat/mobile-responsive`. Report files changed + a line each.