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

export function isDevMode(env: { DEV_MODE?: string; MAIL_FROM_EMAIL?: string }): boolean {
  return env.DEV_MODE === 'true' || !env.MAIL_FROM_EMAIL
}
