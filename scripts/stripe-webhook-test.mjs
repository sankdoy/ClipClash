const url = process.env.WEBHOOK_URL ?? 'http://localhost:8788/api/webhooks/stripe'

const payload = {
  id: `evt_test_${Math.random().toString(36).slice(2, 10)}`,
  type: 'checkout.session.completed',
  data: {
    object: {
      id: `cs_test_${Math.random().toString(36).slice(2, 10)}`,
      amount_total: 500,
      currency: 'usd',
      payment_intent: `pi_test_${Math.random().toString(36).slice(2, 10)}`,
      customer: `cus_test_${Math.random().toString(36).slice(2, 10)}`,
      metadata: {
        type: 'donation'
      }
    }
  }
}

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify(payload)
})

const text = await response.text()
console.log(`POST ${url} -> ${response.status}`)
console.log(text)
