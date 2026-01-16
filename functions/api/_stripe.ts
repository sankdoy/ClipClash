export type StripeEnv = {
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
}

type CheckoutLineItem = {
  name: string
  amountCents: number
  currency: string
  quantity: number
}

export async function createCheckoutSession(
  env: StripeEnv,
  params: {
    successUrl: string
    cancelUrl: string
    customerEmail?: string
    metadata?: Record<string, string>
    paymentIntentMetadata?: Record<string, string>
    lineItems: CheckoutLineItem[]
  }
) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key missing')
  }
  const body = new URLSearchParams()
  body.set('mode', 'payment')
  body.set('success_url', params.successUrl)
  body.set('cancel_url', params.cancelUrl)
  if (params.customerEmail) {
    body.set('customer_email', params.customerEmail)
  }
  params.lineItems.forEach((item, index) => {
    body.set(`line_items[${index}][price_data][currency]`, item.currency)
    body.set(`line_items[${index}][price_data][product_data][name]`, item.name)
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.amountCents))
    body.set(`line_items[${index}][quantity]`, String(item.quantity))
  })
  Object.entries(params.metadata ?? {}).forEach(([key, value]) => {
    body.set(`metadata[${key}]`, value)
  })
  Object.entries(params.paymentIntentMetadata ?? {}).forEach(([key, value]) => {
    body.set(`payment_intent_data[metadata][${key}]`, value)
  })
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  })
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message : 'Stripe error'
    throw new Error(message)
  }
  return data as { id: string; url?: string }
}

export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string | undefined,
  toleranceSeconds = 300
) {
  if (!secret || !signatureHeader) return false
  const parts = signatureHeader.split(',').map((part) => part.trim())
  const timestampPart = parts.find((part) => part.startsWith('t='))
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
  if (!timestampPart || signatures.length === 0) return false
  const timestamp = Number(timestampPart.slice(2))
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`))
  const expected = bufferToHex(new Uint8Array(signed))
  return signatures.some((sig) => timingSafeEqual(sig, expected))
}

function bufferToHex(buffer: Uint8Array) {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
