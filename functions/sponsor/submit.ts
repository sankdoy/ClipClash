import type { Env } from '../api/_helpers'

function validateUrl(value: string) {
  return value.startsWith('https://')
}

export async function onRequestPost({ env, request }: { env: Env; request: Request }) {
  const formData = await request.formData()
  const brandName = String(formData.get('brand_name') ?? '').trim()
  const contactEmail = String(formData.get('contact_email') ?? '').trim()
  const destinationUrl = String(formData.get('destination_url') ?? '').trim()
  const tagline = String(formData.get('tagline') ?? '').trim()
  const imageUrl = String(formData.get('image_url') ?? '').trim()
  const inventoryType = String(formData.get('inventory_type') ?? '').trim()
  const tierKey = String(formData.get('tier_key') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!validateUrl(destinationUrl)) {
    return new Response('Invalid URL', { status: 400 })
  }
  if (brandName.length === 0 || brandName.length > 40) {
    return new Response('Invalid brand name', { status: 400 })
  }
  if (tagline.length === 0 || tagline.length > 80) {
    return new Response('Invalid tagline', { status: 400 })
  }
  if (!imageUrl) {
    return new Response('Image URL required', { status: 400 })
  }
  if (!contactEmail) {
    return new Response('Contact email required', { status: 400 })
  }

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await env.DB.prepare(
    `
    INSERT INTO sponsor_inquiries
      (id, created_at_iso, inventory_type, tier_key, brand_name, contact_email, destination_url, tagline, image_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(id, createdAt, inventoryType, tierKey, brandName, contactEmail, destinationUrl, tagline, imageUrl, notes)
    .run()

  return new Response('Thanks — we will get back to you.', { status: 200 })
}
