import type { Env } from '../_helpers'

type TierRow = {
  tier_key: string
  tier_label: string
  max_rank: number
  min_avg_viewers: number
  baseline_cpm_usd: number
  discount_rate: number
  last_updated_iso: string
}

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const results = await env.DB.prepare('SELECT * FROM sponsor_tiers ORDER BY max_rank ASC').all()
  const tiers = (results.results ?? []) as TierRow[]
  const tierData = tiers.map((tier) => {
    const effectiveCpm = tier.baseline_cpm_usd * (1 - tier.discount_rate)
    const price = (tier.min_avg_viewers / 1000) * effectiveCpm
    return {
      ...tier,
      effective_cpm_usd: Number(effectiveCpm.toFixed(2)),
      price_per_game_usd: Number(price.toFixed(2)),
      display_price: Math.round(price)
    }
  })

  return new Response(JSON.stringify({ tiers: tierData }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}
