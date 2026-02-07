import React, { useEffect, useState } from 'react'

type ChatLine = {
  id: string
  name: string
  playerId: string
  message: string
  sentAt: number
}

type Report = {
  id: string
  roomId: string
  messageId: string
  reporterId: string
  reportedAt: string
  reportedPlayerId: string | null
  reportedPlayerName: string | null
  messageText: string | null
  chatLog: ChatLine[] | null
}

export default function Owner() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports?limit=100', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.reports) {
          setReports(data.reports)
          setTotal(data.total ?? 0)
        } else {
          setError(data?.error ?? 'Failed to load reports.')
        }
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <h2>Owner dashboard</h2>

      <div className="card">
        <h3>Moderation reports ({total})</h3>
        {loading && <p className="muted">Loading reports...</p>}
        {error && <p className="muted">{error}</p>}
        {!loading && !error && reports.length === 0 && (
          <p className="muted">No reports yet.</p>
        )}
        <div className="report-list">
          {reports.map((report) => (
            <div key={report.id} className="report-item">
              <div className="report-header" onClick={() => setExpanded(expanded === report.id ? null : report.id)}>
                <div className="report-meta">
                  <strong>{report.reportedPlayerName ?? 'Unknown'}</strong>
                  <span className="muted"> reported in {report.roomId}</span>
                </div>
                <div className="report-meta">
                  <span className="muted">{new Date(report.reportedAt).toLocaleString()}</span>
                  <span className="report-expand">{expanded === report.id ? '\u25B2' : '\u25BC'}</span>
                </div>
              </div>
              {report.messageText && (
                <div className="report-flagged">
                  <span className="muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flagged message</span>
                  <p>{report.messageText}</p>
                </div>
              )}
              {expanded === report.id && report.chatLog && (
                <div className="report-chat-log">
                  <span className="muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Chat context ({report.chatLog.length} messages)</span>
                  {report.chatLog.map((line) => (
                    <div
                      key={line.id}
                      className={`report-chat-line ${line.id === report.messageId ? 'flagged' : ''}`}
                    >
                      <span className="report-chat-name">{line.name}</span>
                      <span className="report-chat-text">{line.message}</span>
                      <span className="report-chat-time">{new Date(line.sentAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
