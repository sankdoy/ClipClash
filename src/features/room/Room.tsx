import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMe } from '../../utils/auth'
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
import { isTikTokUrl } from '../../../shared/tiktok'

const fallbackCategories: Category[] = [
  { id: 'cutest', name: 'Cutest' },
  { id: 'funniest', name: 'Funniest' },
  { id: 'out-of-pocket', name: 'Most out of pocket' },
  { id: 'cringe', name: 'Cringiest' },
  { id: 'satisfying', name: 'Most satisfying' },
  { id: 'weirdest', name: 'Weirdest' }
]

const categoryPresets = [
  {
    id: 'default',
    label: 'Default pack',
    names: fallbackCategories.map((category) => category.name)
  },
  {
    id: 'creator-chaos',
    label: 'Creator chaos',
    names: [
      'Unexpected talent',
      'Plot twist',
      'Best reaction',
      'DIY hack',
      'Glow up',
      'Satisfying loop',
      'Story time',
      'Wild card'
    ]
  },
  {
    id: 'movie-night',
    label: 'Movie night',
    names: [
      'Best scene',
      'Main character energy',
      'Villain moment',
      'Soundtrack hit',
      'Cinematic shot',
      'Plot hole'
    ]
  },
  {
    id: 'sports-day',
    label: 'Sports day',
    names: [
      'Highlight reel',
      'Biggest comeback',
      'Clutch moment',
      'Worst miss',
      'Crowd hype',
      'Coach reaction'
    ]
  }
]

const lastCategoriesKey = 'cc:last_categories'

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
  const [accountUsername, setAccountUsername] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [voteIntent, setVoteIntent] = useState<'higher' | 'lower' | 'neutral'>('neutral')
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, string>>({})
  const [submissionSaved, setSubmissionSaved] = useState<Record<string, string>>({})
  const [submissionErrors, setSubmissionErrors] = useState<Record<string, string>>({})
  const [reportNotice, setReportNotice] = useState<string | null>(null)
  const [reportCount, setReportCount] = useState(0)
  const [presetId, setPresetId] = useState('default')
  const [loadedSavedDrafts, setLoadedSavedDrafts] = useState(false)
  const [hasAudienceMode, setHasAudienceMode] = useState(false)
  const [audienceStatus, setAudienceStatus] = useState<string | null>(null)
  const [audienceLoading, setAudienceLoading] = useState(false)
  const [centerTab, setCenterTab] = useState<'presets' | 'custom'>('presets')
  const [mobilePanel, setMobilePanel] = useState<'main' | 'players' | 'side'>('main')
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
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
      if (data.type === 'settings') {
        setSettings(data.settings)
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
    getMe().then((data) => {
      if (data?.user?.username) {
        setAccountUsername(data.user.username)
        setDisplayName(data.user.username)
      }
      if (data?.user) {
        fetchEntitlements()
      } else {
        setHasAudienceMode(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!accountUsername || !isConnected) return
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'update_name', name: accountUsername }))
  }, [accountUsername, isConnected])

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

  const isHost = players.find((player) => player.id === playerId)?.isHost ?? false

  useEffect(() => {
    if (!roomId || loadedSavedDrafts || !isHost || phase !== 'lobby') return
    if (!categoriesMatchPreset(categories, fallbackCategories)) return
    const stored = window.localStorage.getItem(lastCategoriesKey)
    if (!stored) return
    try {
      const names = JSON.parse(stored) as string[]
      const cleaned = normalizeCategoryNames(names)
      if (cleaned.length < 3 || cleaned.length > 12) return
      setCategoryDrafts(buildCategoriesFromNames(cleaned))
      setLoadedSavedDrafts(true)
    } catch {
      return
    }
  }, [roomId, loadedSavedDrafts, isHost, phase, categories])

  useEffect(() => {
    if (!reportNotice) return
    const timeout = window.setTimeout(() => setReportNotice(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [reportNotice])

  useEffect(() => {
    if (!actionNotice) return
    const timeout = window.setTimeout(() => setActionNotice(null), 2500)
    return () => window.clearTimeout(timeout)
  }, [actionNotice])

  useEffect(() => {
    if (!inviteOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInviteOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inviteOpen])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('audience') === 'success') {
      fetchEntitlements()
    }
  }, [])

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

  const copyInvite = async () => {
    if (!roomId) return
    const url = `${window.location.origin}/room/${roomId}`
    try {
      await navigator.clipboard.writeText(url)
      setActionNotice('Invite link copied.')
    } catch {
      setActionNotice('Copy failed. Use the room code.')
    }
  }

  const copyRoomCode = async () => {
    if (!roomId) return
    try {
      await navigator.clipboard.writeText(roomId)
      setActionNotice('Room code copied.')
    } catch {
      setActionNotice('Copy failed. Use the room code.')
    }
  }

  const fetchEntitlements = async () => {
    const res = await fetch('/api/entitlements')
    if (!res.ok) return
    const data = await res.json()
    setHasAudienceMode(Boolean(data?.hasAudienceMode))
  }

  const purchaseAudienceMode = async () => {
    if (!roomId) return
    setAudienceLoading(true)
    setAudienceStatus(null)
    try {
      const res = await fetch('/api/audience', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId })
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        setAudienceStatus(data?.error ?? 'Unable to start checkout.')
        return
      }
      window.location.assign(data.url)
    } catch {
      setAudienceStatus('Unable to start checkout.')
    } finally {
      setAudienceLoading(false)
    }
  }

  const setAudienceMode = (enabled: boolean) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'set_audience_mode', enabled }))
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
    const names = normalizeCategoryNames(categoryDrafts.map((category) => category.name))
    if (names.length >= 3 && names.length <= 12) {
      window.localStorage.setItem(lastCategoriesKey, JSON.stringify(names))
    }
    setEditingCategories(false)
  }

  const resetCategoryDrafts = () => {
    setCategoryDrafts(categories.map((category) => ({ ...category })))
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

  const audienceEnabled = settings?.audienceModeEnabled ?? false
  const canPurchaseAudience = isHost && Boolean(accountUsername)
  const validCategoryCount = categoryDrafts.filter((category) => category.name.trim().length > 0).length
  const categoryCountOk = validCategoryCount >= 3 && validCategoryCount <= 12
  const maxPlayers = 10
  const playerSlots: Array<Player | null> = [...players]
  while (playerSlots.length < maxPlayers) {
    playerSlots.push(null)
  }
  const inviteUrl = roomId ? `${window.location.origin}/room/${roomId}` : ''
  const submittedCount = Object.keys(submissionSaved).length
  const nextCategory = categories[history.length]?.name

  const submitLink = (categoryId: string) => {
    const url = (submissionDrafts[categoryId] ?? '').trim()
    if (!isTikTokUrl(url)) {
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
      <div className="room-status-bar">
        <div>
          <p className="eyebrow">Room</p>
          <h2>{roomId ?? 'unknown-room'}</h2>
          <p className="muted">
            {isConnected ? 'Connected' : 'Connecting...'} • {players.length}/10 players • Host:{' '}
            {players.find((player) => player.isHost)?.displayName ?? 'TBD'}
          </p>
        </div>
        <div className="room-status-right">
          <span className="phase-pill">{phase}</span>
        </div>
      </div>

      <div className="board-tabs">
        <button
          className={`tab-btn ${mobilePanel === 'main' ? 'active' : ''}`}
          onClick={() => setMobilePanel('main')}
        >
          Main
        </button>
        <button
          className={`tab-btn ${mobilePanel === 'players' ? 'active' : ''}`}
          onClick={() => setMobilePanel('players')}
        >
          Players
        </button>
        <button
          className={`tab-btn ${mobilePanel === 'side' ? 'active' : ''}`}
          onClick={() => setMobilePanel('side')}
        >
          Chat/Help
        </button>
      </div>

      <section className="board-grid" data-mobile={mobilePanel}>
        <aside className="board-col players-col" data-panel="players">
          <div className="panel-card players-panel">
            <h3>PLAYERS {players.length}/{maxPlayers}</h3>
            <div className="player-stack">
              {playerSlots.map((player, index) =>
                player ? (
                  <div key={player.id} className="player-slot">
                    <div className="player-avatar">{player.displayName.slice(0, 1).toUpperCase()}</div>
                    <div className="player-meta">
                      <span className="player-name">{player.displayName}</span>
                      {player.isHost && <span className="host-badge">host</span>}
                    </div>
                    <span className={`pill ${player.isConnected ? 'online' : 'offline'}`}>
                      {player.isConnected ? 'online' : 'offline'}
                    </span>
                  </div>
                ) : (
                  <div key={`empty-${index}`} className="player-slot placeholder">
                    <div className="player-avatar">?</div>
                    <span className="muted">Empty slot</span>
                  </div>
                )
              )}
            </div>
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
          </div>
        </aside>

        <main className="board-col center-col" data-panel="main">
          {phase === 'lobby' ? (
            <div className="center-stack">
              <div className="panel-card">
                <h3>Lobby controls</h3>
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
                  <span>Higher: {timer?.voteHigherCount ?? 0}</span>
                  <span>Lower: {timer?.voteLowerCount ?? 0}</span>
                  <span>Players: {timer?.playerCount ?? players.length}</span>
                </div>
              </div>

              <div className="panel-card">
                <div className="segment-tabs">
                  <button
                    className={`segment ${centerTab === 'presets' ? 'active' : ''}`}
                    onClick={() => setCenterTab('presets')}
                  >
                    Presets
                  </button>
                  <button
                    className={`segment ${centerTab === 'custom' ? 'active' : ''}`}
                    onClick={() => setCenterTab('custom')}
                  >
                    Custom settings
                  </button>
                </div>
                {centerTab === 'presets' ? (
                  <div className="preset-grid">
                    {categoryPresets.map((preset) => (
                      <button
                        key={preset.id}
                        className={`preset-card ${presetId === preset.id ? 'active' : ''}`}
                        onClick={() => {
                          setPresetId(preset.id)
                          setCategoryDrafts(buildCategoriesFromNames(preset.names))
                        }}
                      >
                        <h4>{preset.label}</h4>
                        <p className="muted">
                          {preset.names.slice(0, 4).join(', ')}
                          {preset.names.length > 4 ? '...' : ''}
                        </p>
                        <span className="pill">{preset.names.length} categories</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="settings-list">
                    <div className="setting-row">
                      <div className="setting-info">
                        <h4>Audience Mode</h4>
                        <p className="muted">Host-only toggle. Unlock spectator features.</p>
                      </div>
                      <div className="setting-control">
                        <button
                          className="btn outline"
                          onClick={() => setAudienceMode(!audienceEnabled)}
                          disabled={!isHost || !hasAudienceMode}
                        >
                          {audienceEnabled ? 'Disable' : 'Enable'}
                        </button>
                        {!hasAudienceMode ? (
                          <button
                            className="btn ghost"
                            onClick={purchaseAudienceMode}
                            disabled={!canPurchaseAudience || audienceLoading}
                          >
                            {audienceLoading ? 'Checkout...' : 'Purchase ($30)'}
                          </button>
                        ) : (
                          <span className="muted">Owned</span>
                        )}
                      </div>
                    </div>
                    {!canPurchaseAudience && (
                      <p className="muted">Sign in to purchase Audience Mode.</p>
                    )}
                    {audienceStatus && <p className="muted">{audienceStatus}</p>}

                    <div className="setting-row">
                      <div className="setting-info">
                        <h4>Categories</h4>
                        <p className="muted">3–12 categories. Changes apply before hunt starts.</p>
                      </div>
                      <div className="setting-control">
                        <button
                          className="btn outline"
                          onClick={() => setEditingCategories((prev) => !prev)}
                          disabled={!isHost || phase !== 'lobby'}
                        >
                          {editingCategories ? 'Close editor' : 'Edit list'}
                        </button>
                        <button className="btn ghost" onClick={resetCategoryDrafts}>
                          Reset
                        </button>
                      </div>
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
                          <button className="btn outline" onClick={addCategoryDraft} disabled={validCategoryCount >= 12}>
                            Add category
                          </button>
                          <button className="btn primary" onClick={saveCategories} disabled={!categoryCountOk}>
                            Save categories
                          </button>
                        </div>
                        <p className="muted">
                          {validCategoryCount} ready. Need 3-12. Changes apply before hunt starts.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="center-stack">
              <div className="panel-card">
                <h3>{phase === 'hunt' ? 'Hunt mode' : phase === 'intermission' ? 'Intermission' : 'Round in progress'}</h3>
                <div className="timer">
                  <span className="timer-value">{displayTimer()}</span>
                  <span className="timer-label">{timerLabel()}</span>
                </div>
                {phase === 'hunt' && (
                  <p className="muted">Submit one TikTok per category. You have {categories.length} categories.</p>
                )}
                {phase === 'intermission' && (
                  <p className="muted">
                    Voting prep. Next up: {nextCategory ?? 'TBD'}.
                  </p>
                )}
                {phase === 'rounds' && (
                  <p className="muted">Vote secretly. You can only vote once per round.</p>
                )}
              </div>

              {phase === 'hunt' && (
                <div className="panel-card">
                  <h3>Submissions</h3>
                  <p className="muted">
                    Submitted: {submittedCount}/{categories.length}
                  </p>
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
                          {!submissionDrafts[category.id] && !submissionSaved[category.id] && (
                            <p className="muted">No submission yet.</p>
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
              )}

              {phase === 'rounds' && (
                <div className="panel-card">
                  <h3>Round voting</h3>
                  <p className="muted">
                    Category: <strong>{round?.categoryName ?? '...'}</strong>
                  </p>
                  <div className="round-grid">
                    {(round?.entries ?? []).map((entry) => (
                      <button
                        key={entry.id}
                        className={`round-entry ${voteSelection === entry.id ? 'selected' : ''}`}
                        onClick={() => sendVoteEntry(entry.id)}
                        disabled={!!tiebreak}
                      >
                        <span>{entry.label}</span>
                        <span className="muted">{entry.url ?? 'No submission yet'}</span>
                      </button>
                    ))}
                  </div>
                  <p className="muted">Time left: {round?.remainingSeconds ?? 0}s</p>
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
                </div>
              )}

              {phase === 'results' && (
                <div className="panel-card">
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
              )}

              <div className="panel-card">
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
            </div>
          )}
        </main>

        <aside className="board-col side-col" data-panel="side">
          <div className="panel-card">
            <h3>How to play</h3>
            <div className="help-graphic" />
            <p className="muted">Vote the timer, hunt clips, then crown each category champion.</p>
            <div className="help-dots">
              <span className="dot active" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
          <div className="panel-card">
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
          <div className="panel-card">
            <h3>Sponsor</h3>
            <div className="sponsor-slot">Buy this slot</div>
            <p className="muted">One sponsor per match. No popups.</p>
            <Link className="muted" to="/donate">
              Support the site
            </Link>
          </div>
        </aside>
      </section>

      <div className="board-actions">
        <div className="actions-left">
          <span className="room-pill">Room code: {roomId ?? '---'}</span>
          <button className="btn outline action-btn" onClick={() => setInviteOpen(true)} disabled={!roomId}>
            <span className="btn-icon">INV</span>
            Invite
          </button>
          {actionNotice && <span className="muted">{actionNotice}</span>}
        </div>
        <div className="actions-right">
          {phase === 'lobby' && (
            <button
              className="btn primary action-btn"
              onClick={startHunt}
              disabled={phase !== 'lobby' || !isHost}
            >
              <span className="btn-icon">GO</span>
              Start
            </button>
          )}
          <Link className="btn outline action-btn" to="/">
            <span className="btn-icon">OUT</span>
            Leave
          </Link>
        </div>
      </div>

      {inviteOpen && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Invite players</h3>
              <button className="btn ghost" onClick={() => setInviteOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="invite-qr">
                {inviteUrl && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteUrl)}`}
                    alt="Invite QR code"
                  />
                )}
              </div>
              <div className="invite-details">
                <p className="muted">Share this room link or code.</p>
                <div className="invite-row">
                  <span className="room-pill">{inviteUrl || '---'}</span>
                  <button className="btn outline" onClick={copyInvite} disabled={!roomId}>
                    Copy link
                  </button>
                </div>
                <div className="invite-row">
                  <span className="room-pill">Code: {roomId ?? '---'}</span>
                  <button className="btn ghost" onClick={copyRoomCode} disabled={!roomId}>
                    Copy code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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

function buildCategoriesFromNames(names: string[]) {
  const stamp = Date.now()
  return names.map((name, index) => ({
    id: createCategoryId(name, stamp, index),
    name
  }))
}

function createCategoryId(name: string, stamp: number, index: number) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)
  return base.length > 0 ? base : `cat-${stamp}-${index}`
}

function normalizeCategoryNames(names: string[]) {
  if (!Array.isArray(names)) return []
  return names
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter((name) => name.length > 0)
    .map((name) => name.slice(0, 32))
}

function categoriesMatchPreset(categories: Category[], preset: Category[]) {
  if (categories.length !== preset.length) return false
  return categories.every((category, index) => category.name === preset[index]?.name)
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
