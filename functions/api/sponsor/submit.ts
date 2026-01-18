import type { Env } from '../_helpers'
import { getDB } from '../../_lib/db'
import { badRequest, jsonOk } from '../../_lib/responses'
import { validateBrandName, validateEmail, validateHttpsUrl, validateTagline } from '../../_lib/validate'

type PurchasePayload = {
  standardBundles?: Array<{ games: number; count: number }>
  streamerBundles?: Array<{ credits: number; count: number }>
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
  let standardGames = 0
  let streamerViewerCredits = 0
  let purchased: PurchasePayload = {}
  let notes: string | null = null

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null)
    brandName = String(body?.brandName ?? '').trim()
    contactEmail = String(body?.contactEmail ?? '').trim()
    destinationUrl = String(body?.clickUrl ?? '').trim()
    tagline = String(body?.tagline ?? '').trim()
    imageUrl = String(body?.imageUrl ?? '').trim()
    standardGames = Number(body?.standardGames ?? 0)
    streamerViewerCredits = Number(body?.streamerViewerCredits ?? 0)
    purchased = (body?.purchased ?? {}) as PurchasePayload
    notes = String(body?.notes ?? '').trim() || null
  } else {
    const formData = await request.formData()
    brandName = String(formData.get('brand_name') ?? '').trim()
    contactEmail = String(formData.get('contact_email') ?? '').trim()
    destinationUrl = String(formData.get('destination_url') ?? '').trim()
    tagline = String(formData.get('tagline') ?? '').trim()
    imageUrl = String(formData.get('image_url') ?? '').trim()
    standardGames = Number(formData.get('standard_games') ?? 0)
    streamerViewerCredits = Number(formData.get('streamer_viewer_credits') ?? 0)
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
  if (!Number.isFinite(standardGames) || standardGames < 0) {
    return badRequest('Invalid standard games count')
  }
  if (!Number.isFinite(streamerViewerCredits) || streamerViewerCredits < 0) {
    return badRequest('Invalid streamer credits count')
  }

  const id = crypto.randomUUID()
  const createdAt = Date.now()
  const db = getDB(env)
  await db.prepare(
    `
    INSERT INTO sponsor_campaigns
      (id, created_at, brand_name, click_url, tagline, image_url, status, standard_games_remaining,
       streamer_viewer_credits_remaining, purchased_json, contact_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      id,
      createdAt,
      brandName,
      destinationUrl,
      tagline,
      imageUrl,
      'pending',
      Math.floor(standardGames),
      Math.floor(streamerViewerCredits),
      JSON.stringify(purchased ?? {}),
      contactEmail
    )
    .run()

  return jsonOk({ ok: true, id })
}
