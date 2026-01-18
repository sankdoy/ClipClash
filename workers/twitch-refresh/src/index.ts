type Env = {
  DB: D1Database
  TWITCH_CLIENT_ID?: string
  TWITCH_CLIENT_SECRET?: string
  ALLOW_MANUAL_REFRESH?: string
}

type TwitchStream = {
  id: string
  user_id: string
  user_login: string
  user_name: string
  viewer_count: number
}

type TwitchResponse = {
  data: TwitchStream[]
  pagination?: { cursor?: string }
}

async function getTwitchToken(env: Env) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    throw new Error('Missing Twitch client credentials')
  }
  const params = new URLSearchParams()
  params.set('client_id', env.TWITCH_CLIENT_ID)
  params.set('client_secret', env.TWITCH_CLIENT_SECRET)
  params.set('grant_type', 'client_credentials')
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: params
  })
  if (!res.ok) {
    throw new Error(`Twitch token error: ${res.status}`)
  }
  const data = await res.json()
  return data.access_token as string
}

async function fetchTopStreams(env: Env, token: string) {
  const all: TwitchStream[] = []
  let cursor: string | undefined
  while (all.length < 250) {
    const url = new URL('https://api.twitch.tv/helix/streams')
    url.searchParams.set('first', '100')
    if (cursor) url.searchParams.set('after', cursor)
    const res = await fetch(url.toString(), {
      headers: {
        'Client-Id': env.TWITCH_CLIENT_ID ?? '',
        Authorization: `Bearer ${token}`
      }
    })
    if (!res.ok) {
      throw new Error(`Twitch streams error: ${res.status}`)
    }
    const payload = (await res.json()) as TwitchResponse
    all.push(...payload.data)
    cursor = payload.pagination?.cursor
    if (!cursor || payload.data.length === 0) break
  }
  return all.slice(0, 250)
}

async function refreshCache(env: Env) {
  const token = await getTwitchToken(env)
  const streams = await fetchTopStreams(env, token)
  const now = Date.now()
  await env.DB.prepare('DELETE FROM twitch_top250_cache').run()
  const statements = streams.map((stream, index) =>
    env.DB.prepare(
      `INSERT INTO twitch_top250_cache
        (rank, broadcaster_id, login, display_name, viewer_count, sampled_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(index + 1, stream.user_id, stream.user_login, stream.user_name, stream.viewer_count, now)
  )
  if (statements.length > 0) {
    await env.DB.batch(statements)
  }
  return { ok: true, count: streams.length, sampled_at: now }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env) {
    await refreshCache(env)
  },
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname === '/__refresh' && env.ALLOW_MANUAL_REFRESH === 'true') {
      try {
        const result = await refreshCache(env)
        return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Refresh failed'
        return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 })
      }
    }
    return new Response('Not found', { status: 404 })
  }
}
