# Hyperframes Composition Brief: PureCanvas

## Objective
A 21-second launch-style brag video for PureCanvas, built as a real product demo.

## Output
- Composition directory: `/home/austin/Projects/purecanvas/brag-output/composition/`
- Rendered video: `/home/austin/Projects/purecanvas/brag-output/brag.mp4`
- Format: landscape — 1920x1080, 30fps
- Duration: 21.0 seconds

## Source Material
- Project root: `/home/austin/Projects/purecanvas`
- Primary files read: `index.html`, `src/index.css`, `README.md`, `src/components/Toolbar.tsx`, `src/components/ExportMenu.tsx`, `src/components/TopBar.tsx`
- Product name: PureCanvas
- Tagline: "free design." / "A local-first vector design app in the browser."
- Key UI to recreate: the editor itself — dot-grid canvas, top bar, floating right
  tool rail, properties panel, selection grips, Export dropdown.
- Copy that must appear verbatim:
  - "free design."
  - "No account, no server, no uploads."
  - "Export to SVG, PNG, WEBP"
  - "Text, images, lines, shapes, icons, freehand"
  - "purecanvas.app"
- Real reference screenshot (not used directly in render, used as visual ground truth):
  `.playwright-mcp/pc-drawn.png`

## Creative Direction
- Tone preset: `default`
- Creative direction: quiet, confident anti-signup tool film
- Interpretation: fast physical motion, restrained monochrome UI, one accent
  colour from the app itself. Humor from the product's restraint, not jokes.
- Angle: every design tool wants your email; this one opens on a dot grid.
- Hook: a cursor draws a periwinkle rectangle; "design, in a tab." lands over it.
- Outro: logo, PureCanvas, "free design.", purecanvas.app
- Avoid: generic SaaS language, abstract filler, invented metrics, fake UI gloss.

## Visual Identity
- Background: `#0a0a0a`
- Panel: `#121212`, elevated `#1a1a1a`
- Text: `#ededed`, muted `#8a8a8a`
- Accent: `#8b8bf7`
- Hairline: `rgba(255,255,255,0.08)`
- Display font: Geist Variable (`assets/fonts/geist-latin-wght-normal.woff2`)
- Body font: Geist Variable
- Visual references: dot grid at 24px, 1px hairlines, 12px radii, pill buttons,
  monochrome icon rail, one periwinkle element.

## LOOK line
Near-black `#0a0a0a` ground, Geist 400/500/700/900, one periwinkle `#8b8bf7`
focal element, 1px `rgba(255,255,255,0.08)` hairlines, dot grid dots at 10%
white on a 24px lattice, everything on a crisp technical canvas.
BANNED: gradient hero washes, floating abstract blobs, purple-blue gradient text,
neon glow, glassmorphism cards, generic three-card feature row.

## Storyboard
1. Hook — 3.0s — dot grid; cursor draws a periwinkle rounded rect; "design, in a tab." slams and holds.
2. App assembles — 3.6s — top bar, tool rail, properties panel arrive; "A full vector design app. / in your browser."
3. Make something — 3.8s — text tool, typing "Design anything.", star drawn, select-all grips; caption "Text. Images. Shapes. Icons. Pen."
4. Export — 4.0s — Export menu, three file chips (poster.svg / .png / .webp); "Export SVG, PNG, WEBP. / Fonts and images embedded."
5. What it doesn't ask for — 3.2s — "No account." "No server." "No uploads." one at a time; sub "Everything saves in your browser."
6. Outro — 3.4s — logo + PureCanvas + "free design." + purecanvas.app.

## Audio
- Audio role: warm minimal-electronic bed, sparse motion-matched accents
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: enter at 0 with 0.8s fade-in at low volume, rise through
  export, drop for scene 5, fade out 0.8s under the logo; end on a bar.
- Music cue guidance: bundled preset `assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json`;
  strong cues 13.01 (export payoff) and 18.02 (logo); beat grid 11.02/11.52/12.02
  for the three file chips.
- Audio-reactive treatment: subtle — dot-grid opacity follows low-band energy.
- Audio-coupled moments: drag (scene 1), typing ticks (scene 3), star stroke,
  selection click, menu open click, three chip pops (scene 4), three low hits
  (scene 5), one logo impact (scene 6).
- SFX guidance: `/home/austin/Projects/purecanvas/.agents/skills/brag/assets/sfx/sfx-analysis.md`
- Audio files: music copied into `assets/music/`; SFX chosen by Hyperframes into `assets/sfx/`.

## Requirements
- Show the real product UI recreated from the actual app source, not a generic mockup.
- All on-screen text must be readable and grounded in project copy.
- 15–25 seconds.
- `npx hyperframes check` must pass with zero errors.
