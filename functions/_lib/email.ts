type MailchannelsRequest = {
  personalizations: Array<{ to: Array<{ email: string }> }>
  from: { email: string; name?: string }
  subject: string
  content: Array<{ type: 'text/plain'; value: string }>
}

export async function sendEmailViaMailchannels(options: {
  to: string
  fromEmail: string
  fromName?: string
  subject: string
  text: string
}) {
  const payload: MailchannelsRequest = {
    personalizations: [{ to: [{ email: options.to }] }],
    from: { email: options.fromEmail, name: options.fromName },
    subject: options.subject,
    content: [{ type: 'text/plain', value: options.text }]
  }

  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`MailChannels failed: ${res.status} ${body}`)
  }
}

/**
 * Dev Mode Email Helper
 *
 * Checks if we're in development mode:
 * - DEV_MODE=true OR
 * - MAIL_FROM_EMAIL not configured
 *
 * In dev mode, emails are NOT sent - codes are stored in DB for retrieval
 */
export function isDevMode(env: { DEV_MODE?: string; MAIL_FROM_EMAIL?: string }): boolean {
  return env.DEV_MODE === 'true' || !env.MAIL_FROM_EMAIL
}

/**
 * Send auth code email (dev mode aware)
 *
 * In dev mode: Logs to console, stores plaintext in DB
 * In prod mode: Sends real email via MailChannels
 */
export async function sendAuthCodeEmail(
  env: { DB: D1Database; DEV_MODE?: string; MAIL_FROM_EMAIL?: string; MAIL_FROM_NAME?: string },
  email: string,
  code: string
): Promise<void> {
  if (isDevMode(env)) {
    // Development mode: Store plaintext code and log it
    await env.DB.prepare('UPDATE auth_codes SET code_plaintext = ? WHERE email = ?')
      .bind(code, email)
      .run()

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔐 DEV MODE: Auth code for ${email}`)
    console.log(`   Code: ${code}`)
    console.log(`   Retrieve via: GET /api/auth/dev-code?email=${encodeURIComponent(email)}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    return
  }

  // Production mode: Send real email
  await sendEmailViaMailchannels({
    to: email,
    fromEmail: env.MAIL_FROM_EMAIL!,
    fromName: env.MAIL_FROM_NAME || 'ClipClash',
    subject: 'Your ClipClash Login Code',
    text: `Your login code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`
  })
}
