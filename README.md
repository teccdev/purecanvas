# PureCanvas

A local-first vector design app in the browser. Draw on an infinite dot-grid
canvas with text, images, lines, shapes, icons and freehand strokes, then export
to SVG, PNG or WEBP (or copy a PNG straight to the clipboard).

Everything is stored locally in the browser via [Dexie](https://dexie.org)
(IndexedDB) — projects autosave and reload where you left off. No account, no
server, no uploads.

## Features

- **Infinite canvas** with an adaptive dot grid, pan (Space / middle-mouse),
  and zoom (Ctrl/⌘ + scroll, buttons, or Fit to view).
- **Tools** in a floating right-hand rail: Select, Text, Image, Line, Shape,
  Icon, Pen. Hovering a tool expands its label; some tools reveal option rails
  (pen variants, shape kinds).
- **Select & transform**: click or marquee select, then move, resize (8 grips)
  and rotate. Hold **Shift** to constrain (uniform scale / 45° snapping on
  lines / 15° rotation), **Alt** to scale from the center.
- **Text** with a rich set of Google Fonts; resizing changes the font size.
- **Images** via file picker, drag-and-drop, or paste.
- **Lines** with grips on both ends, optional arrowheads and adjustable weight.
- **Shapes**: rectangle, ellipse, triangle, diamond, star, hexagon — hollow or
  filled, recolorable, with corner radius.
- **Icons** from Lucide and Google Material Symbols, with searchable pickers.
- **Pen** with pen, highlighter and eraser variants.
- **Export** to SVG, PNG, WEBP or clipboard, on a theme / transparent / white /
  black background. Fonts and images are embedded in the output.
- **Projects**: create, rename, delete and reopen from a local database.
- **Layers**, **undo/redo**, keyboard shortcuts, and light/dark themes
  (dark by default).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `V` `T` `I` `L` `R` `O` `P` | Select / Text / Image / Line / Shape / Icon / Pen |
| `P` (repeated) | Cycle pen → highlighter → eraser |
| `E` | Eraser |
| `Ctrl/⌘ + Z` / `Shift + Ctrl/⌘ + Z` | Undo / redo |
| `Ctrl/⌘ + D` | Duplicate |
| `Ctrl/⌘ + A` | Select all |
| `Ctrl/⌘ + C` / `Ctrl/⌘ + V` | Copy / paste |
| `Ctrl/⌘ + =` / `-` / `0` | Zoom in / out / reset |
| `Delete` / `Backspace` | Delete selection |
| `Esc` | Exit text editing, then clear selection |
| Arrow keys | Nudge (hold `Shift` for a larger step) |
| Space (hold) | Pan |

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run preview  # preview the production build
```

## Deployment

The app is a static SPA and deploys to [Vercel](https://vercel.com) with no
configuration beyond the included `vercel.json`. Import the repository, and
Vercel detects Vite, runs `npm run build`, and serves `dist/`.

## Tech

Vite + React + TypeScript, Tailwind CSS v4 and shadcn/ui (Base UI), Zustand for
state, Dexie for persistence, and a custom SVG rendering engine.
