import { json, logEvent, type Env } from '../_helpers'
import { hashPassword } from '../../_lib/password'

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!token || password.length < 8) {
    return json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const tokenHash = await sha256Hex(token)

  const record = await env.DB.prepare(
    'SELECT email, expires_at FROM password_resets WHERE token_hash = ?'
  ).bind(tokenHash).first() as { email: string; expires_at: string } | null

  if (!record || record.expires_at < new Date().toISOString()) {
    return json({ ok: false, error: 'Invalid or expired reset link.' }, { status: 400 })
  }

  const email = record.email
  const passwordHash = await hashPassword(password)

  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?')
    .bind(passwordHash, new Date().toISOString(), email).run()

  await env.DB.prepare('DELETE FROM password_resets WHERE email = ?').bind(email).run()

  // Invalidate all sessions for security
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first() as { id: string } | null
  if (user) {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run()
  }

  await logEvent(env, { level: 'info', eventType: 'password_reset_complete', meta: { email } })
  return json({ ok: true })
}
