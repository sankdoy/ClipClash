import React, { useEffect, useState } from 'react'

type FormState = {
  sponsorName: string
  tagline: string
  destinationUrl: string
  imageUrl: string
  contactEmail: string
}

type Tier = {
  tier_key: string
  tier_label: string
  max_rank: number
  min_avg_viewers: number
  baseline_cpm_usd: number
  discount_rate: number
  last_updated_iso: string
  effective_cpm_usd: number
  price_per_game_usd: number
  display_price: number
}

const initialForm: FormState = {
  sponsorName: '',
  tagline: '',
  destinationUrl: '',
  imageUrl: '',
  contactEmail: ''
}

export default function Sponsor() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [status, setStatus] = useState<string | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [tierKey, setTierKey] = useState('top5')

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    let mounted = true
    fetch('/api/sponsor/tiers')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return
        setTiers(data?.tiers ?? [])
        if (data?.tiers?.length) {
          setTierKey(data.tiers[0].tier_key)
        }
      })
      .catch(() => setTiers([]))
      .finally(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.destinationUrl.startsWith('https://')) {
      setStatus('Destination URL must start with https://')
      return
    }
    const payload = new FormData()
    payload.append('inventory_type', 'Streamer Games')
    payload.append('tier_key', tierKey)
    payload.append('brand_name', form.sponsorName)
    payload.append('contact_email', form.contactEmail)
    payload.append('destination_url', form.destinationUrl)
    payload.append('tagline', form.tagline)
    payload.append('image_url', form.imageUrl)
    const res = await fetch('/api/sponsor/submit', { method: 'POST', body: payload })
    setStatus(res.ok ? 'Thanks, we will contact you.' : 'Submission failed.')
    if (res.ok) {
      setForm(initialForm)
    }
  }

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
              Phase 1: $25 per sponsored game. Later: CPM-based pricing after impressions tracking.
            </p>
          </div>
          <div>
            <h3>Multiple buyers</h3>
            <p className="muted">
              We run a sponsor queue: first paid, first served, applied to the next available games.
            </p>
          </div>
        </div>
        <h3>Streamer Games (Top 250 only)</h3>
        <p className="muted">
          Streamer Games only run when the host is inside the Top 250 streamers list. We price per
          game by tier using the floor (minimum) average viewers of that tier.
        </p>
        {loading ? (
          <p className="muted">Loading tiers...</p>
        ) : tiers.length === 0 ? (
          <p className="muted">Tier data unavailable.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Eligibility</th>
                  <th>Tier floor avg viewers</th>
                  <th>Effective CPM</th>
                  <th>Price per streamer game</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.tier_key}>
                    <td>{tier.tier_label}</td>
                    <td>Rank 1–{tier.max_rank}</td>
                    <td>{tier.min_avg_viewers}</td>
                    <td>${tier.effective_cpm_usd.toFixed(2)}</td>
                    <td>${tier.price_per_game_usd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Inquiry form</h3>
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
              value={form.destinationUrl}
              onChange={(e) => updateField('destinationUrl', e.target.value)}
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
            Tier (for Streamer Games)
            <select value={tierKey} onChange={(e) => setTierKey(e.target.value)}>
              {tiers.map((tier) => (
                <option key={tier.tier_key} value={tier.tier_key}>
                  {tier.tier_label}
                </option>
              ))}
            </select>
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
