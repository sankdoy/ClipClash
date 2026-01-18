import React, { useEffect, useState } from 'react'

type FormState = {
  sponsorName: string
  tagline: string
  clickUrl: string
  imageUrl: string
  contactEmail: string
}

type BundlePrice = {
  games?: number
  credits?: number
  price_usd: number
}

type TierResponse = {
  pricePerViewer: number
  pricePerGame: number
  standardBundles: BundlePrice[]
  streamerCreditBundles: BundlePrice[]
  top250UpdatedAt: number | null
}

const initialForm: FormState = {
  sponsorName: '',
  tagline: '',
  clickUrl: '',
  imageUrl: '',
  contactEmail: ''
}

export default function Sponsor() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [status, setStatus] = useState<string | null>(null)
  const [tiers, setTiers] = useState<TierResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [standardBundles, setStandardBundles] = useState<Record<number, number>>({})
  const [streamerBundles, setStreamerBundles] = useState<Record<number, number>>({})

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
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
    return () => {
      mounted = false
    }
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.clickUrl.startsWith('https://')) {
      setStatus('Destination URL must start with https://')
      return
    }
    const standardGames = Object.entries(standardBundles).reduce((sum, [games, count]) => (
      sum + Number(games) * count
    ), 0)
    const streamerViewerCredits = Object.entries(streamerBundles).reduce((sum, [credits, count]) => (
      sum + Number(credits) * count
    ), 0)
    const payload = {
      brandName: form.sponsorName,
      contactEmail: form.contactEmail,
      clickUrl: form.clickUrl,
      tagline: form.tagline,
      imageUrl: form.imageUrl,
      standardGames,
      streamerViewerCredits,
      purchased: {
        standardBundles: Object.entries(standardBundles).map(([games, count]) => ({
          games: Number(games),
          count
        })),
        streamerBundles: Object.entries(streamerBundles).map(([credits, count]) => ({
          credits: Number(credits),
          count
        }))
      }
    }
    const res = await fetch('/api/sponsor/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
    setStatus(res.ok ? 'Thanks, we will contact you.' : 'Submission failed.')
    if (res.ok) {
      setForm(initialForm)
      setStandardBundles({})
      setStreamerBundles({})
    }
  }

  const isCacheReady = Boolean(tiers?.top250UpdatedAt)
  const totalStandardGames = Object.entries(standardBundles).reduce((sum, [games, count]) => (
    sum + Number(games) * count
  ), 0)
  const totalStreamerCredits = Object.entries(streamerBundles).reduce((sum, [credits, count]) => (
    sum + Number(credits) * count
  ), 0)
  const standardTotalUsd = tiers
    ? Number((totalStandardGames * (tiers.pricePerGame ?? 0)).toFixed(2))
    : 0
  const streamerTotalUsd = tiers
    ? Number((totalStreamerCredits * (tiers.pricePerViewer ?? 0)).toFixed(2))
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
              Sponsor slots are applied per game. Once your spot is queued, it will be
              used on the next available game(s).
            </p>
          </div>
          <div>
            <h3>Pricing</h3>
            <p className="muted">
              Standard games use 3 impressions per game. Streamer games consume live viewer credits.
            </p>
          </div>
          <div>
            <h3>Multiple buyers</h3>
            <p className="muted">
              We run a sponsor queue: first paid, first served, applied to the next available games.
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
              <h3>Standard bundles</h3>
              <p className="muted">Each game counts as 3 impressions.</p>
              <div className="bundle-list">
                {tiers.standardBundles.map((bundle) => (
                  <div key={bundle.games} className="bundle-row">
                    <div>
                      <strong>{bundle.games} games</strong>
                      <p className="muted">${bundle.price_usd.toFixed(2)}</p>
                    </div>
                    <div className="bundle-controls">
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() =>
                          setStandardBundles((prev) => ({
                            ...prev,
                            [bundle.games!]: Math.max(0, (prev[bundle.games!] ?? 0) - 1)
                          }))
                        }
                      >
                        -
                      </button>
                      <span>{standardBundles[bundle.games!] ?? 0}</span>
                      <button
                        className="btn outline"
                        type="button"
                        onClick={() =>
                          setStandardBundles((prev) => ({
                            ...prev,
                            [bundle.games!]: (prev[bundle.games!] ?? 0) + 1
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
            <div className="panel-card">
              <h3>Streamer viewer credits</h3>
              <p className="muted">Consumed when host is live in Top 250. 10% AFK haircut.</p>
              {!isCacheReady && (
                <p className="muted">Top 250 cache warming up. Streamer credits unavailable.</p>
              )}
              <div className="bundle-list">
                {tiers.streamerCreditBundles.map((bundle) => (
                  <div key={bundle.credits} className="bundle-row">
                    <div>
                      <strong>{Number(bundle.credits).toLocaleString()} credits</strong>
                      <p className="muted">${bundle.price_usd.toFixed(2)}</p>
                    </div>
                    <div className="bundle-controls">
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={!isCacheReady}
                        onClick={() =>
                          setStreamerBundles((prev) => ({
                            ...prev,
                            [bundle.credits!]: Math.max(0, (prev[bundle.credits!] ?? 0) - 1)
                          }))
                        }
                      >
                        -
                      </button>
                      <span>{streamerBundles[bundle.credits!] ?? 0}</span>
                      <button
                        className="btn outline"
                        type="button"
                        disabled={!isCacheReady}
                        onClick={() =>
                          setStreamerBundles((prev) => ({
                            ...prev,
                            [bundle.credits!]: (prev[bundle.credits!] ?? 0) + 1
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
        <h3>Inquiry form</h3>
        <div className="cart-summary">
          <div>
            <strong>Standard games</strong>
            <p className="muted">{totalStandardGames} games · ${standardTotalUsd.toFixed(2)}</p>
          </div>
          <div>
            <strong>Streamer credits</strong>
            <p className="muted">{totalStreamerCredits.toLocaleString()} credits · ${streamerTotalUsd.toFixed(2)}</p>
          </div>
          <div>
            <strong>Total</strong>
            <p className="muted">${(standardTotalUsd + streamerTotalUsd).toFixed(2)}</p>
          </div>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label className="field">
            Company / sponsor name
            <input
              type="text"
              value={form.sponsorName}
              maxLength={40}
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
              onChange={(e) => updateField('tagline', e.target.value)}
              required
            />
            <span className="muted">{form.tagline.length}/80</span>
          </label>
          <label className="field">
            Destination URL (https required)
            <input
              type="url"
              value={form.clickUrl}
              onChange={(e) => updateField('clickUrl', e.target.value)}
              required
            />
          </label>
          <label className="field">
            Image URL (PNG/JPG, recommended 1200x600, max 500 KB)
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => updateField('imageUrl', e.target.value)}
              required
            />
          </label>
          <label className="field">
            Contact email
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => updateField('contactEmail', e.target.value)}
              required
            />
          </label>
          {status && <p className="muted">{status}</p>}
          <button className="btn primary" type="submit">
            Submit inquiry
          </button>
        </form>
      </div>
    </div>
  )
}
