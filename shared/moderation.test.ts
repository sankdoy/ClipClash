import { describe, expect, it } from 'vitest'
import { isBlocked, normalizeText } from './moderation'

describe('moderation', () => {
  it('normalizes spaced profanity', () => {
    expect(normalizeText('h a t e')).toContain('hate')
  })

  it('blocks normalized input', () => {
    expect(isBlocked('h a t e')).toBe(true)
  })
})
