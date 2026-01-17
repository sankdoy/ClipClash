#!/usr/bin/env node
const args = process.argv.slice(2)

function getArgValue(flag, fallback) {
  const index = args.indexOf(flag)
  if (index === -1) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('--')) return fallback
  return value
}

function parsePlayersArg(raw, roomCount) {
  if (!raw) return Array.from({ length: roomCount }, () => 4)
  if (raw.includes(',')) {
    const parts = raw.split(',').map((part) => Number(part.trim()))
    if (parts.some((value) => Number.isNaN(value) || value <= 0)) {
      throw new Error('Invalid --players list. Use comma-separated positive integers.')
    }
    if (parts.length !== roomCount) {
      throw new Error('Player list length must match --rooms.')
    }
    return parts
  }
  const value = Number(raw)
  if (Number.isNaN(value) || value <= 0) {
    throw new Error('Invalid --players value. Use a positive integer.')
  }
  return Array.from({ length: roomCount }, () => value)
}

function makeRoomId() {
  return `room-${Math.random().toString(36).slice(2, 8)}`
}

const rooms = Number(getArgValue('--rooms', '1'))
if (!Number.isInteger(rooms) || rooms <= 0) {
  console.error('Invalid --rooms value. Use a positive integer.')
  process.exit(1)
}

const appUrl = getArgValue('--app-url', 'http://localhost:5173').replace(/\/$/, '')
const playersArg = getArgValue('--players', '')

let playersPerRoom = []
try {
  playersPerRoom = parsePlayersArg(playersArg, rooms)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const output = []
output.push('ClipClash local multiplayer test setup')
output.push(`App URL: ${appUrl}`)
output.push('')

for (let i = 0; i < rooms; i += 1) {
  const roomId = makeRoomId()
  const playerCount = playersPerRoom[i]
  output.push(`Room ${i + 1}`)
  output.push(`- Room code: ${roomId}`)
  output.push(`- Room link: ${appUrl}/room/${roomId}`)
  output.push(`- Players: ${playerCount}`)
  for (let j = 0; j < playerCount; j += 1) {
    const playerUrl = `${appUrl}/room/${roomId}?player=${j + 1}`
    output.push(`  - Player ${j + 1}: ${playerUrl}`)
  }
  output.push('')
}

console.log(output.join('\n'))
