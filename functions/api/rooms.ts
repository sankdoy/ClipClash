import type { Env } from './_helpers'

export async function onRequestGet({ env }: { env: Env }) {
  const cutoff = Date.now() - 10 * 60 * 1000
  const result = await env.DB.prepare(
    `SELECT room_id as id, name, players, capacity
     FROM public_rooms
     WHERE visibility = 'public' AND last_seen_at > ?
     ORDER BY last_seen_at DESC
     LIMIT 50`
  )
    .bind(cutoff)
    .all()
  return Response.json({ rooms: result.results ?? [] })
}
