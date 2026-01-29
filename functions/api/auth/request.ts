import { json, logEvent, Env } from '../_helpers'
import { sendAuthCodeEmail } from '../../_lib/email'

function hashCode(code: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    return json({ ok: false, error: 'Invalid email.' }, { status: 400 })
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const hash = await hashCode(code)
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const now = new Date()
  const expires = new Date(now.getTime() + 10 * 60 * 1000)

  await env.DB.prepare('DELETE FROM auth_codes WHERE email = ?').bind(email).run()
  await env.DB.prepare('INSERT INTO auth_codes (email, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(email, hashHex, now.toISOString(), expires.toISOString())
    .run()

  // Send email (dev mode aware - will log to console in dev, send real email in prod)
  try {
    await sendAuthCodeEmail(env, email, code)
    await logEvent(env, {
      level: 'info',
      eventType: 'auth_request',
      message: 'Login code issued and email sent.',
      meta: { email }
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      eventType: 'auth_request',
      message: `Failed to send auth code email: ${error}`,
      meta: { email }
    })
    // Don't fail the request - code is still in DB
  }

  return json({ ok: true })
}
