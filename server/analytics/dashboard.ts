import type { AnalyticsStats, CountItem } from './types'
import { getEnvLabel } from './env'

const RANGE_LABELS: Record<number, string> = {
  1: 'Today',
  7: 'Last 7 days',
  30: 'Last 30 days',
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function formatTime(timestamp: number): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(parsed)
}

function countryLabel(code: string): string {
  if (code === 'XX' || code === 'T1') return 'Unknown'
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code)
    return name && name !== code ? `${code} · ${name}` : code
  } catch {
    return code
  }
}

function titleCase(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const STYLES = `
:root{
  color-scheme:dark;
  --bg:#09090b;--panel:#111113;--panel-2:#151518;--line:#232327;
  --text:#f4f4f5;--muted:#a1a1aa;--accent:#c7f464;--bad:#fca5a5
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text)}
body{font:14px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:1080px;margin:0 auto;padding:32px 20px 64px}
header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin-bottom:26px}
.brand{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:650;letter-spacing:-.01em}
.env{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#1a2e05;background:var(--accent);border-radius:999px;padding:3px 8px}
.header-right{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.tabs{display:flex;gap:3px;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:3px}
.tabs a{padding:5px 12px;border-radius:999px;color:var(--muted);text-decoration:none;font-size:12px;transition:color .15s,background .15s}
.tabs a:hover{color:var(--text)}
.tabs a[aria-current="page"]{background:#2a2a2e;color:var(--text)}
.linkbtn{background:none;border:0;color:var(--muted);font:inherit;font-size:12px;cursor:pointer;padding:0}
.linkbtn:hover{color:var(--text)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(152px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.metric .k{color:var(--muted);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.09em}
.metric .v{font-size:27px;font-weight:650;letter-spacing:-.02em;margin-top:7px;font-variant-numeric:tabular-nums}
.metric .s{color:var(--muted);font-size:11.5px;margin-top:2px}
.section{margin-top:28px}
h2{font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin:0 0 11px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:8px 0;border-bottom:1px solid #1b1b1e;font-size:13px;vertical-align:top}
th{color:var(--muted);font-weight:500;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em}
td.n{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);white-space:nowrap;padding-left:10px}
tr:last-child td{border-bottom:0}
.name{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar{height:4px;background:#26262a;border-radius:999px;overflow:hidden;margin-top:5px}
.bar span{display:block;height:100%;background:var(--accent);border-radius:999px;min-width:2px}
.chart{display:flex;align-items:flex-end;gap:3px;height:120px;padding:10px 0 0}
.chart span{flex:1;min-height:2px;background:linear-gradient(180deg,var(--accent),#4d7c0f);border-radius:3px 3px 0 0;opacity:.9}
.chart-labels{display:flex;justify-content:space-between;color:var(--muted);font-size:10.5px;margin-top:7px}
.empty{color:var(--muted);font-size:12.5px;padding:8px 0}
.muted{color:var(--muted)}
.foot{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:11.5px;line-height:1.7}
.foot strong{color:#d4d4d8;font-weight:500}
.login{min-height:100vh;display:grid;place-items:center;padding:20px}
.login .card{width:100%;max-width:370px;padding:26px}
.login h1{font-size:20px;margin:0 0 4px;letter-spacing:-.01em}
.login p{color:var(--muted);font-size:13px;margin:6px 0 0}
label{display:block;color:var(--muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-top:18px}
input[type=password]{width:100%;margin-top:7px;padding:10px 12px;border-radius:9px;border:1px solid var(--line);background:#0c0c0e;color:var(--text);font:inherit;outline:none}
input[type=password]:focus{border-color:#52525b;box-shadow:0 0 0 3px #27272a}
button.primary{width:100%;margin-top:16px;padding:10px 12px;border:0;border-radius:9px;background:var(--accent);color:#1a2e05;font:inherit;font-weight:650;cursor:pointer}
button.primary:hover{filter:brightness(1.05)}
.err{color:var(--bad);font-size:12.5px;margin-top:12px}
.notice{margin-top:16px;padding:12px;border:1px solid #3f3f46;border-radius:10px;background:#18181b;color:var(--muted);font-size:12.5px}
.notice strong{color:var(--text);font-weight:600}
code{font:11.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:#1c1c20;padding:2px 5px;border-radius:5px;color:#e4e4e7}
ol.steps{margin:12px 0 0;padding-left:20px;color:var(--muted);font-size:13px}
ol.steps li{margin:8px 0}
ol.steps code{white-space:nowrap}
@media (max-width:640px){
  .wrap{padding:20px 14px 44px}
  .metric .v{font-size:22px}
  .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .header-right{gap:10px}
}
`

function page(title: string, body: string, bodyClass = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${body}
</body>
</html>`
}

function countTable(title: string, items: CountItem[], format: (name: string) => string): string {
  if (items.length === 0) {
    return `<div class="card"><h2>${escapeHtml(title)}</h2><p class="empty">No data yet.</p></div>`
  }
  const max = Math.max(...items.map((item) => item.count), 1)
  const rows = items
    .map((item) => {
      const width = Math.max(2, Math.round((item.count / max) * 100))
      return `<tr>
<td><span class="name" title="${escapeHtml(format(item.name))}">${escapeHtml(format(item.name))}</span><div class="bar"><span style="width:${width}%"></span></div></td>
<td class="n">${formatNumber(item.count)}</td>
</tr>`
    })
    .join('')
  return `<div class="card"><h2>${escapeHtml(title)}</h2><table><tbody>${rows}</tbody></table></div>`
}

function metrics(stats: AnalyticsStats): string {
  const pagesPerSession =
    stats.totals.sessions > 0 ? stats.totals.pageviews / stats.totals.sessions : 0
  const cards: Array<[string, string, string]> = [
    [
      'Unique visitors',
      formatNumber(stats.totals.visitors),
      'anonymous IDs in range',
    ],
    ['Pageviews', formatNumber(stats.totals.pageviews), `${pagesPerSession.toFixed(1)} per session`],
    ['Sessions', formatNumber(stats.totals.sessions), '30 min timeout'],
    [
      'Bounce rate',
      formatPercent(stats.totals.bounceRate),
      `${formatNumber(stats.totals.bounces)} of ${formatNumber(stats.totals.sessionEnds)} ended`,
    ],
    [
      'Avg. session',
      formatDuration(stats.totals.avgDurationSeconds),
      'ended sessions',
    ],
    [
      'Pages / session',
      pagesPerSession.toFixed(1),
      'all sessions',
    ],
  ]
  return `<div class="grid">${cards
    .map(
      ([label, value, sub]) =>
        `<div class="card metric"><div class="k">${escapeHtml(label)}</div><div class="v">${value}</div><div class="s">${escapeHtml(sub)}</div></div>`,
    )
    .join('')}</div>`
}

function chart(stats: AnalyticsStats): string {
  if (stats.range.days <= 1) return ''
  const values = stats.daily.map((point) => point.pageviews)
  const max = Math.max(...values, 1)
  const bars = stats.daily
    .map((point) => {
      const height = point.pageviews > 0 ? Math.max(4, Math.round((point.pageviews / max) * 100)) : 2
      return `<span style="height:${height}%" title="${point.date}: ${formatNumber(point.pageviews)} pageviews"></span>`
    })
    .join('')
  return `<div class="section"><div class="card"><h2>Pageviews per day</h2><div class="chart">${bars}</div><div class="chart-labels"><span>${escapeHtml(formatDate(stats.range.from))}</span><span>${escapeHtml(formatDate(stats.range.to))}</span></div></div></div>`
}

function utmCard(stats: AnalyticsStats): string {
  const groups: Array<[string, CountItem[]]> = [
    ['Source', stats.utm.sources],
    ['Medium', stats.utm.mediums],
    ['Campaign', stats.utm.campaigns],
  ]
  const extras: Array<[string, CountItem[]]> = [
    ['Term', stats.utm.terms],
    ['Content', stats.utm.contents],
  ]
  const hasExtras = extras.some(([, items]) => items.length > 0)
  return `<div class="card"><h2>Campaigns (UTM)</h2>${renderGroups(groups)}${hasExtras ? renderGroups(extras) : ''}</div>`
}

function renderGroups(groups: Array<[string, CountItem[]]>): string {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px">${groups
    .map(([label, items]) => {
      const rows =
        items.length > 0
          ? items
              .map(
                (item) =>
                  `<tr><td><span class="name">${escapeHtml(item.name)}</span></td><td class="n">${formatNumber(item.count)}</td></tr>`,
              )
              .join('')
          : `<tr><td colspan="2" class="empty">None</td></tr>`
      return `<div><h2 style="margin-bottom:6px">${escapeHtml(label)}</h2><table><tbody>${rows}</tbody></table></div>`
    })
    .join('')}</div>`
}

function recentTable(stats: AnalyticsStats): string {
  if (stats.recent.length === 0) {
    return `<div class="card"><h2>Latest activity</h2><p class="empty">No visits recorded yet.</p></div>`
  }
  const rows = stats.recent
    .map(
      (visit) => `<tr>
<td class="muted" style="white-space:nowrap">${escapeHtml(formatTime(visit.t))}</td>
<td><span class="name">${escapeHtml(visit.p)}</span></td>
<td><span class="name">${escapeHtml(visit.r)}</span></td>
<td style="white-space:nowrap">${escapeHtml(countryLabel(visit.c))}</td>
<td class="muted">${escapeHtml(titleCase(visit.d))}</td>
</tr>`,
    )
    .join('')
  return `<div class="card"><h2>Latest activity</h2><table>
<thead><tr><th>Time (UTC)</th><th>Page</th><th>Source</th><th>Country</th><th>Device</th></tr></thead>
<tbody>${rows}</tbody></table></div>`
}

export function renderDashboard(stats: AnalyticsStats, options: { env: string }): string {
  const days = stats.range.days
  const rangeLinks = [1, 7, 30]
    .map(
      (value) =>
        `<a href="/analytics?range=${value}"${value === days ? ' aria-current="page"' : ''}>${RANGE_LABELS[value]}</a>`,
    )
    .join('')

  const updated = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date())

  const hasData = stats.totals.pageviews > 0

  return page(
    'Analytics — PureCanvas',
    `<main class="wrap">
<header>
  <div class="brand">PureCanvas Analytics <span class="env">${escapeHtml(getEnvLabel(options.env))}</span></div>
  <div class="header-right">
    <nav class="tabs" aria-label="Date range">${rangeLinks}</nav>
    <form method="post" action="/api/analytics/logout"><button class="linkbtn" type="submit">Sign out</button></form>
  </div>
</header>
<div class="muted" style="font-size:11.5px;margin:-10px 0 18px">Updated ${escapeHtml(updated)} UTC · ${escapeHtml(getEnvLabel(options.env))} data</div>
${metrics(stats)}
${hasData ? '' : `<div class="section"><div class="card"><p class="empty">No analytics yet for this range. Open <a href="/">PureCanvas</a> in a browser that allows analytics, then reload this page.</p></div></div>`}
${chart(stats)}
<div class="section"><div class="cols">
${countTable('Top pages', stats.pages, (name) => name)}
${countTable('Referrers', stats.referrers, (name) => name)}
</div></div>
<div class="section"><div class="cols">
${utmCard(stats)}
${countTable('Countries', stats.countries, countryLabel)}
</div></div>
<div class="section"><div class="cols">
${countTable('Devices', stats.devices, titleCase)}
${countTable('Browsers', stats.browsers, titleCase)}
</div></div>
<div class="section">${recentTable(stats)}</div>
<div class="foot">
  <strong>How this works.</strong> First-party analytics, stored per environment
  (${escapeHtml(getEnvLabel(options.env))}) in Redis. Analytics uses no cookies and does not store
  IP addresses. A visitor is a random ID kept in the browser. A bounce is a
  session that ended after a single pageview in under 10 seconds with no
  interaction. Acquisition (referrer and UTM tags) is attributed to the first
  page of a session. Aggregated data expires after 13 months.
</div>
</main>`,
  )
}

export function renderLogin(query: URLSearchParams, options: { env: string; passwordSet: boolean }): string {
  const error = query.get('error')
  const messages: Record<string, string> = {
    '1': 'Incorrect password.',
    rate: 'Too many attempts. Try again in a few minutes.',
    config: 'ANALYTICS_PASSWORD is not set on the server.',
  }
  const message = error ? messages[error] : ''
  return page(
    'Sign in — PureCanvas Analytics',
    `<main class="login">
<div class="card">
  <div class="brand" style="margin-bottom:16px">PureCanvas Analytics <span class="env">${escapeHtml(getEnvLabel(options.env))}</span></div>
  <h1>Sign in</h1>
  <p>Enter the analytics password to view this environment's traffic.</p>
  ${
    options.passwordSet
      ? `<form method="post" action="/api/analytics/login">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required autofocus autocomplete="current-password">
    <button class="primary" type="submit">Sign in</button>
  </form>`
      : `<div class="notice"><strong>Not configured.</strong> Set <code>ANALYTICS_PASSWORD</code> in this deployment's environment variables, then redeploy.</div>`
  }
  ${message ? `<p class="err">${escapeHtml(message)}</p>` : ''}
  <div class="notice">Server-side password check. A signed, HttpOnly session cookie keeps you signed in for 12 hours.</div>
</div>
</main>`,
    'login-body',
  )
}

export function renderSetup(options: {
  env: string
  reason: string
  passwordSet: boolean
}): string {
  return page(
    'Analytics setup — PureCanvas',
    `<main class="wrap">
<header>
  <div class="brand">PureCanvas Analytics <span class="env">${escapeHtml(getEnvLabel(options.env))}</span></div>
  <div class="header-right">
    <form method="post" action="/api/analytics/logout"><button class="linkbtn" type="submit">Sign out</button></form>
  </div>
</header>
<div class="card">
  <h2>Storage isn't configured</h2>
  <p class="empty">${escapeHtml(options.reason)}</p>
  <ol class="steps">
    <li>In Vercel, open <strong>Storage → Marketplace</strong> and create a free <strong>Upstash Redis</strong> database, connected to this project.</li>
    <li>Confirm these variables exist in <strong>Project Settings → Environment Variables</strong> for Production: <code>UPSTASH_REDIS_REST_URL</code> and <code>UPSTASH_REDIS_REST_TOKEN</code> (or the names your integration created, such as <code>UPSTASH_REDIS_REST_KV_REST_API_URL</code> and <code>UPSTASH_REDIS_REST_KV_REST_API_TOKEN</code>; both forms are detected).</li>
    <li>Redeploy. This page will then show live data.</li>
  </ol>
  <div class="notice">
    <strong>Environment separation.</strong> Data is namespaced by <code>VERCEL_ENV</code>
    (${escapeHtml(getEnvLabel(options.env))}); preview deployments and local development never write into
    production analytics. Locally, events are written to <code>.data/analytics-dev.json</code>.
  </div>
  <div class="notice">
    <strong>Password.</strong> <code>ANALYTICS_PASSWORD</code> is
    ${options.passwordSet ? 'set on this deployment.' : 'not set on this deployment.'}
    Optionally set <code>ANALYTICS_SESSION_SECRET</code> to a long random value to sign admin sessions.
  </div>
</div>
</main>`,
  )
}

export function renderDashboardError(message: string): string {
  return page(
    'Analytics error — PureCanvas',
    `<main class="wrap"><div class="card"><h2>Couldn't load analytics</h2><p class="empty">${escapeHtml(message)}</p><p class="empty">Check the function logs for details.</p></div></main>`,
  )
}
