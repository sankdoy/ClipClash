import React, { useEffect, useState } from 'react'
import { getHealth } from '../utils/api'

export default function Home() {
  const [status, setStatus] = useState<string>('loading')

  useEffect(() => {
    let mounted = true
    getHealth().then((d) => {
      if (!mounted) return
      setStatus(d?.ok ? 'API ok' : 'API unavailable')
    }).catch(() => setStatus('API unavailable'))
    return () => { mounted = false }
  }, [])

  return (
    <div className="page">
      <h2>Welcome</h2>
      <p>Quick starter front-end for TikTok Olympics.</p>
      <div className="card">
        <h3>Rooms</h3>
        <div className="placeholder">
          <button disabled>Create room (placeholder)</button>
          <button disabled>Join room (placeholder)</button>
        </div>
      </div>

      <div className="card">
        <h3>API</h3>
        <p>{status}</p>
      </div>
    </div>
  )
}
