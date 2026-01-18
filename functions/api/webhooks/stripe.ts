import { jsonOk } from '../../_lib/responses'
import { verifyStripeSignature } from '../_stripe'

type Env = {
  PAYMENTS_ENABLED?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_WEBHOOK_BYPASS?: string
  DB: D1Database
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

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } }
  try {
    event = JSON.parse(payload) as { id?: string; type?: string }
  } catch {
    return jsonOk({ error: 'Invalid payload' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object ?? {}
    const metadata = (session.metadata ?? {}) as Record<string, string>
    const kind = typeof metadata.kind === 'string' ? metadata.kind : 'unknown'
    const userIdRaw = typeof metadata.user_id === 'string' ? metadata.user_id.trim() : ''
    const userId = userIdRaw.length > 0 ? userIdRaw : null
    const donationMessage = typeof metadata.donation_message === 'string' ? metadata.donation_message.trim() : ''
    const amountCents = Number(session.amount_total ?? session.amount_subtotal ?? 0)
    const currency = typeof session.currency === 'string' ? session.currency : 'usd'
    const checkoutSessionId = typeof session.id === 'string' ? session.id : null
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null
    const now = new Date().toISOString()

    if (!checkoutSessionId || !Number.isFinite(amountCents)) {
      return jsonOk({ error: 'Missing session details' }, { status: 400 })
    }

    if (userId) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO payments
          (id, user_id, kind, amount_cents, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          userId,
          kind,
          amountCents,
          currency,
          checkoutSessionId,
          paymentIntentId,
          stripeCustomerId,
          now
        )
        .run()
    }

    if (kind === 'donation') {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO donations
          (id, user_id, amount_cents, message, is_public, created_at, currency, message_moderation_status, stripe_payment_intent_id, stripe_checkout_session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          userId,
          amountCents,
          donationMessage || null,
          1,
          now,
          currency,
          'ok',
          paymentIntentId,
          checkoutSessionId
        )
        .run()
    }

    if (kind === 'audience_mode' && userId) {
      await env.DB.prepare(
        `INSERT INTO entitlements
          (user_id, has_audience_mode, updated_at, stripe_customer_id, audience_mode_purchased_at, audience_mode_session_id, audience_mode_payment_intent_id)
         VALUES (?, 1, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           has_audience_mode=1,
           updated_at=excluded.updated_at,
           stripe_customer_id=COALESCE(excluded.stripe_customer_id, entitlements.stripe_customer_id),
           audience_mode_purchased_at=excluded.audience_mode_purchased_at,
           audience_mode_session_id=excluded.audience_mode_session_id,
           audience_mode_payment_intent_id=excluded.audience_mode_payment_intent_id`
      )
        .bind(
          userId,
          now,
          stripeCustomerId,
          now,
          checkoutSessionId,
          paymentIntentId
        )
        .run()
    }

    return jsonOk({ received: true, eventId: event.id })
  }

  return jsonOk({ received: true, ignored: event.type ?? 'unknown' })
}
