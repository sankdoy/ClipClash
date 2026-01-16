import { getSessionUser, json, Env } from './_helpers'
import { createCheckoutSession, StripeEnv } from './_stripe'

type BillingEnv = Env & StripeEnv

const MIN_DONATION_CENTS = 100
const MAX_DONATION_CENTS = 50000

export async function onRequestGet({ env }: { env: Env }) {
  const donations = await env.DB.prepare(
    `SELECT donations.id, donations.amount_cents, donations.currency, donations.message, donations.message_moderation_status,
      donations.created_at, users.username, users.avatar_url
     FROM donations
     LEFT JOIN users ON users.id = donations.user_id
     WHERE donations.is_public = 1
     ORDER BY donations.created_at DESC
     LIMIT 50`
  ).all()

  const top = await env.DB.prepare(
    `SELECT users.username, users.avatar_url, SUM(donations.amount_cents) AS total_cents
     FROM donations
     JOIN users ON users.id = donations.user_id
     GROUP BY donations.user_id
     ORDER BY total_cents DESC
     LIMIT 10`
  ).all()

  return json({
    ok: true,
    donations: donations.results ?? [],
    topDonors: top.results ?? []
  })
}

export async function onRequestPost({ request, env }: { request: Request; env: BillingEnv }) {
  const body = await request.json().catch(() => null)
  const amount = Number(body?.amount)
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 200) : ''
  if (!Number.isFinite(amount)) {
    return json({ ok: false, error: 'Invalid amount.' }, { status: 400 })
  }
  const amountCents = Math.round(amount * 100)
  if (amountCents < MIN_DONATION_CENTS || amountCents > MAX_DONATION_CENTS) {
    return json({ ok: false, error: 'Amount out of range.' }, { status: 400 })
  }
  const user = await getSessionUser(env, request)
  const origin = new URL(request.url).origin
  const successUrl = `${origin}/donate?status=success`
  const cancelUrl = `${origin}/donate?status=cancel`

  try {
    const session = await createCheckoutSession(env, {
      successUrl,
      cancelUrl,
      customerEmail: user?.email,
      metadata: {
        kind: 'donation',
        user_id: user?.id ?? '',
        donation_message: message
      },
      paymentIntentMetadata: {
        kind: 'donation',
        user_id: user?.id ?? '',
        donation_message: message
      },
      lineItems: [
        {
          name: 'Donation',
          amountCents,
          currency: 'usd',
          quantity: 1
        }
      ]
    })
    if (!session.url) {
      return json({ ok: false, error: 'Stripe session missing url.' }, { status: 500 })
    }
    return json({ ok: true, url: session.url })
  } catch (error) {
    const messageError = error instanceof Error ? error.message : 'Stripe error'
    return json({ ok: false, error: messageError }, { status: 500 })
  }
}
