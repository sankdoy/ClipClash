import React, { useState } from 'react'

type FormState = {
  sponsorName: string
  tagline: string
  destinationUrl: string
  imageUrl: string
  contactEmail: string
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

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.destinationUrl.startsWith('https://')) {
      setStatus('Destination URL must start with https://')
      return
    }
    setStatus('Thanks, we will contact you.')
    console.log('Sponsor inquiry', form)
    setForm(initialForm)
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
