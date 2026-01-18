import { jsonOk } from '../../_lib/responses'
import { verifyStripeSignature } from '../_stripe'

type Env = {
  PAYMENTS_ENABLED?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_WEBHOOK_BYPASS?: string
}

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'POST') {
    return jsonOk({ error: 'Method Not Allowed' }, { status: 405 })
  }
  const enabled = env.PAYMENTS_ENABLED === 'true'
  if (!enabled) {
    return jsonOk({ status: 'disabled' }, { status: 200 })
  }

  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')
  const bypass = env.STRIPE_WEBHOOK_BYPASS === 'true'
  if (!bypass) {
    const valid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)
    if (!valid) {
      return jsonOk({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  let event: { id?: string; type?: string }
  try {
    event = JSON.parse(payload) as { id?: string; type?: string }
  } catch {
    return jsonOk({ error: 'Invalid payload' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    return jsonOk({ received: true, eventId: event.id })
  }

  return jsonOk({ received: true, ignored: event.type ?? 'unknown' })
}
