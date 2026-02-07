import { useEffect, useState } from 'react'
import { getCreatorProfileUrl } from '../../../shared/platforms'

interface PlatformStat {
  platform: string
  count: number
}

interface CreatorStat {
  platform: string
  creator_handle: string
  count: number
}

interface StatsData {
  totalSubmissions: number
  platforms: PlatformStat[]
  topCreators: CreatorStat[]
}

export default function GlobalStats() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/global-stats')
      .then((res) => res.json())
      .then((json: StatsData & { ok: boolean }) => {
        if (json.ok) setData(json)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const maxPlatformCount = data?.platforms?.[0]?.count ?? 1

  return (
    <div className="page global-stats">
      <h1>Global Stats</h1>
      <p className="muted">Clip submissions across all ClipDuel games.</p>

      {loading ? (
        <p className="muted">Loading stats...</p>
      ) : !data || data.totalSubmissions === 0 ? (
        <div className="panel-card">
          <p className="muted">No submissions yet. Play a game to see stats here!</p>
        </div>
      ) : (
        <>
          <div className="panel-card">
            <h3>Total submissions: {data.totalSubmissions.toLocaleString()}</h3>
          </div>

          <div className="panel-card">
            <h3>Platform popularity</h3>
            <p className="muted">Most used platforms for sharing clips.</p>
            <div className="platform-stats">
              {data.platforms.map((p) => (
                <div key={p.platform} className="platform-stat-row">
                  <span className="platform-stat-name">{p.platform}</span>
                  <div className="stat-bar-track">
                    <div
                      className="stat-bar-fill"
                      style={{ width: `${Math.max(4, (p.count / maxPlatformCount) * 100)}%` }}
                    />
                  </div>
                  <span className="platform-stat-count">{p.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-card">
            <h3>Top 20 most shared creators</h3>
            <p className="muted">Creators whose clips get shared the most.</p>
            <div className="creator-table">
              {data.topCreators.map((c, idx) => {
                const profileUrl = getCreatorProfileUrl(c.platform, c.creator_handle)
                return (
                  <div key={`${c.platform}-${c.creator_handle}`} className="creator-row">
                    <span className="creator-rank">{idx + 1}</span>
                    <span className="platform-badge">{c.platform}</span>
                    <span className="creator-handle">
                      {profileUrl ? (
                        <a href={profileUrl} target="_blank" rel="noopener">
                          {c.creator_handle}
                        </a>
                      ) : (
                        c.creator_handle
                      )}
                    </span>
                    <span className="creator-count">{c.count} clip{c.count !== 1 ? 's' : ''}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
