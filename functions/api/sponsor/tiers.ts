import type { Env } from '../_helpers'
import { getDB } from '../../_lib/db'
import { jsonOk } from '../../_lib/responses'

const BASELINE_CPM_USD = 7.0
const DISCOUNT_RATE = 0.2
const STANDARD_BUNDLES = [100, 250, 500, 1000, 2500, 5000]
const STREAMER_CREDIT_BUNDLES = [250000, 500000, 1000000, 2500000, 5000000]

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const db = getDB(env)
  const topRow = await db.prepare('SELECT MAX(sampled_at) AS sampled_at FROM twitch_top250_cache').first()
  const top250UpdatedAt = topRow?.sampled_at ?? null

  const pricePerViewer = (BASELINE_CPM_USD * (1 - DISCOUNT_RATE)) / 1000
  const pricePerGame = pricePerViewer * 3

  const standardBundles = STANDARD_BUNDLES.map((games) => ({
    games,
    price_usd: Number((games * pricePerGame).toFixed(2))
  }))
  const streamerCreditBundles = STREAMER_CREDIT_BUNDLES.map((credits) => ({
    credits,
    price_usd: Number((credits * pricePerViewer).toFixed(2))
  }))

  return jsonOk({
    pricePerViewer: Number(pricePerViewer.toFixed(6)),
    pricePerGame: Number(pricePerGame.toFixed(4)),
    standardBundles,
    streamerCreditBundles,
    top250UpdatedAt
  })
}
