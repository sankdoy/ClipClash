import React, { useEffect, useState } from 'react'
import { getMe } from '../../utils/auth'

type OverviewResponse = {
  ok: boolean
  error?: string
  since?: { iso: string }
  usage?: {
    rooms_today: number
    players_today: number
    accounts_today: number
  }
  revenue?: {
    payments_today: { count: number; total_cents: number; currency: string }
    donations_today: { count: number; total_cents: number; currency: string }
  }
  warnings?: Array<{ id: string; level: string; event_type: string; message: string | null; room_id: string | null; created_at: number }>
  reports?: Array<{ id: string; room_id: string; message_id: string; reporter_id: string; reported_at: string }>
  publicRooms?: Array<{ id: string; name: string; players: number; capacity: number; last_seen_at: number; created_at: number }>
}

export default function Owner() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [status, setStatus] = useState<'loading' | 'forbidden' | 'ok' | 'error'>('loading')
  const [data, setData] = useState<OverviewResponse | null>(null)

  useEffect(() => {
    getMe().then((me) => setLoggedIn(Boolean(me?.user)))
  }, [])

  useEffect(() => {
    setStatus('loading')
    fetch('/api/owner/overview')
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as OverviewResponse | null
        if (res.status === 403) {
          setStatus('forbidden')
          setData(payload)
          return
        }
        if (!res.ok || !payload?.ok) {
          setStatus('error')
          setData(payload)
          return
        }
        setData(payload)
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="page">
      <h2>Owner</h2>
      {!loggedIn && <p className="muted">Sign in to access owner tools.</p>}

      {status === 'loading' && <p className="muted">Loading...</p>}
      {status === 'forbidden' && (
        <div className="card">
          <h3>Forbidden</h3>
          <p className="muted">This account is not marked as owner.</p>
          <p className="muted">If you just migrated, set <code>users.is_owner = 1</code> for your user in D1.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="card">
          <h3>Error</h3>
          <p className="muted">Unable to load owner overview.</p>
          {data?.error && <p className="muted">{data.error}</p>}
        </div>
      )}

      {status === 'ok' && data?.ok && (
        <>
          <div className="card">
            <h3>Today</h3>
            <p className="muted">Since: {data.since?.iso}</p>
            <div className="scoreboard">
              <div className="score-row"><span>Rooms</span><span>{data.usage?.rooms_today ?? 0}</span></div>
              <div className="score-row"><span>Players</span><span>{data.usage?.players_today ?? 0}</span></div>
              <div className="score-row"><span>Accounts</span><span>{data.usage?.accounts_today ?? 0}</span></div>
            </div>
          </div>

          <div className="card">
            <h3>Revenue (today)</h3>
            <div className="scoreboard">
              <div className="score-row"><span>Payments</span><span>{formatMoney(data.revenue?.payments_today.total_cents ?? 0, data.revenue?.payments_today.currency ?? 'usd')} ({data.revenue?.payments_today.count ?? 0})</span></div>
              <div className="score-row"><span>Donations</span><span>{formatMoney(data.revenue?.donations_today.total_cents ?? 0, data.revenue?.donations_today.currency ?? 'usd')} ({data.revenue?.donations_today.count ?? 0})</span></div>
            </div>
          </div>

          <div className="card">
            <h3>Warnings / errors</h3>
            {(data.warnings ?? []).length === 0 ? (
              <p className="muted">None.</p>
            ) : (
              <div className="scoreboard">
                {(data.warnings ?? []).slice(0, 20).map((row) => (
                  <div key={row.id} className="score-row">
                    <span>{row.level}:{row.event_type}{row.room_id ? ` (${row.room_id})` : ''}</span>
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Reports</h3>
            {(data.reports ?? []).length === 0 ? (
              <p className="muted">No reports.</p>
            ) : (
              <div className="scoreboard">
                {(data.reports ?? []).slice(0, 20).map((row) => (
                  <div key={row.id} className="score-row">
                    <span>{row.room_id} • {row.message_id}</span>
                    <span>{new Date(row.reported_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Public rooms (now)</h3>
            {(data.publicRooms ?? []).length === 0 ? (
              <p className="muted">None.</p>
            ) : (
              <div className="scoreboard">
                {(data.publicRooms ?? []).slice(0, 20).map((room) => (
                  <div key={room.id} className="score-row">
                    <span>{room.name}</span>
                    <span>{room.players}/{room.capacity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function formatMoney(cents: number, currency: string) {
  const value = (typeof cents === 'number' ? cents : 0) / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}
