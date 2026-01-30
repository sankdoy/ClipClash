import { json, logEvent, setCookie, type Env } from '../_helpers'
import { hashPassword } from '../../_lib/password'
import { sanitizeUsername, findAvailableUsername } from '../../_lib/username'

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !email.includes('@') || !email.includes('.')) {
    return json({ ok: false, error: 'Invalid email address.' }, { status: 400 })
  }
  if (password.length < 8) {
    return json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) {
    return json({ ok: false, error: 'An account with this email already exists.' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const base = sanitizeUsername(email)
  const username = await findAvailableUsername(env.DB, base)

  await env.DB.prepare(
    'INSERT INTO users (id, email, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, email, username, passwordHash, now, now).run()

  await env.DB.prepare(
    'INSERT INTO stats (user_id, games_played, wins, category_wins, updated_at) VALUES (?, 0, 0, 0, ?)'
  ).bind(id, now).run()

  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, id, now, expires).run()

  const headers = new Headers()
  headers.append('Set-Cookie', setCookie('cc_session', token, { maxAge: 60 * 60 * 24 * 30 }))

  await logEvent(env, { level: 'info', eventType: 'auth_register', accountId: id })
  return json({ ok: true, user: { id, email, username, avatar_url: null } }, { headers })
}
