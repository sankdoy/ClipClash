import { json, logEvent, type Env } from '../_helpers'
import { isDevMode, sendEmailViaMailchannels } from '../../_lib/email'

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return json({ ok: false, error: 'Invalid email.' }, { status: 400 })
  }

  // Always return success to prevent email enumeration
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (!user) {
    return json({ ok: true })
  }

  const token = crypto.randomUUID()
  const tokenHash = await sha256Hex(token)
  const now = new Date().toISOString()
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  await env.DB.prepare('DELETE FROM password_resets WHERE email = ?').bind(email).run()
  await env.DB.prepare(
    'INSERT INTO password_resets (email, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(email, tokenHash, now, expires).run()

  if (isDevMode(env)) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔑 DEV MODE: Password reset for ${email}`)
    console.log(`   Token: ${token}`)
    console.log(`   Link: /account?reset=${token}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  } else {
    const siteUrl = env.SITE_URL || 'https://clipclash.com'
    await sendEmailViaMailchannels({
      to: email,
      fromEmail: env.MAIL_FROM_EMAIL!,
      fromName: env.MAIL_FROM_NAME || 'ClipDuel',
      subject: 'Reset your ClipDuel password',
      text: `Click this link to reset your password:\n\n${siteUrl}/account?reset=${token}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`
    })
  }

  await logEvent(env, { level: 'info', eventType: 'password_reset_request', meta: { email } })
  return json({ ok: true })
}
