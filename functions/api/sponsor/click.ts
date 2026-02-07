import { json, type Env } from '../_helpers'

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const sponsorId = typeof body?.sponsorId === 'string' ? body.sponsorId : ''
  const campaignId = typeof body?.campaignId === 'string' ? body.campaignId : ''

  if (!sponsorId) {
    return json({ ok: false }, { status: 400 })
  }

  try {
    await env.DB.prepare(
      `INSERT INTO sponsor_clicks (id, sponsor_id, campaign_id, clicked_at, referrer)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        sponsorId,
        campaignId,
        Date.now(),
        request.headers.get('referer') ?? null
      )
      .run()
  } catch {
    // Best-effort tracking — don't block the user
  }

  return json({ ok: true })
}
