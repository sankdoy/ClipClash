import { json, Env } from '../_helpers'
import { requireOwner } from './_helpers'

function startOfDayIso() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return start.toISOString()
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const auth = await requireOwner(env, request)
  if (!auth.ok) return auth.response

  const sinceIso = startOfDayIso()
  const sinceMs = new Date(sinceIso).getTime()

  const [rooms24h, players24h, accounts24h] = await Promise.all([
    env.DB.prepare(
      'SELECT COUNT(DISTINCT room_id) AS value FROM event_logs WHERE room_id IS NOT NULL AND created_at >= ?'
    )
      .bind(sinceMs)
      .first(),
    env.DB.prepare(
      'SELECT COUNT(DISTINCT player_id) AS value FROM event_logs WHERE player_id IS NOT NULL AND created_at >= ?'
    )
      .bind(sinceMs)
      .first(),
    env.DB.prepare(
      'SELECT COUNT(DISTINCT account_id) AS value FROM event_logs WHERE account_id IS NOT NULL AND created_at >= ?'
    )
      .bind(sinceMs)
      .first()
  ])

  const paymentsToday = await env.DB.prepare(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS total_cents, COALESCE(MIN(currency), 'usd') AS currency
     FROM payments
     WHERE created_at >= ?`
  )
    .bind(sinceIso)
    .first()

  const donationsToday = await env.DB.prepare(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS total_cents, COALESCE(MIN(currency), 'usd') AS currency
     FROM donations
     WHERE created_at >= ?`
  )
    .bind(sinceIso)
    .first()

  const warnings = await env.DB.prepare(
    `SELECT id, level, event_type, message, room_id, player_id, account_id, meta_json, created_at
     FROM event_logs
     WHERE level != 'info'
     ORDER BY created_at DESC
     LIMIT 50`
  ).all()

  const reports = await env.DB.prepare(
    `SELECT id, room_id, message_id, reporter_id, reported_at
     FROM reports
     ORDER BY reported_at DESC
     LIMIT 50`
  ).all()

  const publicRooms = await env.DB.prepare(
    `SELECT room_id as id, name, players, capacity, last_seen_at, created_at
     FROM public_rooms
     WHERE visibility = 'public'
     ORDER BY last_seen_at DESC
     LIMIT 50`
  ).all()

  return json({
    ok: true,
    since: { iso: sinceIso, ms: sinceMs },
    usage: {
      rooms_today: Number((rooms24h as any)?.value ?? 0),
      players_today: Number((players24h as any)?.value ?? 0),
      accounts_today: Number((accounts24h as any)?.value ?? 0)
    },
    revenue: {
      payments_today: {
        count: Number((paymentsToday as any)?.count ?? 0),
        total_cents: Number((paymentsToday as any)?.total_cents ?? 0),
        currency: String((paymentsToday as any)?.currency ?? 'usd')
      },
      donations_today: {
        count: Number((donationsToday as any)?.count ?? 0),
        total_cents: Number((donationsToday as any)?.total_cents ?? 0),
        currency: String((donationsToday as any)?.currency ?? 'usd')
      }
    },
    warnings: warnings.results ?? [],
    reports: reports.results ?? [],
    publicRooms: publicRooms.results ?? []
  })
}
