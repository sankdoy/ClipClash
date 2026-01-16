import { describe, expect, it } from 'vitest'
import { canUseAudienceMode } from './entitlements'

describe('entitlements', () => {
  it('enforces audience mode entitlement', () => {
    expect(canUseAudienceMode(true)).toBe(true)
    expect(canUseAudienceMode(false)).toBe(false)
  })
})
