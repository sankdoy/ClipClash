import type { Env } from '../../_helpers'

type UpdatePayload = {
  tier_key: string
  min_avg_viewers: number
  last_updated_iso: string
}

export async function onRequestPost({ env, request }: { env: Env & { ADMIN_TOKEN?: string }; request: Request }) {
  const auth = request.headers.get('Authorization')
  if (!auth || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const updates = (await request.json()) as UpdatePayload[]
  for (const update of updates) {
    await env.DB.prepare(
      'UPDATE sponsor_tiers SET min_avg_viewers = ?, last_updated_iso = ? WHERE tier_key = ?'
    )
      .bind(update.min_avg_viewers, update.last_updated_iso, update.tier_key)
      .run()
  }

  return new Response('Updated', { status: 200 })
}
