type Env = {
  TWITCH_CLIENT_ID?: string
  TWITCH_CLIENT_SECRET?: string
}

type TwitchStream = {
  viewer_count: number
}

type TwitchResponse = {
  data: TwitchStream[]
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

export async function onRequest({ request, env }: { request: Request; env: Env }) {
  const url = new URL(request.url)
  const login = url.searchParams.get('login')?.trim().toLowerCase()
  if (!login) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing login' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    })
  }

  try {
    const token = await getTwitchToken(env)
    const twitchUrl = new URL('https://api.twitch.tv/helix/streams')
    twitchUrl.searchParams.set('user_login', login)
    const res = await fetch(twitchUrl.toString(), {
      headers: {
        'Client-Id': env.TWITCH_CLIENT_ID ?? '',
        Authorization: `Bearer ${token}`
      }
    })
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Twitch request failed' }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      })
    }
    const data = (await res.json()) as TwitchResponse
    const stream = data.data?.[0]
    const viewerCount = stream?.viewer_count ?? 0
    const isLive = Boolean(stream)
    const effectiveViewers = Math.floor(viewerCount * 0.9)
    return new Response(JSON.stringify({ ok: true, isLive, viewerCount, effectiveViewers }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live check failed'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
}
