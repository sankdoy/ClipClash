import { json, type Env } from '../_helpers'

/**
 * POST /api/video/extract
 * Body: { url: string }
 * Calls cobalt API to resolve a platform URL into a direct download link.
 * Does NOT download or store the video — the client handles that.
 */
export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return json({ ok: false, error: 'Missing url.' }, { status: 400 })
  }

  const cobaltUrl = env.COBALT_API_URL || 'https://api.cobalt.tools'

  try {
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
    const downloadUrl = cobaltData?.url
    if (!downloadUrl || typeof downloadUrl !== 'string') {
      return json({
        ok: false,
        error: cobaltData?.text || cobaltData?.error || 'No video URL returned.'
      }, { status: 502 })
    }

    return json({ ok: true, downloadUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ ok: false, error: message }, { status: 500 })
  }
}
