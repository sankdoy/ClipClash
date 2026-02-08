import type { Env } from '../_helpers'

/**
 * GET /api/video/proxy?url=<encoded-url>
 * Streams a remote video through our domain so the client can download it
 * without CORS issues. Used for fetching cobalt-extracted video URLs.
 */
export async function onRequestGet({ request }: { request: Request; env: Env }) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')
  if (!targetUrl) {
    return new Response('Missing url parameter.', { status: 400 })
  }

  try {
    const upstream = await fetch(targetUrl)
    if (!upstream.ok || !upstream.body) {
      return new Response(`Upstream returned ${upstream.status}`, { status: 502 })
    }

    const headers = new Headers()
    headers.set('Content-Type', upstream.headers.get('content-type') ?? 'video/mp4')
    headers.set('Access-Control-Allow-Origin', '*')
    if (upstream.headers.has('content-length')) {
      headers.set('Content-Length', upstream.headers.get('content-length')!)
    }
    // No caching — this is a one-time download before compression
    headers.set('Cache-Control', 'no-store')

    return new Response(upstream.body, { status: 200, headers })
  } catch {
    return new Response('Failed to fetch video.', { status: 502 })
  }
}
