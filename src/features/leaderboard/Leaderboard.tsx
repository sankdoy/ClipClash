import React, { useEffect, useState } from 'react'

type Row = {
  username: string
  avatar_url?: string
  games_played: number
  wins: number
  category_wins: number
}

export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([])
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    setStatus('loading')
    fetch(`/api/leaderboard?page=${page}&limit=20`)
      .then((res) => res.json())
      .then((data) => {
        setRows(data.rows ?? [])
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
  }, [page])

  return (
    <div className="page">
      <h2>Leaderboard</h2>
      {status === 'loading' && <p className="muted">Loading...</p>}
      {status === 'error' && <p className="muted">Unable to load leaderboard.</p>}
      {status === 'ok' && (
        <div className="card">
          <div className="scoreboard">
            {rows.map((row, index) => (
              <div key={`${row.username}-${index}`} className={`score-row ${index === 0 ? 'leader' : ''}`}>
                <span>{row.username}</span>
                <span>{row.wins} wins</span>
              </div>
            ))}
          </div>
          <div className="room-controls">
            <button className="btn outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              Prev
            </button>
            <button className="btn outline" onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
