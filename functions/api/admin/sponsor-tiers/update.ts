import type { Env } from '../../_helpers'
import { getDB } from '../../../_lib/db'
import { jsonOk, unauthorized } from '../../../_lib/responses'
import { requireBearerToken } from '../../../_lib/auth'

type UpdatePayload = {
  tier_key: string
  min_avg_viewers: number
  last_updated_iso: string
}

export async function onRequest({ env, request }: { env: Env & { ADMIN_TOKEN?: string }; request: Request }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  if (!requireBearerToken(request, env.ADMIN_TOKEN)) {
    return unauthorized()
  }

  const updates = (await request.json()) as UpdatePayload[]
  const db = getDB(env)
  for (const update of updates) {
    await db.prepare(
      'UPDATE sponsor_tiers SET min_avg_viewers = ?, last_updated_iso = ? WHERE tier_key = ?'
    )
      .bind(update.min_avg_viewers, update.last_updated_iso, update.tier_key)
      .run()
  }

  return jsonOk({ ok: true })
}
