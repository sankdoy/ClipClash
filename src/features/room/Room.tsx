import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMe } from '../../utils/auth'
import { generateRandomUsername } from '../../utils/username'
import {
  cancelTimerNotification,
  requestNotificationPermission,
  scheduleTimerNotification
} from '../../utils/notifications'
import { compressVideo } from '../../utils/video-compress'
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
  SponsorSlot,
  Settings,
  TieBreakState,
  TimerState
} from '../../types'
import { isClipUrl, detectPlatform, PLATFORM_NAMES } from '../../../shared/platforms'

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
const BLOCKED_KEY = 'cd:blocked_players'
const FAVOURITES_KEY = 'cd:favourite_players'

function getBlockedPlayers(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(BLOCKED_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function getFavouritePlayers(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

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

function formatChatTime(timestamp: number) {
  const d = new Date(timestamp)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
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
  const [sponsorSlot, setSponsorSlot] = useState<SponsorSlot | null>(null)
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('private')
  const [roomName, setRoomName] = useState('')
  const [roomNameDraft, setRoomNameDraft] = useState('')
  const [showSponsorOverlay, setShowSponsorOverlay] = useState(false)
  const [sponsorOverlaySeen, setSponsorOverlaySeen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [accountUsername, setAccountUsername] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, { url: string; title: string }>>({})
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
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [audienceCode, setAudienceCode] = useState<string | null>(null)
  const [timerDraft, setTimerDraft] = useState(10)
  const [streamerModeEnabled, setStreamerModeEnabled] = useState(false)
  const [blockedPlayers, setBlockedPlayers] = useState<Record<string, string>>(getBlockedPlayers)
  const [favouritePlayers, setFavouritePlayers] = useState<Record<string, string>>(getFavouritePlayers)
  const socketRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<TimerState | null>(null)
  const submitTimersRef = useRef<Record<string, number>>({})
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const isTestPlayer = Boolean(new URLSearchParams(window.location.search).get('player'))
  const isAudienceView = new URLSearchParams(window.location.search).get('audience') === '1'
  const hostKeyFromUrl = new URLSearchParams(window.location.search).get('hostKey') ?? undefined

  // Persist block/fav lists
  useEffect(() => {
    localStorage.setItem(BLOCKED_KEY, JSON.stringify(blockedPlayers))
  }, [blockedPlayers])
  useEffect(() => {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favouritePlayers))
  }, [favouritePlayers])

  const blockPlayer = (pid: string, name: string) => {
    setBlockedPlayers((prev) => ({ ...prev, [pid]: name }))
    setActionNotice(`Blocked ${name}.`)
  }
  const unblockPlayer = (pid: string) => {
    setBlockedPlayers((prev) => {
      const next = { ...prev }
      delete next[pid]
      return next
    })
  }
  const favouritePlayer = (pid: string, name: string) => {
    setFavouritePlayers((prev) => ({ ...prev, [pid]: name }))
    setActionNotice(`Added ${name} to favourites.`)
  }
  const unfavouritePlayer = (pid: string) => {
    setFavouritePlayers((prev) => {
      const next = { ...prev }
      delete next[pid]
      return next
    })
  }

  // Check if any blocked players are in the room
  const blockedInRoom = players.filter((p) => blockedPlayers[p.id] && p.id !== playerId)

  useEffect(() => {
    if (!roomId) return
    const ws = new WebSocket(`${getWsBase()}/room/${roomId}`)
    socketRef.current = ws

    ws.addEventListener('open', () => {
      setIsConnected(true)
      const storedToken =
        isTestPlayer || isAudienceView ? null : window.localStorage.getItem(`tto:sessionToken:${roomId}`)
      const storedName =
        isTestPlayer || isAudienceView ? '' : window.localStorage.getItem(`tto:displayName:${roomId}`) ?? ''
      const autoName =
        !storedName && !displayName ? generateRandomUsername() : null
      const audienceFromUrl = new URLSearchParams(window.location.search).get('audienceCode') ?? undefined
      const publicFlag = new URLSearchParams(window.location.search).get('public')
      const visibility = publicFlag === '1' ? 'public' : 'private'
      if (autoName) {
        setDisplayName(autoName)
      }
      if (storedName && !displayName) {
        setDisplayName(storedName)
      }
      ws.send(
        JSON.stringify({
          type: 'hello',
          sessionToken: storedToken ?? undefined,
          hostKey: hostKeyFromUrl ?? undefined,
          audienceCode: audienceFromUrl ?? undefined,
          visibility: hostKeyFromUrl ? visibility : undefined
        })
      )
      if (autoName) {
        ws.send(JSON.stringify({ type: 'update_name', name: autoName }))
      }
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
        setInviteCode(data.inviteCode ?? roomId ?? null)
        setAudienceCode(data.audienceCode ?? null)
        setSponsorSlot(data.sponsorSlot ?? null)
        setStreamerModeEnabled(Boolean(data.settings?.streamerModeEnabled))
        setRoomVisibility(data.roomVisibility ?? 'private')
        setRoomName(data.roomName ?? '')
        setRoomNameDraft(data.roomName ?? '')
      }
      if (data.type === 'room_state') {
        setPlayers(data.players)
        setChat(data.chat)
        setSettings(data.settings)
        setTimer(data.timer)
        setPhase(data.phase)
        setCategories(data.categories)
        setCategoryDrafts(data.categories)
        setScoreboard(data.scoreboard)
        setHistory(data.history)
        setReportCount(data.reportCount)
        setInviteCode(data.inviteCode ?? roomId ?? null)
        setAudienceCode(data.audienceCode ?? null)
        setSponsorSlot(data.sponsorSlot ?? null)
        setStreamerModeEnabled(Boolean(data.settings?.streamerModeEnabled))
        setRoomVisibility(data.roomVisibility ?? 'private')
        setRoomName(data.roomName ?? '')
        setRoomNameDraft((prev) => (prev.trim().length ? prev : data.roomName ?? ''))
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
        setStreamerModeEnabled(Boolean(data.settings?.streamerModeEnabled))
      }
      if (data.type === 'round_start') {
        setRound(data.round)
        setRoundResult(null)
        setTiebreak(null)
        setTiebreakChoice(null)
        setVoteSelection(null)
      }
      if (data.type === 'round_update') {
        setRound(data.round)
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
      if (data.type === 'invite_code') {
        setInviteCode(data.code)
        setActionNotice('New room code generated.')
      }
      if (data.type === 'room_closed') {
        setReportNotice(data.message)
        ws.close()
        window.location.assign('/')
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
      const parsed = JSON.parse(stored)
      const normalized: Record<string, { url: string; title: string }> = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          normalized[key] = { url: value, title: '' }
        } else if (value && typeof value === 'object' && 'url' in (value as Record<string, unknown>)) {
          normalized[key] = value as { url: string; title: string }
        }
      }
      setSubmissionDrafts(normalized)
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
    if (isTestPlayer || isAudienceView) return
    window.localStorage.setItem(`tto:sessionToken:${roomId}`, sessionToken)
  }, [roomId, sessionToken, isTestPlayer, isAudienceView])

  useEffect(() => {
    if (!roomId) return
    if (isTestPlayer || isAudienceView) return
    window.localStorage.setItem(`tto:displayName:${roomId}`, displayName)
  }, [roomId, displayName, isTestPlayer, isAudienceView])

  useEffect(() => {
    timerRef.current = timer
  }, [timer])

  useEffect(() => {
    let interval: number | null = null
    const updateHuntTitle = () => {
      const current = timerRef.current
      const remaining = current?.huntRemainingSeconds ?? (settings?.defaultTime ?? 10) * 60
      document.title = `${formatSeconds(remaining)} \u2022 ClipDuel`
    }

    if (phase === 'hunt') {
      updateHuntTitle()
      interval = window.setInterval(updateHuntTitle, 1000)
    } else if (phase === 'intermission') {
      let flip = false
      const updateIntermissionTitle = () => {
        document.title = flip ? '\u23f8 Intermission \u2022 ClipDuel' : 'ClipDuel'
        flip = !flip
      }
      updateIntermissionTitle()
      interval = window.setInterval(updateIntermissionTitle, 800)
    } else {
      document.title = 'ClipDuel'
    }

    return () => {
      if (interval) {
        window.clearInterval(interval)
      }
    }
  }, [phase, settings?.defaultTime])

  // Native notifications for phase transitions (Capacitor only)
  useEffect(() => {
    if (phase === 'hunt') {
      const remaining = timer?.huntRemainingSeconds ?? (settings?.defaultTime ?? 10) * 60
      if (remaining > 5) {
        scheduleTimerNotification('Hunt is over!', 'Time to watch clips and vote.', remaining)
      }
    } else if (phase === 'rounds' && round?.stage === 'vote') {
      scheduleTimerNotification('Time to vote!', 'Pick your favourite clip.', 0)
    } else if (phase === 'results') {
      scheduleTimerNotification('Results are in!', 'See who won this round.', 0)
    } else {
      cancelTimerNotification()
    }
  }, [phase, round?.stage])

  // Request notification permission once when joining a room
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  // Auto-scroll chat (only within the chat container, not the whole page)
  useEffect(() => {
    const el = chatEndRef.current
    if (el?.parentElement) {
      el.parentElement.scrollTop = el.parentElement.scrollHeight
    }
  }, [chat])

  // Sponsor stinger overlay
  useEffect(() => {
    if (phase === 'lobby') {
      setSponsorOverlaySeen(false)
      setShowSponsorOverlay(false)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'hunt') return
    if (sponsorOverlaySeen) return
    if (!sponsorSlot) return
    setSponsorOverlaySeen(true)
    setShowSponsorOverlay(true)
  }, [phase, sponsorOverlaySeen, sponsorSlot])

  useEffect(() => {
    if (!showSponsorOverlay) return
    const timeout = window.setTimeout(() => setShowSponsorOverlay(false), 3500)
    return () => window.clearTimeout(timeout)
  }, [showSponsorOverlay])

  const currentPlayer = players.find((player) => player.id === playerId) ?? null
  const isHost = currentPlayer?.isHost ?? false
  const isReady = currentPlayer?.isReady ?? false
  const isDone = currentPlayer?.isDone ?? false
  const allReady = players.filter((player) => player.isConnected && !player.isHost).every((player) => player.isReady)
  const nameLocked = Boolean(accountUsername)

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
      setAudienceStatus('Purchase confirmed. Audience Mode unlocked.')
      params.delete('audience')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    }
    if (params.get('audience') === 'cancel') {
      setAudienceStatus('Purchase cancelled.')
      params.delete('audience')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    }
  }, [])

  const sendHello = () => {
    if (nameLocked) {
      setActionNotice('Name is locked to your account profile.')
      return
    }
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'update_name', name: displayName }))
  }

  const sendChat = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setReportNotice('Not connected to chat.')
      return
    }
    if (message.length > 200) return
    ws.send(JSON.stringify({ type: 'chat', message }))
    setMessage('')
  }

  const sendReport = (messageId: string) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'report', messageId }))
    setReportNotice('Report sent. Chat log attached.')
  }

  const startHunt = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'start_hunt' }))
  }

  const sendVoteEntry = (entryId: string) => {
    if (phase !== 'rounds') return
    if (!round || round.stage !== 'vote') return
    if (voteSelection) return
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'vote_submission', entryId }))
    setVoteSelection(entryId)
  }

  const skipClip = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'skip_clip' }))
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

  const setTimerTarget = (minutes: number) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'set_timer', minutes }))
  }

  const setReady = (ready: boolean) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'set_ready', ready }))
  }

  const setDone = (done: boolean) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'set_done', done }))
  }

  const assignHost = (playerId: string) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'assign_host', playerId }))
  }

  const kickPlayer = (playerId: string) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'kick_player', playerId }))
  }

  const closeRoom = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'close_room' }))
  }

  const leaveRoom = () => {
    socketRef.current?.close()
    window.location.assign('/')
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
      await navigator.clipboard.writeText(inviteCode ?? roomId)
      setActionNotice('Room code copied.')
    } catch {
      setActionNotice('Copy failed. Use the room code.')
    }
  }

  const copyAudienceInvite = async () => {
    if (!roomId || !audienceCode) return
    const url = `${window.location.origin}/room/${roomId}?audience=1&audienceCode=${encodeURIComponent(audienceCode)}`
    try {
      await navigator.clipboard.writeText(url)
      setActionNotice('Audience link copied.')
    } catch {
      setActionNotice('Copy failed. Share the audience code.')
    }
  }

  const fetchEntitlements = async () => {
    const res = await fetch('/api/entitlements')
    if (!res.ok) return
    const data = (await res.json()) as { hasAudienceMode?: boolean }
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
      const data = (await res.json()) as { url?: string; error?: string }
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

  const updateRoomVisibility = (visibility: 'public' | 'private') => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'set_room_visibility', visibility }))
    setRoomVisibility(visibility)
  }

  const saveRoomName = () => {
    const trimmed = roomNameDraft.trim()
    if (!trimmed) return
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'set_room_name', name: trimmed }))
  }

  const setStreamerMode = (enabled: boolean) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'set_streamer_mode', enabled }))
    setStreamerModeEnabled(enabled)
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
      chatLog: chat,
      generatedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `clipduel-${roomId ?? 'room'}-results.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportClipLinks = () => {
    const lines: string[] = ['ClipDuel - All Clip Links', '']
    history.forEach((h) => {
      lines.push(`${h.categoryName} - Winner: ${h.winnerName}`)
      if (h.winnerClipTitle) lines.push(`  Title: ${h.winnerClipTitle}`)
      if (h.winnerClipUrl) lines.push(`  ${h.winnerClipUrl}`)
      lines.push('')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `clipduel-${roomId ?? 'room'}-clips.txt`
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
  const roomCode = roomId ?? '---'
  const inviteUrl = roomId ? `${window.location.origin}/room/${roomId}` : ''
  const submittedCount = Object.keys(submissionSaved).length
  const nextCategory = categories[history.length]?.name
  const timerMin = settings?.minTime ?? 3
  const timerMax = settings?.maxTime ?? 20
  const connectedPlayers = players.filter((player) => player.isConnected && !player.isHost)
  const readyCount = connectedPlayers.filter((player) => player.isReady).length
  const chatLimit = 200
  const chatCount = message.length
  const chatTooLong = chatCount > chatLimit

  useEffect(() => {
    if (timer?.targetMinutes) {
      setTimerDraft(timer.targetMinutes)
    }
  }, [timer?.targetMinutes])

  const extractingRef = useRef<Record<string, boolean>>({})

  const queueSubmission = (categoryId: string, url: string, title: string, immediate = false) => {
    const timers = submitTimersRef.current
    if (timers[categoryId]) {
      window.clearTimeout(timers[categoryId])
    }
    const run = async () => {
      const trimmed = url.trim()
      if (!trimmed) {
        setSubmissionErrors((prev) => {
          const next = { ...prev }
          delete next[categoryId]
          return next
        })
        return
      }
      if (!isClipUrl(trimmed)) {
        setSubmissionErrors((prev) => ({
          ...prev,
          [categoryId]: 'Unsupported platform. Use TikTok, YouTube Shorts, Instagram, Facebook, or other supported links.'
        }))
        return
      }
      setSubmissionErrors((prev) => {
        const next = { ...prev }
        delete next[categoryId]
        return next
      })
      const ws = socketRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      // Submit to DO immediately (without video), then extract + compress + upload in background
      ws.send(JSON.stringify({ type: 'submit_submission', categoryId, url: trimmed, title: title.trim() || 'Untitled' }))

      // Extract, compress, and upload video in background
      if (!extractingRef.current[trimmed]) {
        extractingRef.current[trimmed] = true
        try {
          // Step 1: Get direct download URL from cobalt
          const extractRes = await fetch('/api/video/extract', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: trimmed })
          })
          const extractData = await extractRes.json()
          if (!extractData?.ok || !extractData.downloadUrl) throw new Error('Extract failed')

          // Step 2: Download video through our proxy (CORS)
          const videoRes = await fetch(`/api/video/proxy?url=${encodeURIComponent(extractData.downloadUrl)}`)
          if (!videoRes.ok) throw new Error('Download failed')
          const rawBlob = await videoRes.blob()

          // Step 3: Compress client-side
          const compressed = await compressVideo(rawBlob)

          // Step 4: Upload compressed video to R2
          const uploadRes = await fetch('/api/video/upload', {
            method: 'POST',
            headers: { 'content-type': compressed.type || 'video/webm' },
            body: compressed
          })
          const uploadData = await uploadRes.json()
          if (!uploadData?.ok || !uploadData.serveUrl) throw new Error('Upload failed')

          // Step 5: Re-submit with video URL
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'submit_submission',
              categoryId,
              url: trimmed,
              title: title.trim() || 'Untitled',
              videoUrl: uploadData.serveUrl
            }))
          }
        } catch (err) {
          console.warn('[video-extract] Pipeline failed for', trimmed, err)
        } finally {
          delete extractingRef.current[trimmed]
        }
      }
    }
    if (immediate) {
      run()
      return
    }
    timers[categoryId] = window.setTimeout(run, 500)
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

  const timerLabelText = phase === 'hunt' ? 'Hunt ends in' : phase === 'intermission' ? 'Intermission' : ''

  if (isAudienceView) {
    return (
      <div className="page room audience">
        <div className="room-status-bar">
          <div>
            <p className="eyebrow">Audience</p>
            <h2>{roomCode}</h2>
            <p className="muted">{isConnected ? 'Connected' : 'Connecting...'} &bull; {phase}</p>
          </div>
        </div>
        <div className="panel-card">
          {phase === 'rounds' && round ? (
            <>
              <h3>
                {round.stage === 'playback' ? 'Watching clips' :
                 round.stage === 'fester' ? 'Fester...' :
                 round.stage === 'post_clips_wait' ? 'Get ready to vote' :
                 round.stage === 'vote' ? 'Vote now' :
                 round.stage === 'result' ? 'Winner!' : 'Round'}
              </h3>
              <p className="muted">Category: {round.categoryName}</p>
              {round.stage === 'vote' ? (
                <>
                  <p className="muted">Vote time remaining: {round.remainingSeconds ?? 0}s</p>
                  <div className="vote-grid">
                    {round.entries.map((entry, idx) => (
                      <button
                        key={entry.id}
                        className={`vote-card ${voteSelection === entry.id ? 'voted' : ''}`}
                        onClick={() => sendVoteEntry(entry.id)}
                        disabled={!!tiebreak || !!voteSelection}
                      >
                        <ClipThumbnail url={entry.url} platform={entry.platform} title={entry.title} />
                        <span className="vote-card-title">{entry.title || `Clip ${idx + 1}`}</span>
                        <span className="vote-card-label">{entry.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : round.stage === 'fester' ? (
                <p className="fester-text">Letting that clip fester in your mind...</p>
              ) : round.stage === 'result' && round.winnerEntryId ? (
                <p className="muted">Winner: {round.entries.find((e) => e.id === round.winnerEntryId)?.label ?? 'TBD'}</p>
              ) : (
                <p className="muted">{round.remainingSeconds ?? 0}s</p>
              )}
            </>
          ) : (
            <>
              <h3>Waiting for the next round</h3>
              <p className="muted">Stay here to vote when the host starts voting.</p>
            </>
          )}
        </div>
        <div className="board-actions">
          <div className="actions-right">
            <button className="btn outline action-btn" onClick={leaveRoom}>
              Leave
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page room">
      {/* Blocked player warning banner */}
      {blockedInRoom.length > 0 && (
        <div className="blocked-warning">
          Blocked player{blockedInRoom.length > 1 ? 's' : ''} in this room: {blockedInRoom.map((p) => p.displayName).join(', ')}
        </div>
      )}

      <div className="room-status-bar">
        <div>
          <p className="eyebrow">Room</p>
          <h2>{roomCode}</h2>
          <p className="muted">
            {isConnected ? 'Connected' : 'Connecting...'} &bull; {players.length}/10 players &bull; Host:{' '}
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
          Chat
        </button>
      </div>

      <section className="board-grid" data-mobile={mobilePanel}>
        {/* ─── PLAYERS COLUMN ─── */}
        <aside className="board-col players-col" data-panel="players">
          <div className="panel-card players-panel">
            <h3>PLAYERS {players.length}/{maxPlayers}</h3>
            <div className="player-stack">
              {playerSlots.map((player, index) =>
                player ? (
                  <div
                    key={player.id}
                    className={`player-card-v2 ${player.isHost ? 'host' : ''} ${!player.isConnected ? 'offline' : ''} ${favouritePlayers[player.id] ? 'favourite' : ''} ${blockedPlayers[player.id] ? 'blocked' : ''}`}
                  >
                    <div className="player-card-left">
                      <div className="player-avatar-v2">
                        {player.displayName.slice(0, 1).toUpperCase()}
                        <span className={`status-dot ${player.isConnected ? 'online' : 'away'}`} />
                      </div>
                      <div className="player-info-v2">
                        <span className="player-name-v2">
                          {player.displayName}
                          {player.isHost && <span className="host-tag">HOST</span>}
                          {favouritePlayers[player.id] && <span className="fav-tag" title="Favourite">&#9733;</span>}
                        </span>
                        <span className="player-status-v2">
                          {!player.isConnected
                            ? 'Offline'
                            : phase === 'hunt'
                              ? player.isDone ? 'Done' : 'Hunting'
                              : phase === 'lobby'
                                ? player.isReady ? 'Ready' : 'Not ready'
                                : 'In game'}
                        </span>
                      </div>
                    </div>
                    <div className="player-card-right">
                      {(phase === 'lobby' || phase === 'hunt') && (
                        <span className={`ready-dot ${(phase === 'hunt' ? player.isDone : player.isReady) ? 'green' : 'red'}`} />
                      )}
                      {player.id !== playerId && (
                        <div className="player-social-actions">
                          {!favouritePlayers[player.id] ? (
                            <button className="btn-micro" title="Favourite" onClick={() => favouritePlayer(player.id, player.displayName)}>&#9734;</button>
                          ) : (
                            <button className="btn-micro fav" title="Unfavourite" onClick={() => unfavouritePlayer(player.id)}>&#9733;</button>
                          )}
                          {!blockedPlayers[player.id] ? (
                            <button className="btn-micro" title="Block" onClick={() => blockPlayer(player.id, player.displayName)}>&#8856;</button>
                          ) : (
                            <button className="btn-micro blocked" title="Unblock" onClick={() => unblockPlayer(player.id)}>&#8856;</button>
                          )}
                        </div>
                      )}
                      {isHost && !player.isHost && player.isConnected && (
                        <div className="player-host-actions">
                          <button className="btn-micro" title="Make host" onClick={() => assignHost(player.id)}>&#9733;</button>
                          <button className="btn-micro danger" title="Kick" onClick={() => kickPlayer(player.id)}>&#10005;</button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={`empty-${index}`} className="player-card-v2 empty">
                    <div className="player-card-left">
                      <div className="player-avatar-v2 placeholder-av">?</div>
                      <span className="player-status-v2">Empty slot</span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </aside>

        {/* ─── CENTER COLUMN ─── */}
        <main className="board-col center-col" data-panel="main">
          {phase === 'lobby' ? (
            <div className="center-stack">
              {isHost ? (
                <div className="panel-card">
                  <h3>Lobby controls</h3>
                  <div className="timer">
                    <span className="timer-value">{displayTimer()}</span>
                    {timerLabelText && <span className="timer-label">{timerLabelText}</span>}
                  </div>
                  <div className="timer-controls">
                    <label className="field">
                      Host timer (minutes)
                      <input
                        type="number"
                        min={timerMin}
                        max={timerMax}
                        value={timerDraft}
                        onChange={(e) => setTimerDraft(Number(e.target.value))}
                        disabled={!isHost || phase !== 'lobby'}
                      />
                    </label>
                    <button
                      className="btn outline"
                      onClick={() => setTimerTarget(Math.min(timerMax, Math.max(timerMin, timerDraft)))}
                      disabled={!isHost || phase !== 'lobby'}
                    >
                      Set timer
                    </button>
                  </div>
                  <p className="muted">
                    Ready: {readyCount}/{connectedPlayers.length} players
                  </p>
                  <p className="muted">Host controls the timer before the hunt starts.</p>
                </div>
              ) : (
                <div className="panel-card">
                  <h3>Lobby</h3>
                  <p className="muted">Waiting for the host to start.</p>
                  <div className="category-list">
                    {categories.map((category) => (
                      <div key={category.id} className="category-chip">
                        {category.name}
                      </div>
                    ))}
                  </div>
                  <button className="btn primary" onClick={() => setReady(!isReady)}>
                    {isReady ? 'Unready' : 'Ready'}
                  </button>
                  <p className="muted">Ready status updates with a short cooldown.</p>
                </div>
              )}

              {isHost && (
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
                          <h4>Room visibility</h4>
                          <p className="muted">Public rooms appear in the lobby list.</p>
                        </div>
                        <div className="setting-control">
                          <div className="segment-tabs">
                            <button
                              className={`segment ${roomVisibility === 'public' ? 'active' : ''}`}
                              onClick={() => updateRoomVisibility('public')}
                              disabled={!isHost}
                            >
                              Public
                            </button>
                            <button
                              className={`segment ${roomVisibility === 'private' ? 'active' : ''}`}
                              onClick={() => updateRoomVisibility('private')}
                              disabled={!isHost}
                            >
                              Private
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="setting-row">
                        <div className="setting-info">
                          <h4>Room name</h4>
                          <p className="muted">Shown in public discovery.</p>
                        </div>
                        <div className="setting-control">
                          <input
                            type="text"
                            placeholder="Room name"
                            value={roomNameDraft}
                            onChange={(e) => setRoomNameDraft(e.target.value)}
                            className="input-inline"
                            maxLength={32}
                            disabled={!isHost}
                          />
                          <button className="btn outline" onClick={saveRoomName} disabled={!isHost || !roomNameDraft.trim()}>
                            Save
                          </button>
                        </div>
                      </div>
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
                              {audienceLoading ? 'Checkout...' : 'Purchase (\u00a330)'}
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
                    {audienceEnabled && isHost && audienceCode && (
                      <div className="setting-row">
                        <div className="setting-info">
                          <h4>Audience link</h4>
                          <p className="muted">Share with viewers to vote.</p>
                        </div>
                        <div className="setting-control">
                          <span className="room-pill">{audienceCode}</span>
                          <button className="btn outline" onClick={copyAudienceInvite}>
                            Copy link
                          </button>
                        </div>
                      </div>
                    )}

                      <div className="setting-row">
                        <div className="setting-info">
                          <h4>Categories</h4>
                          <p className="muted">3-12 categories.</p>
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
                      <div className="setting-row">
                        <div className="setting-info">
                          <h4>Streamer host</h4>
                          <p className="muted">Enable if hosted by a streamer.</p>
                        </div>
                        <div className="setting-control">
                          <button
                            className="btn outline"
                            onClick={() => setStreamerMode(!streamerModeEnabled)}
                            disabled={!isHost}
                          >
                            {streamerModeEnabled ? 'Disable' : 'Enable'}
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
                            {validCategoryCount} ready. Need 3-12.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="center-stack">
              <div className="panel-card">
                <h3>
                  {phase === 'hunt'
                    ? 'Hunt mode'
                    : phase === 'intermission'
                      ? 'Intermission'
                      : phase === 'rounds'
                        ? 'Voting'
                        : 'Match complete'}
                </h3>
                {(phase === 'hunt' || phase === 'intermission') && (
                  <div className="timer">
                    <span className="timer-value">{displayTimer()}</span>
                    {timerLabelText && <span className="timer-label">{timerLabelText}</span>}
                  </div>
                )}
                {phase === 'hunt' && (
                  <>
                    <p className="muted">Submit one clip per category. You have {categories.length} categories.</p>
                    <div className="platform-badges">
                      {PLATFORM_NAMES.map((name) => (
                        <span key={name} className="platform-badge">{name}</span>
                      ))}
                    </div>
                  </>
                )}
                {phase === 'intermission' && (
                  <p className="muted">
                    Voting prep. Next up: {nextCategory ?? 'TBD'}.
                  </p>
                )}
                {phase === 'rounds' && (
                  <p className="muted">
                    Category: <strong>{round?.categoryName ?? '...'}</strong>
                    {round?.stage === 'playback' && ` - Clip ${Math.min((round?.playbackIndex ?? 0) + 1, round?.entries.length ?? 0)}/${round?.entries.length ?? 0}`}
                    {round?.stage === 'fester' && ' - Fester...'}
                    {round?.stage === 'post_clips_wait' && ' - Voting soon'}
                    {round?.stage === 'vote' && ` - Vote! ${round?.remainingSeconds ?? 0}s`}
                    {round?.stage === 'result' && ' - Winner!'}
                  </p>
                )}
                {phase === 'results' && (
                  <p className="muted">Match complete. Share results or play again below.</p>
                )}
              </div>

              {phase === 'hunt' && (
                <div className="panel-card">
                  <div className="panel-head">
                    <h3>Submissions</h3>
                    <button className="btn outline" onClick={() => setDone(!isDone)}>
                      {isDone ? 'Not done' : 'Done'}
                    </button>
                  </div>
                  <p className="muted">
                    Submitted: {submittedCount}/{categories.length}
                  </p>
                  <div className="category-grid">
                    {categories.map((category) => {
                      const draftObj = submissionDrafts[category.id]
                      const draftUrl = draftObj?.url ?? ''
                      const draftTitle = draftObj?.title ?? ''
                      const platform = draftUrl ? detectPlatform(draftUrl) : null
                      return (
                        <div key={category.id} className="category-card">
                          <div>
                            <span>{category.name}</span>
                            {submissionSaved[category.id] && (
                              <p className="muted saved-indicator">Saved {platform ? `(${platform})` : ''}</p>
                            )}
                            {!submissionSaved[category.id] && submissionErrors[category.id] && (
                              <p className="error">{submissionErrors[category.id]}</p>
                            )}
                            {!submissionSaved[category.id] && !submissionErrors[category.id] && draftUrl && (
                              <p className="muted">Draft {platform ? `- ${platform}` : '- validating...'}</p>
                            )}
                            {!draftUrl && !submissionSaved[category.id] && !submissionErrors[category.id] && (
                              <p className="muted">No submission yet.</p>
                            )}
                          </div>
                          <div className="category-actions">
                            <input
                              type="text"
                              placeholder="Title your clip"
                              value={draftTitle}
                              onChange={(e) => {
                                const title = e.target.value
                                const currentUrl = submissionDrafts[category.id]?.url ?? ''
                                setSubmissionDrafts((prev) => ({
                                  ...prev,
                                  [category.id]: { url: prev[category.id]?.url ?? '', title }
                                }))
                                if (currentUrl.trim() && isClipUrl(currentUrl.trim())) {
                                  queueSubmission(category.id, currentUrl, title)
                                }
                              }}
                              disabled={phase !== 'hunt'}
                              maxLength={80}
                            />
                            <input
                              type="text"
                              placeholder="Paste clip URL (TikTok, YouTube, Insta...)"
                              value={draftUrl}
                              onChange={(e) => {
                                const url = e.target.value
                                const currentTitle = submissionDrafts[category.id]?.title ?? ''
                                setSubmissionDrafts((prev) => ({
                                  ...prev,
                                  [category.id]: { url, title: prev[category.id]?.title ?? '' }
                                }))
                                queueSubmission(category.id, url, currentTitle)
                              }}
                              onBlur={(e) => queueSubmission(category.id, e.target.value, submissionDrafts[category.id]?.title ?? '', true)}
                              disabled={phase !== 'hunt'}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {phase === 'rounds' && (
                <div className="panel-card">
                  {!round || (round.entries ?? []).length === 0 ? (
                    <div className="wait-screen">
                      <p>Waiting for the round to start...</p>
                    </div>
                  ) : round.stage === 'playback' ? (
                    <div className="playback-screen">
                      <p className="round-stage-label">
                        Clip {Math.min(round.playbackIndex + 1, round.entries.length)} of {round.entries.length}
                      </p>
                      <p className="muted">Category: <strong>{round.categoryName}</strong></p>
                      <ClipEmbed
                        url={round.entries[Math.min(round.playbackIndex, round.entries.length - 1)]?.url ?? ''}
                        videoUrl={round.entries[Math.min(round.playbackIndex, round.entries.length - 1)]?.videoUrl}
                        onEnded={isHost ? skipClip : undefined}
                      />
                      <div className="playback-controls">
                        <p className="muted">{round.remainingSeconds ?? 0}s</p>
                        {isHost && (
                          <button className="btn outline" onClick={skipClip}>
                            Next clip
                          </button>
                        )}
                      </div>
                    </div>
                  ) : round.stage === 'fester' ? (
                    <div className="fester-screen">
                      <p className="fester-text">Letting that clip fester in your mind...</p>
                      <p className="fester-countdown">{round.remainingSeconds ?? 0}s</p>
                    </div>
                  ) : round.stage === 'post_clips_wait' ? (
                    <div className="wait-screen">
                      <p className="wait-text">All clips played. Voting opens soon...</p>
                      <p className="muted">{round.remainingSeconds ?? 0}s</p>
                    </div>
                  ) : round.stage === 'vote' ? (
                    <div className="vote-section">
                      <h3>Vote - {round.categoryName}</h3>
                      <p className="muted">Pick your favourite clip. {round.remainingSeconds ?? 0}s remaining</p>
                      <div className="vote-grid">
                        {round.entries.map((entry, idx) => (
                          <button
                            key={entry.id}
                            className={`vote-card ${voteSelection === entry.id ? 'voted' : ''}`}
                            onClick={() => sendVoteEntry(entry.id)}
                            disabled={!!voteSelection || !!tiebreak}
                          >
                            <ClipThumbnail url={entry.url} platform={entry.platform} title={entry.title} />
                            <span className="vote-card-title">{entry.title || `Clip ${idx + 1}`}</span>
                            <span className="vote-card-label">{entry.label}</span>
                          </button>
                        ))}
                      </div>
                      {voteSelection && <p className="muted">Vote locked in.</p>}
                      {tiebreak && (
                        <div className="tiebreak">
                          <p className="muted">Tie-breaker: Rock-Paper-Scissors</p>
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
                          <p className="muted">Tie-break: {tiebreak.remainingSeconds ?? 0}s</p>
                          {tiebreak.winnerEntryId && (
                            <div className="round-result">
                              <p>
                                Tie-break winner:{' '}
                                <strong>{getWinnerLabelFromEntries(tiebreak.winnerEntryId, round.entries)}</strong>
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : round.stage === 'result' ? (
                    <div className="winner-reveal">
                      <h3>{round.categoryName} - Winner</h3>
                      {round.winnerEntryId && (() => {
                        const winnerEntry = round.entries.find((e) => e.id === round.winnerEntryId)
                        if (!winnerEntry) return <p className="muted">Calculating...</p>
                        return (
                          <>
                            <p className="winner-entry-label">{winnerEntry.label}</p>
                            <p className="winner-entry-title">{winnerEntry.title || 'Untitled'}</p>
                            <ClipThumbnail url={winnerEntry.url} platform={winnerEntry.platform} title={winnerEntry.title} />
                          </>
                        )
                      })()}
                      <p className="muted">Next category in {round.remainingSeconds ?? 0}s...</p>
                    </div>
                  ) : (
                    <div className="wait-screen">
                      <p>Loading round...</p>
                    </div>
                  )}
                  {roundResult && round?.stage !== 'result' && (
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
                  {sponsorSlot && (
                    <div className="sponsor-card">
                      {sponsorSlot.imageUrl ? (
                        <img src={sponsorSlot.imageUrl} alt={sponsorSlot.sponsorName || 'Sponsor'} />
                      ) : (
                        <div className="sponsor-placeholder" />
                      )}
                      <div className="sponsor-details">
                        <h4>{sponsorSlot.sponsorName || 'Sponsor'}</h4>
                        <p className="muted">{sponsorSlot.tagline}</p>
                        <a
                          className="btn outline"
                          href={sponsorSlot.clickUrl || '/sponsor'}
                          target="_blank"
                          rel="noopener"
                        >
                          Visit sponsor
                        </a>
                      </div>
                    </div>
                  )}
                  <h3>Match results</h3>
                  {scoreboard.length > 0 && (
                    <div className="winner-showcase">
                      <div className="winner-profile">
                        <div className="winner-avatar">{scoreboard[0].displayName.slice(0, 1).toUpperCase()}</div>
                        <h2>{scoreboard[0].displayName}</h2>
                        <p className="muted">{scoreboard[0].wins} win{scoreboard[0].wins !== 1 ? 's' : ''} - Champion</p>
                      </div>
                      <div className="winner-clips">
                        {history
                          .filter((h) => h.winnerName === scoreboard[0].displayName)
                          .map((h) => (
                            <div key={h.categoryId} className="winner-clip-card">
                              <span className="winner-clip-category">{h.categoryName}</span>
                              <span className="winner-clip-title">{h.winnerClipTitle || 'Untitled'}</span>
                              {h.winnerClipUrl && (
                                <a href={h.winnerClipUrl} target="_blank" rel="noopener" className="btn outline">
                                  Watch clip
                                </a>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  {history.length === 0 ? (
                    <p className="muted">No rounds played.</p>
                  ) : (
                    <div className="history">
                      {history.map((entry) => (
                        <div key={entry.categoryId} className="history-row-results">
                          <span className="history-category">{entry.categoryName}</span>
                          <span className="history-winner">{entry.winnerName}</span>
                          {entry.winnerClipTitle && <span className="history-clip-title">{entry.winnerClipTitle}</span>}
                          {entry.winnerClipUrl && (
                            <a href={entry.winnerClipUrl} target="_blank" rel="noopener" className="history-clip-link">
                              Watch
                            </a>
                          )}
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
                    </div>
                  </div>
                  <a className="btn ghost" href="/sponsor" target="_blank" rel="noopener">
                    Sponsor a game
                  </a>
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

        {/* ─── SIDE COLUMN ─── */}
        <aside className="board-col side-col" data-panel="side">
          {phase === 'rounds' ? (
            <div className="panel-card">
              <h3>Round</h3>
              <p className="muted">
                Category: <strong>{round?.categoryName ?? '...'}</strong>
              </p>
              {!round ? (
                <p className="muted">Waiting for the round to start...</p>
              ) : round.stage === 'playback' ? (
                <p className="muted">
                  Watching clip {Math.min(round.playbackIndex + 1, round.entries.length)}/{round.entries.length} - {round.remainingSeconds ?? 0}s
                </p>
              ) : round.stage === 'fester' ? (
                <p className="muted">Fester pause... {round.remainingSeconds ?? 0}s</p>
              ) : round.stage === 'post_clips_wait' ? (
                <p className="muted">Voting opens in {round.remainingSeconds ?? 0}s</p>
              ) : round.stage === 'vote' ? (
                <p className="muted">Vote now! {round.remainingSeconds ?? 0}s</p>
              ) : round.stage === 'result' ? (
                <p className="muted">Winner revealed! Next in {round.remainingSeconds ?? 0}s</p>
              ) : null}
              <p className="muted">
                Your vote:{' '}
                {voteSelection
                  ? getWinnerLabelFromEntries(voteSelection, round?.entries ?? [])
                  : !round
                    ? '---'
                    : round.stage === 'vote'
                      ? 'Not voted yet'
                      : 'Voting opens soon'}
              </p>
              <p className="muted">Next up: {categories[history.length + 1]?.name ?? 'Results'}</p>
              <div className="scoreboard">
                {scoreboard.length === 0 ? (
                  <p className="muted">No wins yet.</p>
                ) : (
                  scoreboard.slice(0, 3).map((entry, index) => (
                    <div key={entry.entryId} className={`score-row ${index === 0 ? 'leader' : ''}`}>
                      <span>{entry.displayName}</span>
                      <span>{entry.wins}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="panel-card">
              <h3>How to play</h3>
              <div className="how-to-steps">
                <div className="how-step">
                  <div className="how-step-num">1</div>
                  <div>
                    <strong>Get categories</strong>
                    <p className="muted">The host picks categories and a timer.</p>
                  </div>
                </div>
                <div className="how-step">
                  <div className="how-step-num">2</div>
                  <div>
                    <strong>Hunt clips</strong>
                    <p className="muted">Find the best short clips from any platform.</p>
                  </div>
                </div>
                <div className="how-step">
                  <div className="how-step-num">3</div>
                  <div>
                    <strong>Vote + crown</strong>
                    <p className="muted">Vote for the best clip. Most wins takes the crown.</p>
                  </div>
                </div>
              </div>
              <div className="platform-supported">
                <p className="muted" style={{ fontSize: '0.75rem' }}>Supported platforms:</p>
                <div className="platform-badges small">
                  {PLATFORM_NAMES.map((name) => (
                    <span key={name} className="platform-badge">{name}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── DISCORD-STYLE CHAT ─── */}
          <div className="panel-card chat-panel">
            <h3>Chat</h3>
            <div className="chat-window-v2">
              {chat.length === 0 ? (
                <p className="muted chat-empty">Chat is always on. Say hi.</p>
              ) : (
                chat
                  .filter((line) => !blockedPlayers[line.playerId])
                  .map((line) => (
                  <div className="chat-msg" key={line.id}>
                    <div className="chat-msg-header">
                      <span className="chat-msg-name">{line.name}</span>
                      <span className="chat-msg-time">{formatChatTime(line.sentAt)}</span>
                      {line.playerId !== playerId && (
                        <button
                          className="btn-micro danger chat-report-btn"
                          title="Report message"
                          onClick={() => sendReport(line.id)}
                        >
                          &#9888;
                        </button>
                      )}
                    </div>
                    <div className="chat-msg-body">{line.message}</div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            {reportNotice && <p className="muted">{reportNotice}</p>}
            <form
              className="chat-form-v2"
              onSubmit={(e) => {
                e.preventDefault()
                sendChat()
              }}
            >
              <input
                type="text"
                placeholder="Type message"
                value={message}
                maxLength={chatLimit}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="chat-form-footer">
                <span className={`chat-counter ${chatTooLong ? 'over' : ''}`}>
                  {chatCount}/{chatLimit}
                </span>
                <button className="btn primary chat-send" type="submit" disabled={!message.trim() || chatTooLong}>
                  Send
                </button>
              </div>
            </form>
          </div>

          <div className="panel-card">
            <h3>Sponsor</h3>
            <Link className="sponsor-slot" to="/sponsor">
              Buy a slot
            </Link>
            <p className="muted">One sponsor per match. No popups.</p>
          </div>
        </aside>
      </section>

      <div className="board-actions">
        <div className="actions-left">
          <span className="room-pill">Room: {roomCode}</span>
          <button className="btn outline action-btn" onClick={() => setInviteOpen(true)} disabled={!roomId}>
            Invite
          </button>
          {actionNotice && <span className="muted">{actionNotice}</span>}
        </div>
        <div className="actions-right">
          {phase === 'lobby' && isHost && (
            <button
              className="btn primary action-btn"
              onClick={startHunt}
              disabled={phase !== 'lobby' || !allReady}
            >
              Start
            </button>
          )}
          {isHost ? (
            <button className="btn outline action-btn" onClick={closeRoom}>
              Close room
            </button>
          ) : (
            <button className="btn outline action-btn" onClick={leaveRoom}>
              Leave
            </button>
          )}
        </div>
      </div>

      {showSponsorOverlay && sponsorSlot && (
        <div className="sponsor-overlay" role="presentation">
          <div className="sponsor-stinger" onAnimationEnd={() => setShowSponsorOverlay(false)}>
            <p className="eyebrow">Sponsored by</p>
            {sponsorSlot.imageUrl ? (
              <img src={sponsorSlot.imageUrl} alt={sponsorSlot.sponsorName || 'Sponsor'} />
            ) : (
              <div className="sponsor-placeholder" />
            )}
            <h3>{sponsorSlot.sponsorName || 'Sponsor'}</h3>
            <p className="muted">{sponsorSlot.tagline}</p>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Invite players</h3>
              <button className="btn ghost" onClick={() => setInviteOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body invite-body-v2">
              <div className="invite-qr">
                {inviteUrl && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteUrl)}`}
                    alt="Invite QR code"
                  />
                )}
              </div>
              <div className="invite-details-v2">
                <p className="muted">Share this room link or code.</p>
                <div className="invite-url-box">
                  <span className="invite-url-text">{inviteUrl || '---'}</span>
                </div>
                <button className="btn primary" onClick={copyInvite} disabled={!roomId} style={{ width: '100%' }}>
                  Copy link
                </button>
                <div className="invite-code-row">
                  <span className="room-pill">Code: {roomCode}</span>
                  <button className="btn ghost" onClick={copyRoomCode} disabled={!roomId}>
                    Copy code
                  </button>
                </div>
                {audienceEnabled && isHost && audienceCode && (
                  <div className="invite-code-row">
                    <span className="room-pill">Audience: {audienceCode}</span>
                    <button className="btn ghost" onClick={copyAudienceInvite} disabled={!roomId}>
                      Copy audience link
                    </button>
                  </div>
                )}
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

function mergeDrafts(
  existing: Record<string, { url: string; title: string }>,
  incoming: Record<string, { url: string; title: string } | string>
) {
  const next: Record<string, { url: string; title: string }> = {}
  for (const [key, value] of Object.entries(incoming)) {
    next[key] = typeof value === 'string' ? { url: value, title: '' } : value
  }
  for (const [key, value] of Object.entries(existing)) {
    if (value && value.url && value.url.trim().length > 0) {
      next[key] = value
    }
  }
  return next
}

function buildShareSummary(scoreboard: ScoreboardEntry[], history: RoundHistoryEntry[]) {
  const lines: string[] = []
  lines.push('ClipDuel results')
  if (scoreboard.length > 0) {
    lines.push('Scoreboard:')
    scoreboard.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry.displayName} \u2014 ${entry.wins} win${entry.wins === 1 ? '' : 's'}`)
    })
  }
  if (history.length > 0) {
    lines.push('Rounds:')
    history.forEach((entry) => {
      const clipInfo = entry.winnerClipTitle ? ` "${entry.winnerClipTitle}"` : ''
      lines.push(`- ${entry.categoryName}: ${entry.winnerName}${clipInfo}`)
    })
  }
  return lines.join('\n')
}

/**
 * Detects platform from URL and renders the appropriate embed.
 * Falls back to a simple link if no embed is available.
 */
function ClipEmbed({ url, videoUrl, onEnded }: { url: string; videoUrl?: string; onEnded?: () => void }) {
  // If we have a proxied video URL, use native <video> — clean, autoplay, consistent
  if (videoUrl) {
    return (
      <div className="clip-frame clip-native">
        <video
          key={videoUrl}
          className="clip-video"
          src={videoUrl}
          autoPlay
          playsInline
          controls
          onEnded={onEnded}
        />
      </div>
    )
  }

  const platform = detectPlatform(url)

  // YouTube embed — works well natively, keep as iframe
  if (platform === 'YouTube Shorts') {
    const id = extractYouTubeId(url)
    if (id) {
      return (
        <div className="clip-frame">
          <iframe
            key={id}
            className="clip-embed"
            title={`YouTube ${id}`}
            src={`https://www.youtube.com/embed/${id}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )
    }
  }

  // TikTok embed
  if (platform === 'TikTok') {
    const id = extractTikTokId(url)
    if (id) {
      return (
        <div className="clip-frame">
          <iframe
            key={id}
            className="clip-embed"
            title={`TikTok ${id}`}
            src={`https://www.tiktok.com/embed/v2/${id}`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )
    }
  }

  // Instagram embed
  if (platform === 'Instagram Reels') {
    const shortcode = extractInstagramShortcode(url)
    if (shortcode) {
      return (
        <div className="clip-frame">
          <iframe
            key={shortcode}
            className="clip-embed"
            title={`Instagram ${shortcode}`}
            src={`https://www.instagram.com/reel/${shortcode}/embed/`}
            allowFullScreen
          />
        </div>
      )
    }
  }

  // Twitter/X embed
  if (platform === 'Twitter/X') {
    const tweetId = extractTweetId(url)
    if (tweetId) {
      return (
        <div className="clip-frame">
          <iframe
            key={tweetId}
            className="clip-embed"
            title={`Tweet ${tweetId}`}
            src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`}
            allowFullScreen
          />
        </div>
      )
    }
  }

  // Reddit embed
  if (platform === 'Reddit') {
    const redditPath = extractRedditPath(url)
    if (redditPath) {
      return (
        <div className="clip-frame">
          <iframe
            key={redditPath}
            className="clip-embed"
            title="Reddit clip"
            src={`https://www.redditmedia.com${redditPath}?ref_source=embed&embed=true`}
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )
    }
  }

  // Twitch clip embed
  if (platform === 'Twitch') {
    const slug = extractTwitchClipSlug(url)
    if (slug) {
      return (
        <div className="clip-frame">
          <iframe
            key={slug}
            className="clip-embed"
            title={`Twitch ${slug}`}
            src={`https://clips.twitch.tv/embed?clip=${slug}&parent=${window.location.hostname}`}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      )
    }
  }

  // Fallback — link out
  return (
    <div className="clip-frame clip-link-fallback">
      <p className="muted">
        {platform ? `${platform} clip` : 'Clip'} — video is loading or unavailable
      </p>
      <a href={url} target="_blank" rel="noopener" className="btn outline">
        Watch externally
      </a>
    </div>
  )
}

function extractTikTokId(url: string) {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
    /vm\.tiktok\.com\/(\w+)/,
    /vt\.tiktok\.com\/(\w+)/,
    /\/video\/(\d+)/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function extractYouTubeId(url: string) {
  const patterns = [
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function extractInstagramShortcode(url: string) {
  const match = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)
  return match?.[1] ?? null
}

function extractTweetId(url: string) {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  return match?.[1] ?? null
}

function extractRedditPath(url: string) {
  try {
    const parsed = new URL(url)
    if (/reddit\.com$/.test(parsed.hostname.replace(/^www\./, ''))) {
      // Keep the path for /r/sub/comments/id/... URLs
      const match = parsed.pathname.match(/(\/r\/\w+\/comments\/\w+)/)
      return match?.[1] ?? null
    }
    return null
  } catch {
    return null
  }
}

function extractTwitchClipSlug(url: string) {
  // https://clips.twitch.tv/SlugName or https://www.twitch.tv/channel/clip/SlugName
  const clipMatch = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/)
  if (clipMatch?.[1]) return clipMatch[1]
  const channelClipMatch = url.match(/twitch\.tv\/\w+\/clip\/([A-Za-z0-9_-]+)/)
  return channelClipMatch?.[1] ?? null
}

function ClipThumbnail({ url, platform, title }: { url?: string; platform?: string; title?: string }) {
  if (url) {
    const detectedPlatform = platform || detectPlatform(url) || ''
    if (detectedPlatform === 'YouTube Shorts') {
      const id = extractYouTubeId(url)
      if (id) {
        return <img className="clip-thumb" src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt={title || 'Thumbnail'} />
      }
    }
  }
  return (
    <div className="clip-thumb-fallback">
      <span className="platform-badge">{platform || 'Clip'}</span>
    </div>
  )
}
