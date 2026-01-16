import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type {
  Category,
  ChatMessage,
  Phase,
  Player,
  RoundEntry,
  RoundHistoryEntry,
  RoundResult,
  RoundState,
  RpsChoice,
  ScoreboardEntry,
  ServerMessage,
  Settings,
  TieBreakState,
  TimerState
} from '../../types'

const fallbackCategories: Category[] = [
  { id: 'cutest', name: 'Cutest' },
  { id: 'funniest', name: 'Funniest' },
  { id: 'out-of-pocket', name: 'Most out of pocket' },
  { id: 'cringe', name: 'Cringiest' },
  { id: 'satisfying', name: 'Most satisfying' },
  { id: 'weirdest', name: 'Weirdest' }
]

function getWsBase() {
  const override = import.meta.env.VITE_ROOMS_WS_URL as string | undefined
  if (override && override.trim().length > 0) {
    return override.replace(/\/$/, '')
  }
  return window.location.origin.replace(/^http/, 'ws')
}

function safeParseMessage(raw: string): ServerMessage | null {
  try {
    return JSON.parse(raw) as ServerMessage
  } catch {
    return null
  }
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.max(0, totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function Room() {
  const { roomId } = useParams()
  const [isConnected, setIsConnected] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [phase, setPhase] = useState<Phase>('lobby')
  const [categories, setCategories] = useState<Category[]>(fallbackCategories)
  const [editingCategories, setEditingCategories] = useState(false)
  const [categoryDrafts, setCategoryDrafts] = useState<Category[]>(fallbackCategories)
  const [round, setRound] = useState<RoundState | null>(null)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [tiebreak, setTiebreak] = useState<TieBreakState | null>(null)
  const [tiebreakChoice, setTiebreakChoice] = useState<RpsChoice | null>(null)
  const [voteSelection, setVoteSelection] = useState<string | null>(null)
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([])
  const [history, setHistory] = useState<RoundHistoryEntry[]>([])
  const [displayName, setDisplayName] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [voteIntent, setVoteIntent] = useState<'higher' | 'lower' | 'neutral'>('neutral')
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, string>>({})
  const [submissionSaved, setSubmissionSaved] = useState<Record<string, string>>({})
  const [submissionErrors, setSubmissionErrors] = useState<Record<string, string>>({})
  const [reportNotice, setReportNotice] = useState<string | null>(null)
  const [reportCount, setReportCount] = useState(0)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!roomId) return
    const ws = new WebSocket(`${getWsBase()}/room/${roomId}`)
    socketRef.current = ws

    ws.addEventListener('open', () => {
      setIsConnected(true)
      const storedToken = window.localStorage.getItem(`tto:sessionToken:${roomId}`)
      const storedName = window.localStorage.getItem(`tto:displayName:${roomId}`) ?? ''
      if (storedName && !displayName) {
        setDisplayName(storedName)
      }
      ws.send(JSON.stringify({ type: 'hello', sessionToken: storedToken ?? undefined }))
      if (storedName) {
        ws.send(JSON.stringify({ type: 'update_name', name: storedName }))
      }
    })
    ws.addEventListener('close', () => setIsConnected(false))
    ws.addEventListener('message', (event) => {
      const data = safeParseMessage(event.data)
      if (!data) return
      if (data.type === 'welcome') {
        setPlayerId(data.playerId)
        setSessionToken(data.sessionToken)
        setPlayers(data.players)
        setChat(data.chat)
        setSettings(data.settings)
        setTimer(data.timer)
        setPhase(data.phase)
        setCategories(data.categories)
        setCategoryDrafts(data.categories)
        setScoreboard(data.scoreboard)
        setHistory(data.history)
        setSubmissionDrafts((prev) => mergeDrafts(prev, data.drafts))
        setReportCount(data.reportCount)
      }
      if (data.type === 'presence') {
        setPlayers(data.players)
      }
      if (data.type === 'chat') {
        setChat((prev) => [...prev, data.chat])
      }
      if (data.type === 'timer') {
        setTimer(data.timer)
        setPhase(data.phase)
      }
      if (data.type === 'round_start') {
        setRound(data.round)
        setRoundResult(null)
        setTiebreak(null)
        setTiebreakChoice(null)
        setVoteSelection(null)
      }
      if (data.type === 'round_result') {
        setRoundResult(data.result)
      }
      if (data.type === 'scoreboard') {
        setScoreboard(data.scoreboard)
        setHistory(data.history)
      }
      if (data.type === 'categories') {
        setCategories(data.categories)
        setCategoryDrafts(data.categories)
      }
      if (data.type === 'drafts') {
        setSubmissionDrafts((prev) => mergeDrafts(prev, data.drafts))
      }
      if (data.type === 'tiebreak_start') {
        setTiebreak(data.tiebreak)
      }
      if (data.type === 'tiebreak_result') {
        setTiebreak(data.tiebreak)
      }
      if (data.type === 'submission_saved') {
        setSubmissionSaved((prev) => ({ ...prev, [data.categoryId]: data.url }))
        setSubmissionErrors((prev) => {
          const next = { ...prev }
          delete next[data.categoryId]
          return next
        })
      }
      if (data.type === 'report_received') {
        setReportNotice('Report received. Thanks.')
        setReportCount((prev) => prev + 1)
      }
      if (data.type === 'error') {
        setReportNotice(data.message)
      }
    })

    return () => {
      ws.close()
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    const stored = window.localStorage.getItem(`tto:drafts:${roomId}`)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as Record<string, string>
      setSubmissionDrafts(parsed)
    } catch {
      return
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    window.localStorage.setItem(`tto:drafts:${roomId}`, JSON.stringify(submissionDrafts))
  }, [roomId, submissionDrafts])

  useEffect(() => {
    if (!roomId || !sessionToken) return
    window.localStorage.setItem(`tto:sessionToken:${roomId}`, sessionToken)
  }, [roomId, sessionToken])

  useEffect(() => {
    if (!roomId) return
    window.localStorage.setItem(`tto:displayName:${roomId}`, displayName)
  }, [roomId, displayName])

  useEffect(() => {
    if (!reportNotice) return
    const timeout = window.setTimeout(() => setReportNotice(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [reportNotice])

  const sendHello = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'update_name', name: displayName }))
  }

  const sendChat = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'chat', message }))
    setMessage('')
  }

  const sendReport = (messageId: string) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'report', messageId }))
    setReportNotice('Report sent.')
  }

  const sendVote = (direction: 'higher' | 'lower' | 'neutral') => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'vote_time', direction }))
    setVoteIntent(direction)
  }

  const startHunt = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'start_hunt' }))
  }

  const sendVoteEntry = (entryId: string) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'vote_submission', entryId }))
    setVoteSelection(entryId)
  }

  const sendTiebreakChoice = (choice: RpsChoice) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'rps_choice', choice }))
    setTiebreakChoice(choice)
  }

  const resetMatch = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'reset_match' }))
  }

  const updateCategoryName = (id: string, name: string) => {
    setCategoryDrafts((prev) =>
      prev.map((category) => (category.id === id ? { ...category, name } : category))
    )
  }

  const addCategoryDraft = () => {
    setCategoryDrafts((prev) => [
      ...prev,
      { id: `cat-${Date.now()}`, name: '' }
    ])
  }

  const removeCategoryDraft = (id: string) => {
    setCategoryDrafts((prev) => prev.filter((category) => category.id !== id))
  }

  const saveCategories = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'update_categories', categories: categoryDrafts }))
    setEditingCategories(false)
  }

  const exportHistory = () => {
    const payload = {
      roomId,
      scoreboard,
      history,
      generatedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tiktok-olympics-${roomId ?? 'room'}-results.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyShareText = async () => {
    const summary = buildShareSummary(scoreboard, history)
    try {
      await navigator.clipboard.writeText(summary)
      setReportNotice('Results copied to clipboard.')
    } catch {
      setReportNotice('Copy failed. Select text manually.')
    }
  }

  const isHost = players.find((player) => player.id === playerId)?.isHost ?? false

  const submitLink = (categoryId: string) => {
    const url = (submissionDrafts[categoryId] ?? '').trim()
    if (!isValidTikTokUrl(url)) {
      setSubmissionErrors((prev) => ({ ...prev, [categoryId]: 'TikTok links only.' }))
      return
    }
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'submit_submission', categoryId, url }))
  }

  const saveDraft = (categoryId: string, url: string) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'save_draft', categoryId, url }))
  }

  const displayTimer = () => {
    if (!timer) return `${settings?.defaultTime ?? 10}:00`
    if (phase === 'hunt' && timer.huntRemainingSeconds !== null) {
      return formatSeconds(timer.huntRemainingSeconds)
    }
    if (phase === 'intermission' && timer.intermissionRemainingSeconds !== null) {
      return formatSeconds(timer.intermissionRemainingSeconds)
    }
    return `${timer.targetMinutes}:00`
  }

  const timerLabel = () => {
    if (phase === 'hunt') return 'Hunt ends in'
    if (phase === 'intermission') return 'Intermission'
    return 'Current target'
  }

  return (
    <div className="page room">
      <header className="room-header">
        <div>
          <p className="eyebrow">Room</p>
          <h2>{roomId ?? 'unknown-room'}</h2>
          <p className="muted">
            {isConnected ? 'Connected' : 'Connecting...'} • {players.length}/10 players • Host:{' '}
            {players.find((player) => player.isHost)?.displayName ?? 'TBD'}
          </p>
        </div>
        <div className="room-actions">
          <button className="btn ghost">Invite link</button>
          <Link className="btn outline" to="/">Leave</Link>
        </div>
      </header>

      <section className="room-grid">
        <div className="card reveal" style={{ ['--delay' as string]: '0.1s' }}>
          <h3>Lobby</h3>
          <label className="field">
            Display name
            <input
              type="text"
              placeholder="Pick a name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <button className="btn outline" onClick={sendHello} disabled={!displayName.trim()}>
            Update name
          </button>
          <ul className="player-list">
            {players.map((player) => (
              <li key={player.id}>
                <span>
                  {player.displayName}
                  {player.isHost && <span className="host-badge">host</span>}
                </span>
                <span className={`pill ${player.isConnected ? 'online' : 'offline'}`}>
                  {player.isConnected ? 'online' : 'offline'}
                </span>
              </li>
            ))}
          </ul>
          <div className="room-controls">
            <button className="btn primary" onClick={startHunt} disabled={phase !== 'lobby' || !isHost}>
              Start hunt
            </button>
            <button
              className="btn ghost"
              onClick={() => setEditingCategories((prev) => !prev)}
              disabled={!isHost || phase !== 'lobby'}
            >
              {editingCategories ? 'Close category editor' : 'Edit categories'}
            </button>
            <p className="muted">{isHost ? 'You are host.' : 'Host controls only.'}</p>
          </div>
          {editingCategories && (
            <div className="category-editor">
              {categoryDrafts.map((category) => (
                <div key={category.id} className="category-row">
                  <input
                    type="text"
                    placeholder="Category name"
                    value={category.name}
                    onChange={(e) => updateCategoryName(category.id, e.target.value)}
                  />
                  <button className="btn ghost" onClick={() => removeCategoryDraft(category.id)}>
                    Remove
                  </button>
                </div>
              ))}
              <div className="category-actions">
                <button className="btn outline" onClick={addCategoryDraft}>
                  Add category
                </button>
                <button className="btn primary" onClick={saveCategories}>
                  Save categories
                </button>
              </div>
              <p className="muted">3–12 categories. Changes apply before hunt starts.</p>
            </div>
          )}
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.2s' }}>
          <h3>Hunt timer</h3>
          <div className="timer">
            <span className="timer-value">{displayTimer()}</span>
            <span className="timer-label">{timerLabel()}</span>
          </div>
          <div className="vote-strip">
            <button
              className={`btn outline ${voteIntent === 'higher' ? 'active' : ''}`}
              onClick={() => sendVote('higher')}
              disabled={phase !== 'lobby'}
            >
              Higher
            </button>
            <button
              className={`btn outline ${voteIntent === 'lower' ? 'active' : ''}`}
              onClick={() => sendVote('lower')}
              disabled={phase !== 'lobby'}
            >
              Lower
            </button>
            <button
              className={`btn outline ${voteIntent === 'neutral' ? 'active' : ''}`}
              onClick={() => sendVote('neutral')}
              disabled={phase !== 'lobby'}
            >
              Clear
            </button>
          </div>
          <p className="muted">Vote recalculates every 5 seconds.</p>
          <div className="vote-status">
            <span>
              Higher: {timer?.voteHigherCount ?? 0}
            </span>
            <span>
              Lower: {timer?.voteLowerCount ?? 0}
            </span>
            <span>
              Players: {timer?.playerCount ?? players.length}
            </span>
          </div>
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.25s' }}>
          <h3>Round voting</h3>
          {phase !== 'rounds' ? (
            <p className="muted">Rounds start after hunt + intermission.</p>
          ) : (
            <>
              <p className="muted">
                Category: <strong>{round?.categoryName ?? '...'}</strong>
              </p>
              <div className="round-grid">
                {(round?.entries ?? []).map((entry) => (
                  <button
                    key={entry.id}
                    className={`round-entry ${voteSelection === entry.id ? 'selected' : ''}`}
                    onClick={() => sendVoteEntry(entry.id)}
                    disabled={!!tiebreak || phase === 'results'}
                  >
                    <span>{entry.label}</span>
                    <span className="muted">{entry.url ?? 'TikTok link pending'}</span>
                  </button>
                ))}
              </div>
              <p className="muted">
                Time left: {round?.remainingSeconds ?? 0}s
              </p>
              {tiebreak && (
                <div className="tiebreak">
                  <p className="muted">Tie-breaker: Rock–Paper–Scissors</p>
                  <div className="tiebreak-grid">
                    {(['rock', 'paper', 'scissors'] as RpsChoice[]).map((choice) => (
                      <button
                        key={choice}
                        className={`btn outline ${tiebreakChoice === choice ? 'active' : ''}`}
                        onClick={() => sendTiebreakChoice(choice)}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                  <p className="muted">Time left: {tiebreak.remainingSeconds ?? 0}s</p>
                  {tiebreak.winnerEntryId && (
                    <div className="round-result">
                      <p>
                        Tie-break winner:{' '}
                        <strong>{getWinnerLabelFromEntries(tiebreak.winnerEntryId, round?.entries ?? [])}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
              {roundResult && (
                <div className="round-result">
                  <p>
                    Winner: <strong>{getWinnerLabel(roundResult, round?.entries ?? [])}</strong>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.28s' }}>
          <h3>Scoreboard</h3>
          {scoreboard.length === 0 ? (
            <p className="muted">No wins yet.</p>
          ) : (
            <div className="scoreboard">
              {scoreboard.map((entry, index) => (
                <div key={entry.entryId} className={`score-row ${index === 0 ? 'leader' : ''}`}>
                  <span>{entry.displayName}</span>
                  <span>{entry.wins}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {phase === 'results' && (
          <div className="results-panel">
            <div className="results-card">
              <h3>Match results</h3>
              {history.length === 0 ? (
                <p className="muted">No rounds played.</p>
              ) : (
                <div className="history">
                  {history.map((entry) => (
                    <div key={entry.categoryId} className="history-row">
                      <span>{entry.categoryName}</span>
                      <span>{entry.winnerName}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="results-share">
                <label className="field">
                  Share results
                  <textarea readOnly value={buildShareSummary(scoreboard, history)} />
                </label>
                <div className="results-actions">
                  <button className="btn outline" onClick={copyShareText}>
                    Copy text
                  </button>
                  <button className="btn outline" onClick={exportHistory}>
                    Download JSON
                  </button>
                </div>
              </div>
              <button className="btn primary" onClick={resetMatch} disabled={!isHost}>
                Play again
              </button>
            </div>
          </div>
        )}

        <div className="card reveal" style={{ ['--delay' as string]: '0.3s' }}>
          <h3>Categories</h3>
          {phase !== 'hunt' && <p className="muted">Submissions unlock during hunt.</p>}
          <div className="category-grid">
            {categories.map((category) => (
              <div key={category.id} className="category-card">
                <div>
                  <span>{category.name}</span>
                  {submissionSaved[category.id] && (
                    <p className="muted">Saved: {submissionSaved[category.id]}</p>
                  )}
                  {submissionDrafts[category.id] && !submissionSaved[category.id] && (
                    <p className="muted">Draft saved locally.</p>
                  )}
                  {submissionErrors[category.id] && (
                    <p className="error">{submissionErrors[category.id]}</p>
                  )}
                </div>
                <div className="category-actions">
                  <input
                    type="text"
                    placeholder="Paste TikTok URL"
                    value={submissionDrafts[category.id] ?? ''}
                    onChange={(e) =>
                      setSubmissionDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))
                    }
                    onBlur={(e) => saveDraft(category.id, e.target.value)}
                    disabled={phase !== 'hunt'}
                  />
                  <button className="btn ghost" onClick={() => submitLink(category.id)} disabled={phase !== 'hunt'}>
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.4s' }}>
          <h3>Chat</h3>
          <div className="chat-window">
            {chat.length === 0 ? (
              <p className="muted">Chat is always on. Say hi.</p>
            ) : (
              chat.map((line) => (
                <div className="chat-line" key={line.id}>
                  <span>{line.name}:</span> {line.message}
                  <button className="btn ghost" onClick={() => sendReport(line.id)}>
                    Report
                  </button>
                </div>
              ))
            )}
          </div>
          {reportNotice && <p className="muted">{reportNotice}</p>}
          <p className="muted">Reports logged: {reportCount}</p>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault()
              sendChat()
            }}
          >
            <input
              type="text"
              placeholder="Type message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={!message.trim()}>
              Send
            </button>
          </form>
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.5s' }}>
          <h3>Sponsor</h3>
          <div className="sponsor-slot">Buy this slot</div>
          <p className="muted">One sponsor per match. No popups.</p>
        </div>
      </section>
    </div>
  )
}

function getWinnerLabel(result: RoundResult, entries: RoundEntry[]) {
  const winner = entries.find((entry) => entry.id === result.winnerSubmissionId)
  return winner?.label ?? 'TBD'
}

function getWinnerLabelFromEntries(winnerId: string, entries: RoundEntry[]) {
  const winner = entries.find((entry) => entry.id === winnerId)
  return winner?.label ?? 'TBD'
}

function isValidTikTokUrl(url: string) {
  if (!url) return false
  return url.toLowerCase().includes('tiktok.com')
}

function mergeDrafts(existing: Record<string, string>, incoming: Record<string, string>) {
  const next = { ...incoming }
  for (const [key, value] of Object.entries(existing)) {
    if (value && value.trim().length > 0) {
      next[key] = value
    }
  }
  return next
}

function buildShareSummary(scoreboard: ScoreboardEntry[], history: RoundHistoryEntry[]) {
  const lines: string[] = []
  lines.push('ClipClash results')
  if (scoreboard.length > 0) {
    lines.push('Scoreboard:')
    scoreboard.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry.displayName} — ${entry.wins} win${entry.wins === 1 ? '' : 's'}`)
    })
  }
  if (history.length > 0) {
    lines.push('Rounds:')
    history.forEach((entry) => {
      lines.push(`- ${entry.categoryName}: ${entry.winnerName}`)
    })
  }
  return lines.join('\n')
}
