import { json, type Env } from '../_helpers'
import { extractVideoUrl } from './extractors'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

/**
 * POST /api/video/extract
 * Body: { url: string }
 * Extracts a direct video URL from a platform link, downloads it to R2,
 * and returns our own serve URL. The client never touches the platform CDN directly.
 */
export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return json({ ok: false, error: 'Missing url.' }, { status: 400 })
  }

  // Step 1: Extract the direct video URL from the platform
  const result = await extractVideoUrl(url)
  if (!result.ok) {
    return json({ ok: false, error: result.error }, { status: 502 })
  }

  // Step 2: Download the video using platform-specific headers
  try {
    const fetchHeaders: Record<string, string> = {
      'user-agent': USER_AGENT,
      ...(result.fetchHeaders ?? {})
    }

    const videoRes = await fetch(result.downloadUrl, { headers: fetchHeaders })
    if (!videoRes.ok || !videoRes.body) {
      return json({ ok: false, error: `Video download failed: ${videoRes.status}` }, { status: 502 })
    }

    // Step 3: Store the raw video in R2
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4'
    const ext = contentType.includes('webm') ? 'webm' : 'mp4'
    const key = `clips/raw-${crypto.randomUUID()}.${ext}`

    await env.VIDEOS.put(key, videoRes.body, {
      httpMetadata: { contentType },
      customMetadata: { createdAt: String(Date.now()), source: url }
    })

    // Step 4: Return our R2 serve URL
    const origin = new URL(request.url).origin
    const downloadUrl = `${origin}/api/video/${key}`

    return json({ ok: true, downloadUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed'
    return json({ ok: false, error: message }, { status: 500 })
  }
}
