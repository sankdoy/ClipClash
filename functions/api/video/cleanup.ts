import { json, type Env } from '../_helpers'

/**
 * POST /api/video/cleanup
 * Body: { keys: string[] }
 * Deletes video files from R2. Called by the DO when a game ends.
 */
export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = await request.json().catch(() => null)
  const keys = Array.isArray(body?.keys) ? body.keys.filter((k: unknown) => typeof k === 'string') : []

  if (keys.length === 0) {
    return json({ ok: true, deleted: 0 })
  }

  let deleted = 0
  for (const key of keys) {
    try {
      await env.VIDEOS.delete(key)
      deleted++
    } catch {
      // ignore individual failures
    }
  }

  return json({ ok: true, deleted })
}
