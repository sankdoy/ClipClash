import { describe, expect, it } from 'vitest'
import { generateUniqueCode } from './codes'

describe('generateUniqueCode', () => {
  it('retries on collisions', async () => {
    const seen = new Set<string>(['AAAAAA'])
    const codes = ['AAAAAA', 'BBBBBB']
    let index = 0
    const code = await generateUniqueCode(
      async (candidate) => !seen.has(candidate),
      6,
      5,
      () => codes[index++]
    )
    expect(code).toBe('BBBBBB')
  })
})
