import { describe, expect, it } from 'vitest'
import { isTikTokUrl } from './platforms'

describe('isTikTokUrl', () => {
  it('accepts a valid TikTok URL', () => {
    const url = 'https://www.tiktok.com/@nayoon/video/7570375936286264583'
    expect(isTikTokUrl(url)).toBe(true)
  })
})
