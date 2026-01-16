import { json, Env } from '../_helpers'
import { isBlocked } from '../../../shared/moderation'
import { StripeEnv, verifyStripeSignature } from '../_stripe'

type BillingEnv = Env & StripeEnv

export async function onRequestPost({ request, env }: { request: Request; env: BillingEnv }) {
  const payload = await request.text()
  const signature = request.headers.get('Stripe-Signature')
  const verified = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)
  if (!verified) {
    return json({ ok: false, error: 'Invalid signature.' }, { status: 400 })
  }
  const event = JSON.parse(payload) as { type: string; data?: { object?: any } }
  if (event.type !== 'checkout.session.completed') {
    return json({ ok: true })
  }
  const session = event.data?.object ?? {}
  const metadata = session.metadata ?? {}
  const kind = metadata.kind
  const now = new Date().toISOString()

  if (kind === 'audience_mode') {
    const userId = typeof metadata.user_id === 'string' ? metadata.user_id : ''
    if (!userId) {
      return json({ ok: true })
    }
    const amountCents = Number(session.amount_total ?? 0)
    const currency = typeof session.currency === 'string' ? session.currency : 'usd'
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null
    const stripeCheckoutSessionId = typeof session.id === 'string' ? session.id : null
    const stripePaymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : null

    await env.DB.prepare(
      `INSERT INTO entitlements (user_id, has_audience_mode, updated_at, stripe_customer_id, audience_mode_purchased_at, audience_mode_session_id, audience_mode_payment_intent_id)
       VALUES (?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         has_audience_mode = 1,
         updated_at = excluded.updated_at,
         stripe_customer_id = COALESCE(excluded.stripe_customer_id, entitlements.stripe_customer_id),
         audience_mode_purchased_at = excluded.audience_mode_purchased_at,
         audience_mode_session_id = excluded.audience_mode_session_id,
         audience_mode_payment_intent_id = excluded.audience_mode_payment_intent_id`
    )
      .bind(
        userId,
        now,
        stripeCustomerId,
        now,
        stripeCheckoutSessionId,
        stripePaymentIntentId
      )
      .run()

    await env.DB.prepare(
      `INSERT OR IGNORE INTO payments
        (id, user_id, kind, amount_cents, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        userId,
        'audience_mode',
        amountCents,
        currency,
        stripeCheckoutSessionId,
        stripePaymentIntentId,
        stripeCustomerId,
        now
      )
      .run()
  }

  if (kind === 'donation') {
    const userId = typeof metadata.user_id === 'string' && metadata.user_id.trim().length > 0
      ? metadata.user_id
      : null
    const rawMessage =
      typeof metadata.donation_message === 'string' ? metadata.donation_message.trim().slice(0, 200) : ''
    const blocked = rawMessage.length > 0 && isBlocked(rawMessage)
    const message = blocked ? null : rawMessage || null
    const status = blocked ? 'rejected' : 'ok'
    const isPublic = blocked ? 0 : 1
    const amountCents = Number(session.amount_total ?? 0)
    const currency = typeof session.currency === 'string' ? session.currency : 'usd'
    const stripeCheckoutSessionId = typeof session.id === 'string' ? session.id : null
    const stripePaymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : null

    await env.DB.prepare(
      `INSERT OR IGNORE INTO donations
        (id, user_id, amount_cents, currency, message, message_moderation_status, is_public, created_at, stripe_payment_intent_id, stripe_checkout_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        userId,
        amountCents,
        currency,
        message,
        status,
        isPublic,
        now,
        stripePaymentIntentId,
        stripeCheckoutSessionId
      )
      .run()
  }

  return json({ ok: true })
}
