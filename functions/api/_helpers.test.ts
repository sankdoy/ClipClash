import { describe, expect, it } from 'vitest'
import { getCookie, setCookie } from './_helpers'

describe('auth session cookie', () => {
  it('roundtrips session token in cookie header', () => {
    const header = setCookie('cc_session', 'token-123')
    const headers = new Headers({ Cookie: header.split(';')[0] })
    expect(getCookie(headers, 'cc_session')).toBe('token-123')
  })
})
