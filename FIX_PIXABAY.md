# Fix the intermittent Pixabay integration in PureCanvas

## Symptom (user-reported)

The stock-image panel (`StockImagePanel.tsx`) intermittently shows **"Failed to fetch"** instead of search results. It works most of the time but randomly dies — especially during network hiccups. User describes it as "struggling greatly."

## Diagnosis (already confirmed by testing — do not re-litigate)

1. The **proxy works**: hitting `http://localhost:5173/api/pixabay?q=test` returns HTTP 200 with real hits (20 results, 500 totalHits). Both preview and webformat image URLs load fine (HTTP 200).
2. **Root cause of the intermittent failure:** the Vite middleware proxy (`vite.config.ts`, the `pixabayProxy()` plugin) does `await fetch(target)` to `https://pixabay.com/api/?...` with **NO timeout and NO retry**. When the upstream is slow/hanging (flaky home ISP), the request stalls; the browser's `fetch('/api/pixabay?...')` eventually rejects with **TypeError: Failed to fetch**, and `StockImagePanel` surfaces that raw message. There's no graceful degradation.
3. The same missing-timeout/retry pattern exists in the **Vercel function** (`api/pixabay.ts`, `handler`) — its `await fetch(...)` has no timeout either, and on upstream failure it returns a bare 502. (That's the production path; the dev path is the Vite proxy.)
4. Note: direct curl/python calls to `pixabay.com/api` get **bot-blocked (Cloudflare error 1010 / HTTP 400)** — that's expected and NOT the bug. The proxy path works because it's server-side. Do not "fix" this by calling pixabay directly from the browser.

## What to implement

Make both proxy layers **fail fast and recover gracefully** so the UI never sees a hanging `Failed to fetch`:

1. **`vite.config.ts` `pixabayProxy()`:** add an upstream fetch timeout (e.g. 8–10s) via `AbortController` + `setTimeout`, plus a small retry (e.g. 2 attempts with a short backoff). On timeout/network failure, return a clean JSON error with a sane status code (e.g. 504 with `{ error: "Pixabay is temporarily unreachable, try again." }`) — NOT a hang.
2. **`api/pixabay.ts` (Vercel handler):** add the same `AbortController` timeout + retry. On failure return a clean 502/504 JSON with a friendly `error` message, not a silent hang.
3. **`src/lib/pixabay.ts` `searchPixabay()`:** keep the existing error surfacing, but make the error message human-friendly (map the raw `Failed to fetch` / timeout into something like "Pixabay search timed out — please try again."). Optionally add a `retry` param or keep it simple. Preserve the existing response shape `{ total, totalHits, hits }`.
4. **`StockImagePanel.tsx`:** ensure the debounced search doesn't fire overlapping requests (abort or ignore stale responses) so a slow failed search doesn't get clobbered by the next keystroke, and the error state clears on a successful retry.

## Constraints

- Keep it minimal and consistent with the codebase (React 19 + Vite + TS, no new heavy deps — use `AbortController`, built-in).
- Do NOT touch image rendering/drag-drop/CORS unless you find a concrete bug there (it already works).
- Do NOT change the Pixabay API key handling in `.env` (`.env` is untracked — don't commit it).
- Preserve the 24h cache behavior in `api/pixabay.ts`.

## Verification (MUST actually run)

1. `npm run dev` is already running on :5173. Confirm `curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/api/pixabay?q=test"` → 200.
2. Simulate a slow upstream and confirm the proxy now returns a clean JSON error within ~10s instead of hanging (you can temporarily point the target at a non-routable host or use a delay to prove the timeout fires). Then restore.
3. Run `npm run build` (or `tsc -b`) to confirm types are clean.
4. Manually confirm via browser that a search in the stock panel returns images (and that the error message is now friendly when the upstream is down).

Report: what you changed, exact commands run, and test results.
