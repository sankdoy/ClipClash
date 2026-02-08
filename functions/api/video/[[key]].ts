import type { Env } from '../_helpers'

/**
 * GET /api/video/clips/<uuid>.mp4
 * Serves a video from R2 with proper streaming headers.
 * Supports Range requests for seeking.
 */
export async function onRequestGet({ request, params, env }: { request: Request; params: { key: string[] }; env: Env }) {
  const key = (params.key ?? []).join('/')
  if (!key) {
    return new Response('Not found', { status: 404 })
  }

  const object = await env.VIDEOS.get(key)
  if (!object) {
    return new Response('Not found', { status: 404 })
  }

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'video/mp4')
  headers.set('Accept-Ranges', 'bytes')
  // Edge cache for 20 min (clips are deleted after match anyway), browser cache 5 min
  headers.set('Cache-Control', 'public, s-maxage=1200, max-age=300')
  headers.set('CDN-Cache-Control', 'public, max-age=1200')
  headers.set('Access-Control-Allow-Origin', '*')

  if (object.size !== undefined) {
    headers.set('Content-Length', String(object.size))
  }

  // Handle Range requests for seeking
  const range = request.headers.get('Range')
  if (range && object.size) {
    const match = range.match(/bytes=(\d+)-(\d*)/)
    if (match) {
      const start = parseInt(match[1], 10)
      const end = match[2] ? parseInt(match[2], 10) : object.size - 1
      const chunkSize = end - start + 1

      // Re-fetch with range from R2
      const rangeObject = await env.VIDEOS.get(key, {
        range: { offset: start, length: chunkSize }
      })
      if (!rangeObject) {
        return new Response('Range not satisfiable', { status: 416 })
      }

      headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`)
      headers.set('Content-Length', String(chunkSize))

      return new Response(rangeObject.body as ReadableStream, {
        status: 206,
        headers
      })
    }
  }

  return new Response(object.body as ReadableStream, { status: 200, headers })
}
