export function getDB(env: { DB: D1Database }) {
  return env.DB
}

type LogOptions = {
  level: 'info' | 'warn' | 'error'
  eventType: string
  message?: string
  roomId?: string | null
  playerId?: string | null
  accountId?: string | null
  meta?: Record<string, unknown>
}

export async function logEvent(env: { DB: D1Database }, options: LogOptions) {
  try {
    await env.DB.prepare(
      `INSERT INTO event_logs (id, level, event_type, message, room_id, player_id, account_id, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        options.level,
        options.eventType,
        options.message ?? null,
        options.roomId ?? null,
        options.playerId ?? null,
        options.accountId ?? null,
        options.meta ? JSON.stringify(options.meta) : null,
        Date.now()
      )
      .run()
  } catch {
    return
  }
}
