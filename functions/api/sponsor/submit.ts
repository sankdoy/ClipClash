import type { Env } from '../_helpers'
import { getDB } from '../../_lib/db'
import { badRequest, jsonOk } from '../../_lib/responses'
import { validateBrandName, validateEmail, validateHttpsUrl, validateTagline } from '../../_lib/validate'

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  const formData = await request.formData()
  const brandName = String(formData.get('brand_name') ?? '').trim()
  const contactEmail = String(formData.get('contact_email') ?? '').trim()
  const destinationUrl = String(formData.get('destination_url') ?? '').trim()
  const tagline = String(formData.get('tagline') ?? '').trim()
  const imageUrl = String(formData.get('image_url') ?? '').trim()
  const inventoryType = String(formData.get('inventory_type') ?? '').trim()
  const tierKey = String(formData.get('tier_key') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

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

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const db = getDB(env)
  await db.prepare(
    `
    INSERT INTO sponsor_inquiries
      (id, created_at_iso, inventory_type, tier_key, brand_name, contact_email, destination_url, tagline, image_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(id, createdAt, inventoryType, tierKey, brandName, contactEmail, destinationUrl, tagline, imageUrl, notes)
    .run()

  return jsonOk({ ok: true })
}
