# PureCanvas — Mobile tap active tool to return to Select

## Context

The responsive/mobile UI (commit `298ca6e` on branch `feat/mobile-responsive`) removed the **Select** tool from the **mobile** toolbar (gesture selection is used instead). Problem: after using **Pen** (and Shape/Line) — which stay active after use, same as desktop — a mobile user has no toolbar button to get back to a select/pan state.

## Change (mobile ONLY — do not touch desktop)

In **`src/components/Toolbar.tsx`**, for the mobile case only: **tapping the already-active tool icon returns the tool to `select`.**

- Add an `onClick` behavior in the `RailButton` mapping: when `isMobile` is true AND the tapped tool equals the current `tool`, call `setTool("select")` instead of keeping the same tool active.
- Concretely, in the `tools.map((t) => ...)` render, the existing onClick currently does `setTool(t.id); if (t.id === "pen") setPenVariant(penVariant)`. Change it so that:
  ```js
  onClick={() => {
    if (isMobile && tool === t.id) {
      setTool("select")
    } else {
      setTool(t.id)
      if (t.id === "pen") setPenVariant(penVariant)
    }
  }}
  ```
  (Wire it however is cleanest in the current code — the requirement is: on mobile, tapping the active tool switches to Select; desktop behavior is 100% unchanged.)
- Keep the `active` highlight as-is (the active tool still shows highlighted; tapping it just sends you back to select).
- Ensure `setTool("select")` also clears `editingTextId` (the existing `setTool` already does this via the store — verify; `useUI.setTool` sets `{ tool: t, editingTextId: null }`, so this is automatic).

## Verification

- `npm run build` passes (0 errors).
- `npm run lint` passes (0 errors).
- Manual: dev server, mobile viewport. Select Pen from the mobile toolbar, then tap the Pen icon again → returns to Select. Verify Shape/Line behave the same. Desktop: tapping the active tool does NOT switch to select (unchanged).

## Constraints

- Mobile-only. Desktop tool rail untouched.
- Do NOT touch `TODO.md`.
- Continue on branch `feat/mobile-responsive`.
- Commit the change. Do NOT push.
- Report the file(s) changed and a one-line explanation.