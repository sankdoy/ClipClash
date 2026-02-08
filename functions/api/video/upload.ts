import { json, type Env } from '../_helpers'

/**
 * POST /api/video/upload
 * Accepts a raw video blob body and stores it in R2.
 * Returns the serve URL for playback.
 */
export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const contentType = request.headers.get('content-type') ?? 'video/webm'
  const body = request.body
  if (!body) {
    return json({ ok: false, error: 'Empty body.' }, { status: 400 })
  }

  const ext = contentType.includes('mp4') ? 'mp4' : 'webm'
  const key = `clips/${crypto.randomUUID()}.${ext}`

  try {
    await env.VIDEOS.put(key, body, {
      httpMetadata: { contentType },
      customMetadata: { createdAt: String(Date.now()) }
    })

    const origin = new URL(request.url).origin
    const serveUrl = `${origin}/api/video/${key}`

    return json({ ok: true, key, serveUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return json({ ok: false, error: message }, { status: 500 })
  }
}
