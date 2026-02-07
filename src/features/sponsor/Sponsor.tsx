import React, { useEffect, useRef, useState } from 'react'
import { isBlocked } from '../../../shared/moderation'
import { getMe } from '../../utils/auth'

type FormState = {
  sponsorName: string
  tagline: string
  clickUrl: string
  contactEmail: string
}

type BundlePrice = {
  credits: number
  price_usd: number
}

type TierResponse = {
  pricePerCredit: number
  creditBundles: BundlePrice[]
}

type ImageState = {
  dataUrl: string
  width: number
  height: number
  valid: boolean
  error: string | null
}

type SponsorAnalytics = {
  sponsorId: string
  name: string
  status: string
  createdAt: number
  creditsRemaining: number
  creditsPurchased: number
  creditsSpent: number
  lastShownAt: number | null
  campaign: { id: string; creativeUrl: string; clickUrl: string; tagline: string; status: string } | null
  stats: {
    gamesShown: number
    totalImpressions: number
    totalClicks: number
    clickRate: number
    firstShown: number | null
    lastShown: number | null
    dailyImpressions: { date: number; impressions: number; games: number }[]
  }
}

const REQUIRED_WIDTH = 1200
const REQUIRED_HEIGHT = 600
const MAX_FILE_BYTES = 512_000 // 500 KB

const initialForm: FormState = {
  sponsorName: '',
  tagline: '',
  clickUrl: '',
  contactEmail: ''
}

export default function Sponsor() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [status, setStatus] = useState<string | null>(null)
  const [tiers, setTiers] = useState<TierResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [creditBundles, setCreditBundles] = useState<Record<number, number>>({})
  const [imageState, setImageState] = useState<ImageState | null>(null)
  const [moderationError, setModerationError] = useState<string | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [analytics, setAnalytics] = useState<SponsorAnalytics[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (moderationError) checkModeration({ ...form, [key]: value })
  }

  const checkModeration = (state: FormState) => {
    if (isBlocked(state.sponsorName)) {
      setModerationError('Sponsor name contains inappropriate content.')
      return false
    }
    if (isBlocked(state.tagline)) {
      setModerationError('Tagline contains inappropriate content.')
      return false
    }
    setModerationError(null)
    return true
  }

  useEffect(() => {
    getMe().then((data) => {
      if (data?.user) {
        setIsSignedIn(true)
        setForm((prev) => ({ ...prev, contactEmail: data.user!.email }))
        fetchAnalytics()
      }
    })
  }, [])

  const fetchAnalytics = () => {
    setAnalyticsLoading(true)
    fetch('/api/sponsor/analytics', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.sponsors) setAnalytics(data.sponsors)
      })
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false))
  }

  useEffect(() => {
    let mounted = true
    fetch('/api/sponsor/tiers')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return
        setTiers(data ?? null)
      })
      .catch(() => setTiers(null))
      .finally(() => setLoading(false))
    return () => { mounted = false }
  }, [])

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageState({ dataUrl: '', width: 0, height: 0, valid: false, error: 'File must be an image (PNG or JPG).' })
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setImageState({ dataUrl: '', width: 0, height: 0, valid: false, error: `Image too large. Maximum ${MAX_FILE_BYTES / 1000} KB.` })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) {
        setImageState({ dataUrl: '', width: 0, height: 0, valid: false, error: 'Failed to read image.' })
        return
      }
      const img = new Image()
      img.onload = () => {
        const valid = img.width === REQUIRED_WIDTH && img.height === REQUIRED_HEIGHT
        setImageState({
          dataUrl,
          width: img.width,
          height: img.height,
          valid,
          error: valid ? null : `Image must be exactly ${REQUIRED_WIDTH}x${REQUIRED_HEIGHT}px. Yours is ${img.width}x${img.height}px.`
        })
      }
      img.onerror = () => {
        setImageState({ dataUrl: '', width: 0, height: 0, valid: false, error: 'Cannot load image. Try PNG or JPG.' })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus(null)

    if (!checkModeration(form)) return

    if (!form.clickUrl.startsWith('https://')) {
      setStatus('Destination URL must start with https://')
      return
    }
    if (!imageState?.valid) {
      setStatus(`Upload an image that is exactly ${REQUIRED_WIDTH}x${REQUIRED_HEIGHT}px.`)
      return
    }

    const credits = Object.entries(creditBundles).reduce((sum, [bundle, count]) => (
      sum + Number(bundle) * count
    ), 0)

    if (credits <= 0) {
      setStatus('Select at least one credit bundle.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        brandName: form.sponsorName,
        contactEmail: form.contactEmail,
        clickUrl: form.clickUrl,
        tagline: form.tagline,
        imageUrl: imageState.dataUrl,
        credits,
        purchased: {
          creditBundles: Object.entries(creditBundles)
            .filter(([, count]) => count > 0)
            .map(([c, count]) => ({ credits: Number(c), count }))
        }
      }
      const res = await fetch('/api/sponsor/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data?.url) {
        window.location.assign(data.url)
        return
      }
      if (res.ok) {
        setStatus('Sponsor campaign created. Credits applied to your account.')
        setForm(initialForm)
        setCreditBundles({})
        setImageState(null)
      } else {
        setStatus(data?.error ?? 'Submission failed. Try again.')
      }
    } catch {
      setStatus('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalCredits = Object.entries(creditBundles).reduce((sum, [credits, count]) => (
    sum + Number(credits) * count
  ), 0)
  const totalUsd = tiers
    ? Number((totalCredits * (tiers.pricePerCredit ?? 0)).toFixed(2))
    : 0

  return (
    <div className="page">
      <div className="card">
        <h2>Sponsor a game</h2>
        <p className="muted">
          One sponsor per game. Your brand appears in a 3.5s unskippable intro stinger and
          on the results screen with a Visit Sponsor button.
        </p>
        <div className="grid">
          <div>
            <h3>How it works</h3>
            <p className="muted">
              1 credit = 1 impression. An impression is counted once per player per game.
            </p>
          </div>
          <div>
            <h3>Pricing</h3>
            <p className="muted">
              Credits are debited per player, per game (intro + results bundled).
            </p>
          </div>
          <div>
            <h3>Multiple buyers</h3>
            <p className="muted">
              Sponsors rotate fairly based on remaining credits, so small buys still get shown.
            </p>
          </div>
        </div>
        {loading ? (
          <p className="muted">Loading tiers...</p>
        ) : !tiers ? (
          <p className="muted">Pricing data unavailable.</p>
        ) : (
          <div className="pricing-grid">
            <div className="panel-card">
              <h3>Credit bundles</h3>
              <p className="muted">1 credit = 1 player impression.</p>
              <div className="bundle-list">
                {tiers.creditBundles.map((bundle) => (
                  <div key={bundle.credits} className="bundle-row">
                    <div>
                      <strong>{bundle.credits.toLocaleString()} credits</strong>
                      <p className="muted">${bundle.price_usd.toFixed(2)}</p>
                    </div>
                    <div className="bundle-controls">
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() =>
                          setCreditBundles((prev) => ({
                            ...prev,
                            [bundle.credits]: Math.max(0, (prev[bundle.credits] ?? 0) - 1)
                          }))
                        }
                      >
                        -
                      </button>
                      <span>{creditBundles[bundle.credits] ?? 0}</span>
                      <button
                        className="btn outline"
                        type="button"
                        onClick={() =>
                          setCreditBundles((prev) => ({
                            ...prev,
                            [bundle.credits]: (prev[bundle.credits] ?? 0) + 1
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Checkout</h3>
        <div className="cart-summary">
          <div>
            <strong>Credits</strong>
            <p className="muted">{totalCredits.toLocaleString()} credits</p>
          </div>
          <div>
            <strong>Total</strong>
            <p className="muted">${totalUsd.toFixed(2)} USD</p>
          </div>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label className="field">
            Company / sponsor name
            <input
              type="text"
              value={form.sponsorName}
              maxLength={40}
              placeholder="Your brand name"
              onChange={(e) => updateField('sponsorName', e.target.value)}
              required
            />
          </label>
          <label className="field">
            Tagline
            <input
              type="text"
              value={form.tagline}
              maxLength={80}
              placeholder="Short description of your brand"
              onChange={(e) => updateField('tagline', e.target.value)}
              required
            />
            <span className="muted">{form.tagline.length}/80</span>
          </label>
          {moderationError && <p className="error">{moderationError}</p>}
          <label className="field">
            Destination URL (https required)
            <input
              type="url"
              value={form.clickUrl}
              placeholder="https://yourbrand.com"
              onChange={(e) => updateField('clickUrl', e.target.value)}
              required
            />
          </label>
          <div className="field">
            <span>Sponsor image ({REQUIRED_WIDTH}x{REQUIRED_HEIGHT}px, PNG/JPG, max 500 KB)</span>
            <div
              className={`upload-drop ${imageState?.valid ? '' : ''}`}
              onClick={() => imageInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (file) handleImageUpload(file)
              }}
            >
              {imageState?.valid && imageState.dataUrl ? (
                <img
                  src={imageState.dataUrl}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '12px' }}
                />
              ) : (
                <p className="muted">Click or drag an image here</p>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg"
                ref={imageInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file)
                  if (imageInputRef.current) imageInputRef.current.value = ''
                }}
              />
            </div>
            {imageState?.error && <p className="error">{imageState.error}</p>}
            {imageState?.valid && (
              <p className="muted" style={{ color: '#22c55e' }}>
                Image accepted ({imageState.width}x{imageState.height}px)
              </p>
            )}
          </div>
          <label className="field">
            Contact email
            <input
              type="email"
              value={form.contactEmail}
              placeholder="billing@yourbrand.com"
              onChange={(e) => updateField('contactEmail', e.target.value)}
              required
            />
          </label>
          {status && <p className="muted">{status}</p>}
          <button
            className="btn primary"
            type="submit"
            disabled={submitting || totalCredits <= 0 || !imageState?.valid || !!moderationError}
          >
            {submitting ? 'Processing...' : totalCredits > 0 ? `Checkout · $${totalUsd.toFixed(2)}` : 'Select credits to continue'}
          </button>
          <p className="muted" style={{ fontSize: '0.75rem' }}>
            Content is automatically moderated. Inappropriate brand names, taglines, or imagery will be rejected.
            All advertising must comply with UK ASA CAP Code and the Consumer Rights Act 2015.
          </p>
        </form>
      </div>

      {/* ─── ANALYTICS DASHBOARD ─── */}
      {isSignedIn && (
        <div className="card">
          <h3>Your campaigns</h3>
          {analyticsLoading && <p className="muted">Loading analytics...</p>}
          {!analyticsLoading && analytics.length === 0 && (
            <p className="muted">No campaigns yet. Create one above to see analytics here.</p>
          )}
          {analytics.map((sponsor) => (
            <div key={sponsor.sponsorId} className="analytics-campaign">
              <div className="analytics-header">
                <strong>{sponsor.name}</strong>
                <span className={`analytics-status ${sponsor.status}`}>{sponsor.status}</span>
              </div>
              {sponsor.campaign && (
                <p className="muted" style={{ fontSize: '0.8rem' }}>{sponsor.campaign.tagline}</p>
              )}
              <div className="stat-grid" style={{ marginTop: '8px' }}>
                <div className="stat-item">
                  <div className="stat-value">{sponsor.creditsPurchased.toLocaleString()}</div>
                  <div className="stat-label">Purchased</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sponsor.creditsSpent.toLocaleString()}</div>
                  <div className="stat-label">Spent</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sponsor.creditsRemaining.toLocaleString()}</div>
                  <div className="stat-label">Remaining</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sponsor.stats.gamesShown}</div>
                  <div className="stat-label">Games</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sponsor.stats.totalImpressions.toLocaleString()}</div>
                  <div className="stat-label">Impressions</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sponsor.stats.totalClicks.toLocaleString()}</div>
                  <div className="stat-label">Clicks</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sponsor.stats.clickRate}%</div>
                  <div className="stat-label">CTR</div>
                </div>
              </div>
              {sponsor.stats.dailyImpressions.length > 0 && (
                <div className="analytics-chart">
                  <p className="muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Last 30 days</p>
                  <div className="analytics-bars">
                    {sponsor.stats.dailyImpressions.map((day) => {
                      const maxImpressions = Math.max(...sponsor.stats.dailyImpressions.map((d) => d.impressions), 1)
                      const height = Math.max(4, (day.impressions / maxImpressions) * 48)
                      return (
                        <div
                          key={day.date}
                          className="analytics-bar"
                          style={{ height: `${height}px` }}
                          title={`${new Date(day.date).toLocaleDateString()}: ${day.impressions} impressions, ${day.games} games`}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
