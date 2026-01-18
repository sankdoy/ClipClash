import { describe, expect, it } from 'vitest'
import { resolveSessionToken, replaceSocketForToken } from '../src/index'

describe('session token handling', () => {
  it('reconnect with token restores same playerId', () => {
    const tokenToPlayerId = new Map<string, { playerId: string; accountId?: string | null }>()
    const first = resolveSessionToken(
      tokenToPlayerId,
      undefined,
      null,
      () => 'player-a',
      () => 'token-a'
    )
    const second = resolveSessionToken(
      tokenToPlayerId,
      'token-a',
      null,
      () => 'player-b',
      () => 'token-b'
    )
    expect(first.playerId).toBe('player-a')
    expect(second.playerId).toBe('player-a')
    expect(second.sessionToken).toBe('token-a')
  })

  it('cannot claim another playerId without token', () => {
    const tokenToPlayerId = new Map<string, { playerId: string; accountId?: string | null }>([
      ['token-a', { playerId: 'player-a' }]
    ])
    const resolved = resolveSessionToken(
      tokenToPlayerId,
      'token-b',
      null,
      () => 'player-b',
      () => 'token-b'
    )
    expect(resolved.playerId).toBe('player-b')
    expect(resolved.sessionToken).toBe('token-b')
  })
})

describe('duplicate token handling', () => {
  it('forces single active connection per token', () => {
    const tokenToSocket = new Map<string, WebSocket>()
    const ws1 = {} as WebSocket
    const ws2 = {} as WebSocket
    const replaced = replaceSocketForToken(tokenToSocket, 'token-a', ws1)
    expect(replaced).toBeNull()
    const replaced2 = replaceSocketForToken(tokenToSocket, 'token-a', ws2)
    expect(replaced2).toBe(ws1)
    expect(tokenToSocket.get('token-a')).toBe(ws2)
  })
})
