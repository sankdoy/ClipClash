import { getSessionUser, isOwner, json, type Env } from './_helpers'

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user || !isOwner(user)) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 403 })
  }

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0)

  const reports = await env.DB.prepare(
    `SELECT id, room_id, message_id, reporter_id, reported_at,
            chat_log, reported_player_id, reported_player_name, message_text
     FROM reports
     ORDER BY reported_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all()

  const total = await env.DB.prepare('SELECT COUNT(*) as count FROM reports').first()

  return json({
    ok: true,
    reports: (reports.results ?? []).map((r) => ({
      id: r.id,
      roomId: r.room_id,
      messageId: r.message_id,
      reporterId: r.reporter_id,
      reportedAt: r.reported_at,
      reportedPlayerId: r.reported_player_id ?? null,
      reportedPlayerName: r.reported_player_name ?? null,
      messageText: r.message_text ?? null,
      chatLog: r.chat_log ? JSON.parse(String(r.chat_log)) : null
    })),
    total: Number(total?.count ?? 0)
  })
}
