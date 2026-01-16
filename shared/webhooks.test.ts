import { describe, expect, it } from 'vitest'
import { verifyHmacSha256 } from './webhooks'

describe('verifyHmacSha256', () => {
  it('verifies signature', async () => {
    const secret = 'test-secret'
    const payload = '{"ok":true}'
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const sig = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(await verifyHmacSha256(payload, sig, secret)).toBe(true)
    expect(await verifyHmacSha256(payload, 'deadbeef', secret)).toBe(false)
  })
})
