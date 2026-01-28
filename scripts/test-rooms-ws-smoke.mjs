import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const roomsDir = path.join(repoRoot, 'workers/rooms')
const wranglerBin = path.join(repoRoot, 'node_modules/.bin/wrangler')

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Failed to allocate a free port'))
        return
      }
      const port = address.port
      server.close(() => resolve(port))
    })
  })
}

async function waitForHttpReady(url, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url)
      // Rooms DO returns 426 unless the request upgrades to websocket.
      if (res.status === 426 || res.status === 400) return
    } catch {
      // ignore
    }
    await delay(200)
  }
  throw new Error(`Timed out waiting for worker to be ready: ${url}`)
}

function waitForWsOpen(ws, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for websocket to open'))
    }, timeoutMs)

    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Websocket failed to open'))
    }

    const cleanup = () => {
      clearTimeout(timeout)
      ws.removeEventListener('open', onOpen)
      ws.removeEventListener('error', onError)
    }

    ws.addEventListener('open', onOpen)
    ws.addEventListener('error', onError)
  })
}

function waitForWsClose(ws, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup()
      resolve(false)
    }, timeoutMs)

    const onClose = () => {
      cleanup()
      resolve(true)
    }

    const cleanup = () => {
      clearTimeout(timeout)
      ws.removeEventListener('close', onClose)
    }

    ws.addEventListener('close', onClose)
  })
}

function waitForMessage(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for websocket message'))
    }, timeoutMs)

    const onMessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8')
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        return
      }
      if (predicate(parsed)) {
        cleanup()
        resolve(parsed)
      }
    }

    const onClose = () => {
      cleanup()
      reject(new Error('Websocket closed before receiving expected message'))
    }

    const onError = () => {
      cleanup()
      reject(new Error('Websocket error before receiving expected message'))
    }

    const cleanup = () => {
      clearTimeout(timeout)
      ws.removeEventListener('message', onMessage)
      ws.removeEventListener('close', onClose)
      ws.removeEventListener('error', onError)
    }

    ws.addEventListener('message', onMessage)
    ws.addEventListener('close', onClose)
    ws.addEventListener('error', onError)
  })
}

async function run() {
  const port = await getFreePort()
  const roomId = `room-smoke${Math.random().toString(36).slice(2, 6)}`
  const httpUrl = `http://127.0.0.1:${port}/room/${roomId}`
  const wsUrl = `ws://127.0.0.1:${port}/room/${roomId}`

  console.log(`Rooms WS smoke test (local): ${wsUrl}`)

  const wrangler = spawn(
    wranglerBin,
    ['dev', '--local', '--ip', '127.0.0.1', '--port', String(port)],
    {
      cwd: roomsDir,
      stdio: 'inherit'
    }
  )

  const shutdown = async () => {
    if (wrangler.exitCode !== null) return
    wrangler.kill('SIGTERM')
    const exited = await Promise.race([
      new Promise((resolve) => wrangler.once('exit', () => resolve(true))),
      delay(5000).then(() => false)
    ])
    if (!exited && wrangler.exitCode === null) {
      wrangler.kill('SIGKILL')
      await Promise.race([new Promise((resolve) => wrangler.once('exit', resolve)), delay(5000)])
    }
  }

  try {
    await waitForHttpReady(httpUrl)

    const ws1 = new WebSocket(wsUrl)
    await waitForWsOpen(ws1)
    ws1.send(JSON.stringify({ type: 'hello' }))
    const welcome1 = await waitForMessage(ws1, (m) => m?.type === 'welcome')
    console.log(`welcome ok (playerId=${welcome1.playerId})`)

    const msgText = `smoke-${Date.now()}`
    ws1.send(JSON.stringify({ type: 'chat', message: msgText }))
    await waitForMessage(
      ws1,
      (m) => m?.type === 'chat' && m?.chat?.message === msgText,
      7000
    )
    console.log('chat ok')

    const { sessionToken, playerId } = welcome1
    const ws1Closed = waitForWsClose(ws1)
    ws1.close(1000, 'smoke reconnect')
    await ws1Closed

    const ws2 = new WebSocket(wsUrl)
    await waitForWsOpen(ws2)
    ws2.send(JSON.stringify({ type: 'hello', sessionToken }))
    const welcome2 = await waitForMessage(ws2, (m) => m?.type === 'welcome')
    if (welcome2.playerId !== playerId) {
      throw new Error(`reconnect failed: expected playerId=${playerId} got ${welcome2.playerId}`)
    }
    console.log('reconnect ok')

    const ws2Closed = waitForWsClose(ws2)
    ws2.close(1000, 'smoke done')
    await ws2Closed
  } catch (error) {
    console.error('rooms ws smoke error', error?.message ?? error)
    process.exitCode = 1
  } finally {
    await shutdown()
  }
}

run()
