import React, { useEffect, useState } from 'react'
import { getMe } from '../../utils/auth'

type Donation = {
  id: string
  amount_cents: number
  currency: string
  message: string | null
  message_moderation_status: string
  created_at: string
  username: string | null
  avatar_url: string | null
}

type TopDonor = {
  username: string
  avatar_url: string | null
  total_cents: number
}

export default function Donations() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [topDonors, setTopDonors] = useState<TopDonor[]>([])
  const [amount, setAmount] = useState('10')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    fetchDonations()
    getMe().then((data) => setLoggedIn(Boolean(data?.user)))
  }, [])

  const fetchDonations = async () => {
    const res = await fetch('/api/donations')
    if (!res.ok) return
    const data = await res.json()
    setDonations(data?.donations ?? [])
    setTopDonors(data?.topDonors ?? [])
  }

  const submitDonation = async () => {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), message })
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        setStatus(data?.error ?? 'Unable to start checkout.')
        return
      }
      window.location.assign(data.url)
    } catch {
      setStatus('Unable to start checkout.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page donations">
      <header className="page-header">
        <div>
          <p className="eyebrow">Donations</p>
          <h2>Support ClipDuel</h2>
          <p className="muted">Donations keep the servers running. Thank you.</p>
        </div>
      </header>

      <section className="donation-grid">
        <div className="card">
          <h3>Donation feed</h3>
          {donations.length === 0 ? (
            <p className="muted">No donations yet.</p>
          ) : (
            <div className="donation-feed">
              {donations.map((donation) => (
                <div key={donation.id} className="donation-row">
                  <div>
                    <p className="donation-name">
                      {donation.username ?? 'Guest'}{' '}
                      <span className="muted">{formatAmount(donation.amount_cents, donation.currency)}</span>
                    </p>
                    <p className="muted">
                      {donation.message?.trim().length ? donation.message : 'No message'}
                    </p>
                  </div>
                  <span className="muted">{formatDate(donation.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card donate-panel">
          <h3>Donate</h3>
          {!loggedIn && (
            <p className="muted">Log in to appear on the Top Donors leaderboard.</p>
          )}
          <label className="field">
            Amount (USD)
            <input
              type="number"
              min="1"
              max="500"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="field">
            Message (optional)
            <textarea
              value={message}
              maxLength={200}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share a quick note."
            />
          </label>
          <button className="btn primary" onClick={submitDonation} disabled={loading}>
            {loading ? 'Starting checkout...' : 'Donate'}
          </button>
          {status && <p className="muted">{status}</p>}

          <div className="top-donors">
            <h4>Top donors</h4>
            {topDonors.length === 0 ? (
              <p className="muted">No donors yet.</p>
            ) : (
              <div className="top-donor-list">
                {topDonors.map((donor) => (
                  <div key={donor.username} className="top-donor-row">
                    <span>{donor.username}</span>
                    <span>{formatAmount(donor.total_cents, 'usd')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function formatAmount(cents: number, currency: string) {
  const value = typeof cents === 'number' ? cents / 100 : 0
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}

function formatDate(value: string) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString()
}
