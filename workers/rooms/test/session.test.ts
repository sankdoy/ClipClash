import { describe, expect, it } from 'vitest'
import { resolveSessionToken, replaceSocketForToken, selectHost } from '../src/index'

describe('session token handling', () => {
  it('reconnect with token restores same playerId', () => {
    const tokenToPlayerId = new Map<string, string>()
    const first = resolveSessionToken(
      tokenToPlayerId,
      undefined,
      () => 'player-a',
      () => 'token-a'
    )
    const second = resolveSessionToken(
      tokenToPlayerId,
      'token-a',
      () => 'player-b',
      () => 'token-b'
    )
    expect(first.playerId).toBe('player-a')
    expect(second.playerId).toBe('player-a')
    expect(second.sessionToken).toBe('token-a')
  })

  it('cannot claim another playerId without token', () => {
    const tokenToPlayerId = new Map<string, string>([['token-a', 'player-a']])
    const resolved = resolveSessionToken(
      tokenToPlayerId,
      'token-b',
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

describe('host selection', () => {
  it('does not allow host takeover when host exists', () => {
    expect(selectHost('host-a', 'player-b')).toBe('host-a')
  })
})
