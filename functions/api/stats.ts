import { json, getSessionUser, type Env } from './_helpers'

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: false, error: 'Not signed in.' }, { status: 401 })
  }

  const row = await env.DB.prepare(
    'SELECT games_played, wins, category_wins, updated_at FROM stats WHERE user_id = ?'
  ).bind(user.id).first() as { games_played: number; wins: number; category_wins: number; updated_at: string } | null

  return json({
    ok: true,
    stats: row ?? { games_played: 0, wins: 0, category_wins: 0, updated_at: null }
  })
}
