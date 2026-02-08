import { json, type Env } from '../_helpers'
import { extractVideoUrl } from './extractors'

/**
 * POST /api/video/extract
 * Body: { url: string }
 * Runs platform-specific extraction to resolve a direct video download URL.
 * Supports TikTok, Twitter/X, Reddit, Instagram, and Twitch.
 */
export async function onRequestPost({ request }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return json({ ok: false, error: 'Missing url.' }, { status: 400 })
  }

  const result = await extractVideoUrl(url)
  if (!result.ok) {
    return json({ ok: false, error: result.error }, { status: 502 })
  }

  return json({ ok: true, downloadUrl: result.downloadUrl })
}
