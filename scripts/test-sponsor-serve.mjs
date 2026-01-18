const login = process.env.TWITCH_LOGIN ?? 'example_login'
const viewerOverride = process.env.FAKE_VIEWERS ? Number(process.env.FAKE_VIEWERS) : null
const url = process.env.LIVE_CHECK_URL ?? `http://127.0.0.1:8788/api/sponsor/live-check?login=${encodeURIComponent(login)}`

let live = { isLive: false, viewerCount: 0, effectiveViewers: 0 }

if (viewerOverride !== null && Number.isFinite(viewerOverride)) {
  const viewerCount = Math.max(0, viewerOverride)
  live = {
    isLive: viewerCount > 0,
    viewerCount,
    effectiveViewers: Math.floor(viewerCount * 0.9)
  }
} else {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok || !data?.ok) {
    console.error('Live check failed', data)
    process.exit(1)
  }
  live = data
}

const credits = Number(process.env.STREAMER_CREDITS ?? 50000)
const canRun = live.isLive && credits >= live.effectiveViewers

console.log('Live check:', live)
const logLine = (label, value) => console.log(`${label}: ${value}`)
logLine('Streamer credits', credits)
logLine('Eligible', canRun ? 'yes' : 'no')
logLine('Credits remaining after', canRun ? credits - live.effectiveViewers : credits)
