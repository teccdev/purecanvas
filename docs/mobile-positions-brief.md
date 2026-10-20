# PureCanvas — Mobile layout repositioning (2 items)

Branch: `master` (checkout master first; these are small follow-ups to the shipped mobile UI. Create + work on a branch `fix/mobile-positions`, then we merge). Do NOT touch `TODO.md` or the untracked `docs/*.md`. Verify `npm run build` and `npm run lint` (0 errors). Commit, do NOT push.

## 1. Mobile tool grid: bottom CENTER → bottom RIGHT

In **`src/components/Toolbar.tsx`**, the mobile (non-portrait 2×3 grid) root container currently centers the grid horizontally at the bottom. Move it to the **bottom right**.

- The mobile root class (the `isMobile` branch of `rootClass`, the one using `absolute inset-x-0 bottom-0 ... flex-col items-center`) is currently:
  ```
  pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]
  ```
- Change it so the grid sits bottom-right instead of bottom-center. Keep it hugging the bottom and safe-area padding. Use e.g. `flex items-end justify-end` and keep `flex-col`. Something like:
  ```
  pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-end gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]
  ```
  (anchor to the right edge — `items-end` — and keep the bottom safe-area.) Adjust the padding so it reads comfortably against the bottom-right corner (e.g. `right-3 pr-3` instead of the full-width inset-x-0 centering; use your judgment, but the grid must hug the bottom-right corner, not the center, and not the left).
- The submenus (pen variants / shape kinds) that stack above the grid should follow it to the right so they stay associated with the grid (align them right too).
- The **portrait** bottom bar and **desktop** rail are UNCHANGED.

## 2. Mobile Properties button: move from floating mid-left to a CORNER (top-left or bottom-left)

In **`src/App.tsx`**, the mobile Properties button is currently positioned floating on the left edge at `absolute left-4 bottom-20` (that `bottom-20` puts it partway up the screen, floating in open space). Move it to a **corner** so it doesn't occupy canvas space — **bottom-left** is natural now that the tool grid moves to bottom-right.

- Change its classes from `absolute left-4 bottom-20` to a proper corner position, e.g. `absolute bottom-4 left-4` (bottom-left corner) — the tool grid is now bottom-right so bottom-left is free. Add `safe-area` bottom padding if needed to look right on phones.
- Keep everything else about it the same (size-11, rounded-2xl, backdrop-blur, `aria-label="Properties"`, toggles `propertiesOpen`, highlighted when open).
- Ensure it does not collide with the bottom toolbar (which is on the right now).

## Verification
- Build + lint pass (0 errors).
- Manual (mobile viewport, e.g. 812×375):
  - 2×3 tool grid sits in the BOTTOM-RIGHT corner (not center).
  - Properties button sits in the BOTTOM-LEFT corner (not floating mid-screen).
  - They don't overlap.
  - Portrait bottom bar + desktop rail still fine.
- Commit on `fix/mobile-positions`. Report files changed + a line each.