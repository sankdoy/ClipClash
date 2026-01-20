import { getSessionUser, json, logEvent, Env } from './_helpers'
import { createCheckoutSession, StripeEnv } from './_stripe'

type BillingEnv = Env & StripeEnv

const AUDIENCE_PRICE_CENTS = 3000

export async function onRequestPost({ request, env }: { request: Request; env: BillingEnv }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : ''
  const origin = new URL(request.url).origin
  const successUrl = roomId ? `${origin}/room/${roomId}?audience=success` : `${origin}/account?audience=success`
  const cancelUrl = roomId ? `${origin}/room/${roomId}?audience=cancel` : `${origin}/account?audience=cancel`

  try {
    const session = await createCheckoutSession(env, {
      successUrl,
      cancelUrl,
      customerEmail: user.email,
      metadata: {
        kind: 'audience_mode',
        user_id: user.id
      },
      lineItems: [
        {
          name: 'Audience Mode (one-time)',
          amountCents: AUDIENCE_PRICE_CENTS,
          currency: 'usd',
          quantity: 1
        }
      ]
    })
    if (!session.url) {
      await logEvent(env, {
        level: 'error',
        eventType: 'audience_checkout_error',
        message: 'Stripe session missing url.',
        accountId: user.id
      })
      return json({ ok: false, error: 'Stripe session missing url.' }, { status: 500 })
    }
    await logEvent(env, {
      level: 'info',
      eventType: 'audience_checkout_start',
      accountId: user.id
    })
    return json({ ok: true, url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe error'
    await logEvent(env, {
      level: 'error',
      eventType: 'audience_checkout_error',
      message,
      accountId: user.id
    })
    return json({ ok: false, error: message }, { status: 500 })
  }
}
