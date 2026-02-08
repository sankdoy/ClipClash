import { json, type Env } from '../_helpers'

/**
 * POST /api/video/extract
 * Body: { url: string }
 * Calls cobalt API to get a direct video download URL, downloads it to R2,
 * and returns the R2 serve key.
 */
export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return json({ ok: false, error: 'Missing url.' }, { status: 400 })
  }

  const cobaltUrl = env.COBALT_API_URL || 'https://api.cobalt.tools'

  try {
    // Step 1: Call cobalt to get the direct video URL
    const cobaltRes = await fetch(cobaltUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        videoQuality: '720',
        filenameStyle: 'basic'
      })
    })

    if (!cobaltRes.ok) {
      const text = await cobaltRes.text().catch(() => '')
      return json({ ok: false, error: `Extraction failed (${cobaltRes.status}): ${text.slice(0, 200)}` }, { status: 502 })
    }

    const cobaltData: any = await cobaltRes.json()

    // cobalt returns: { status: "redirect"|"tunnel"|"stream", url: "..." }
    // "redirect" = direct URL, "tunnel"/"stream" = cobalt proxied URL
    const videoUrl = cobaltData?.url
    if (!videoUrl || typeof videoUrl !== 'string') {
      return json({
        ok: false,
        error: cobaltData?.text || cobaltData?.error || 'No video URL returned from extraction service.'
      }, { status: 502 })
    }

    // Step 2: Download the video
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok || !videoRes.body) {
      return json({ ok: false, error: `Failed to download video (${videoRes.status}).` }, { status: 502 })
    }

    // Validate content type
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4'
    if (!contentType.startsWith('video/') && !contentType.startsWith('audio/')) {
      // Some services return application/octet-stream for videos
      // That's fine, we'll still store it
    }

    // Step 3: Store in R2
    const key = `clips/${crypto.randomUUID()}.mp4`
    await env.VIDEOS.put(key, videoRes.body, {
      httpMetadata: {
        contentType: contentType.startsWith('video/') ? contentType : 'video/mp4'
      },
      customMetadata: {
        sourceUrl: url,
        createdAt: String(Date.now())
      }
    })

    // Step 4: Return the serve URL
    const origin = new URL(request.url).origin
    const serveUrl = `${origin}/api/video/${key}`

    return json({ ok: true, key, serveUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ ok: false, error: message }, { status: 500 })
  }
}
