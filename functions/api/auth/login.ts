import { json, logEvent, setCookie, type Env } from '../_helpers'
import { verifyPassword } from '../../_lib/password'

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    return json({ ok: false, error: 'Email and password required.' }, { status: 400 })
  }

  const user = await env.DB.prepare(
    'SELECT id, email, username, avatar_url, password_hash FROM users WHERE email = ?'
  ).bind(email).first() as { id: string; email: string; username: string; avatar_url: string | null; password_hash: string | null } | null

  if (!user || !user.password_hash) {
    await logEvent(env, { level: 'warn', eventType: 'auth_login_fail', meta: { email } })
    return json({ ok: false, error: 'Invalid email or password.' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    await logEvent(env, { level: 'warn', eventType: 'auth_login_fail', meta: { email } })
    return json({ ok: false, error: 'Invalid email or password.' }, { status: 401 })
  }

  const now = new Date().toISOString()
  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, user.id, now, expires).run()

  const headers = new Headers()
  headers.append('Set-Cookie', setCookie('cc_session', token, { maxAge: 60 * 60 * 24 * 30 }))

  await logEvent(env, { level: 'info', eventType: 'auth_login_success', accountId: user.id })
  return json({
    ok: true,
    user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url }
  }, { headers })
}
