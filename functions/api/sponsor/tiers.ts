import type { Env } from '../_helpers'
import { jsonOk } from '../../_lib/responses'

const PRICE_PER_1K_CREDITS_USD = 8.0
const CREDIT_BUNDLES = [500, 1000, 2500, 5000, 10000, 25000]

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const pricePerCredit = PRICE_PER_1K_CREDITS_USD / 1000
  const creditBundles = CREDIT_BUNDLES.map((credits) => ({
    credits,
    price_usd: Number((credits * pricePerCredit).toFixed(2))
  }))

  return jsonOk({
    pricePerCredit: Number(pricePerCredit.toFixed(6)),
    creditBundles
  })
}
