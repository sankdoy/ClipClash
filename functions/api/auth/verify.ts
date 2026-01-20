import { clearCookie, json, logEvent, setCookie, Env } from '../_helpers'
import { isBlocked } from '../../../shared/moderation'

function hashCode(code: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
}

function sanitizeUsername(email: string) {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9]+/g, '').slice(0, 12) || 'player'
  return base.toLowerCase()
}

async function findAvailableUsername(env: Env, base: string) {
  let candidate = base
  let suffix = 0
  while (suffix < 1000) {
    const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?')
      .bind(candidate)
      .first()
    if (!exists) return candidate
    suffix += 1
    candidate = `${base}${suffix}`
  }
  return `player${Math.floor(Math.random() * 9999)}`
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!email || !code) {
    await logEvent(env, {
      level: 'warn',
      eventType: 'auth_verify_invalid',
      message: 'Invalid verify payload.',
      meta: { email }
    })
    return json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const record = await env.DB.prepare(
    'SELECT code_hash, expires_at FROM auth_codes WHERE email = ?'
  )
    .bind(email)
    .first()
  if (!record || record.expires_at < new Date().toISOString()) {
    await logEvent(env, {
      level: 'warn',
      eventType: 'auth_verify_expired',
      message: 'Code expired.',
      meta: { email }
    })
    return json({ ok: false, error: 'Code expired.' }, { status: 400 })
  }

  const hash = await hashCode(code)
  const hashHex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
  if (hashHex !== record.code_hash) {
    await logEvent(env, {
      level: 'warn',
      eventType: 'auth_verify_mismatch',
      message: 'Invalid code.',
      meta: { email }
    })
    return json({ ok: false, error: 'Invalid code.' }, { status: 400 })
  }

  await env.DB.prepare('DELETE FROM auth_codes WHERE email = ?').bind(email).run()

  const now = new Date().toISOString()
  let user = await env.DB.prepare('SELECT id, username, avatar_url FROM users WHERE email = ?')
    .bind(email)
    .first()
  if (!user) {
    const base = sanitizeUsername(email)
    const candidate = isBlocked(base) ? `player${Math.floor(Math.random() * 9999)}` : await findAvailableUsername(env, base)
    const id = crypto.randomUUID()
    await env.DB.prepare(
      'INSERT INTO users (id, email, username, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(id, email, candidate, now, now)
      .run()
    await env.DB.prepare(
      'INSERT INTO stats (user_id, games_played, wins, category_wins, updated_at) VALUES (?, 0, 0, 0, ?)'
    )
      .bind(id, now)
      .run()
    user = { id, username: candidate, avatar_url: null }
  }

  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, user.id, now, expires)
    .run()

  const headers = new Headers()
  headers.append('Set-Cookie', setCookie('cc_session', token, { maxAge: 60 * 60 * 24 * 30 }))
  await logEvent(env, {
    level: 'info',
    eventType: 'auth_verify_success',
    accountId: user.id
  })
  return json({ ok: true, user }, { headers })
}
