import type { Env } from '../_helpers'
import { getDB, logEvent } from '../../_lib/db'
import { badRequest, jsonOk } from '../../_lib/responses'
import { validateBrandName, validateEmail, validateHttpsUrl, validateTagline } from '../../_lib/validate'

type PurchasePayload = {
  creditBundles?: Array<{ credits: number; count: number }>
}

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  const contentType = request.headers.get('content-type') ?? ''
  let brandName = ''
  let contactEmail = ''
  let destinationUrl = ''
  let tagline = ''
  let imageUrl = ''
  let credits = 0
  let purchased: PurchasePayload = {}
  let notes: string | null = null

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null)
    brandName = String(body?.brandName ?? '').trim()
    contactEmail = String(body?.contactEmail ?? '').trim()
    destinationUrl = String(body?.clickUrl ?? '').trim()
    tagline = String(body?.tagline ?? '').trim()
    imageUrl = String(body?.imageUrl ?? '').trim()
    credits = Number(body?.credits ?? 0)
    purchased = (body?.purchased ?? {}) as PurchasePayload
    notes = String(body?.notes ?? '').trim() || null
  } else {
    const formData = await request.formData()
    brandName = String(formData.get('brand_name') ?? '').trim()
    contactEmail = String(formData.get('contact_email') ?? '').trim()
    destinationUrl = String(formData.get('destination_url') ?? '').trim()
    tagline = String(formData.get('tagline') ?? '').trim()
    imageUrl = String(formData.get('image_url') ?? '').trim()
    credits = Number(formData.get('credits') ?? 0)
    notes = String(formData.get('notes') ?? '').trim() || null
  }

  if (!validateHttpsUrl(destinationUrl)) {
    return badRequest('Invalid URL')
  }
  if (!validateBrandName(brandName)) {
    return badRequest('Invalid brand name')
  }
  if (!validateTagline(tagline)) {
    return badRequest('Invalid tagline')
  }
  if (!imageUrl) {
    return badRequest('Image URL required')
  }
  if (!validateEmail(contactEmail)) {
    return badRequest('Contact email required')
  }
  if (!Number.isFinite(credits) || credits <= 0) {
    return badRequest('Invalid credit count')
  }

  const sponsorId = crypto.randomUUID()
  const campaignId = crypto.randomUUID()
  const createdAt = Date.now()
  const db = getDB(env)
  await db.prepare(
    `
    INSERT INTO sponsors (id, name, status, created_at)
    VALUES (?, ?, ?, ?)
    `
  )
    .bind(sponsorId, brandName, 'pending', createdAt)
    .run()

  await db.prepare(
    `
    INSERT INTO sponsor_campaigns_v2
      (id, sponsor_id, creative_url, click_url, tagline, status, starts_at, ends_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(campaignId, sponsorId, imageUrl, destinationUrl, tagline, 'pending', null, null)
    .run()

  await db.prepare(
    `
    INSERT INTO sponsor_balances
      (sponsor_id, credits_remaining, credits_purchased_total, credits_spent_total, current_weight, games_since_last_placement, last_shown_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      sponsorId,
      Math.floor(credits),
      Math.floor(credits),
      0,
      0,
      0,
      null,
      createdAt
    )
    .run()

  await logEvent(env, {
    level: 'info',
    eventType: 'sponsor_submit',
    meta: { sponsorId, campaignId, credits: Math.floor(credits) }
  })
  return jsonOk({ ok: true, sponsorId, campaignId })
}
