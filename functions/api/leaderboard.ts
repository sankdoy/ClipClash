import { json, Env } from './_helpers'

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const limit = Math.min(50, Math.max(10, Number(url.searchParams.get('limit') || 20)))
  const offset = (page - 1) * limit

  const results = await env.DB.prepare(
    'SELECT users.username, users.avatar_url, stats.games_played, stats.wins, stats.category_wins FROM stats JOIN users ON users.id = stats.user_id ORDER BY stats.wins DESC, stats.category_wins DESC LIMIT ? OFFSET ?'
  )
    .bind(limit, offset)
    .all()

  return json({ ok: true, page, limit, rows: results.results ?? [] })
}
