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

| Shortcut                            | Action                                            |
| ----------------------------------- | ------------------------------------------------- |
| `V` `T` `I` `L` `R` `O` `P`         | Select / Text / Image / Line / Shape / Icon / Pen |
| `P` (repeated)                      | Cycle pen → highlighter → eraser                  |
| `E`                                 | Eraser                                            |
| `Ctrl/⌘ + Z` / `Shift + Ctrl/⌘ + Z` | Undo / redo                                       |
| `Ctrl/⌘ + D`                        | Duplicate                                         |
| `Ctrl/⌘ + A`                        | Select all                                        |
| `Ctrl/⌘ + C` / `Ctrl/⌘ + V`         | Copy / paste                                      |
| `Ctrl/⌘ + =` / `-` / `0`            | Zoom in / out / reset                             |
| `Delete` / `Backspace`              | Delete selection                                  |
| `Esc`                               | Exit text editing, then clear selection           |
| Arrow keys                          | Nudge (hold `Shift` for a larger step)            |
| Space (hold)                        | Pan                                               |

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run preview  # preview the production build
```

## Deployment

The app is a static SPA and deploys to [Vercel](https://vercel.com) with no
build configuration beyond the included `vercel.json`. Import the repository,
and Vercel detects Vite, runs `npm run build`, and serves `dist/`. For production
analytics, also connect an Upstash Redis database and set `ANALYTICS_PASSWORD`
(see [Analytics](#analytics)).

Stock image search is served by the `api/pixabay.ts` serverless function at
`/api/pixabay`. `vercel.json` routes `/api/:path*` to that function _before_ the
SPA catch-all rewrite, so API requests are not swallowed by `/(.*) ->
/index.html`.

### Environment variables

`api/pixabay.ts` reads its Pixabay API key from `PIXABAY_KEY` via
`process.env.PIXABAY_KEY`. **You must set `PIXABAY_KEY` as an environment
variable in the Vercel project** (Project Settings → Environment Variables) for
the deployed proxy to work — without it the function returns HTTP 500
`PIXABAY_KEY environment variable is not set`. Set it for the environments you
deploy to (Production, Preview, Development, as needed). Locally, put it in an
untracked `.env` file (already in `.gitignore` — never commit it).

## Analytics

PureCanvas ships a small first-party analytics system instead of a third-party
script. It records pageviews, unique visitors, sessions, bounce rate, referrers,
UTM campaigns, approximate country (from Vercel's CDN header), and device /
browser type. No cookies and no IP addresses are stored.

The dashboard lives at **`/analytics`** and requires `ANALYTICS_PASSWORD`, which
is read only on the server. A successful login sets a signed, `HttpOnly` session
cookie (12 hours). Set `ANALYTICS_SESSION_SECRET` to a long random string to sign
that cookie independently of the password.

### Storage

Production uses **Upstash Redis** over its REST API. Add a free Upstash database
through the Vercel Marketplace (Storage → Marketplace → Upstash Redis) and make
sure the project has either pair of variables:

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` (what the Vercel KV integration injects)

Custom prefixes from the Vercel integration are detected automatically. For
example, a prefix of `UPSTASH_REDIS_REST` produces
`UPSTASH_REDIS_REST_KV_REST_API_URL` / `UPSTASH_REDIS_REST_KV_REST_API_TOKEN`,
which also works.

Each pageview is written by a single Lua script, so it costs one Redis command.
Local development does not need Redis: events are written to
`.data/analytics-dev.json` (gitignored) and the dashboard works at
`http://localhost:5173/analytics`.

### Environment separation

Analytics keys are namespaced by `ANALYTICS_ENV`, which falls back to
`VERCEL_ENV` (`production`, `preview`, `development`). Preview deployments and
local development therefore never write into production data. In a production
build the browser tracker only runs on `purecanvas.app` / `www.purecanvas.app`;
preview hostnames are ignored. `vite preview` also writes to the local file.

### Privacy policy

`/privacy` is a short, plain-language policy linked from the bottom-right footer
(and from the mobile welcome dialog). It describes the anonymous analytics,
Pixabay image search, and data retention.

## Tech

Vite + React + TypeScript, Tailwind CSS v4 and shadcn/ui (Base UI), Zustand for
state, Dexie for persistence, and a custom SVG rendering engine.
