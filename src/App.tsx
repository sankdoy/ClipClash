import React, { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Home from './features/home/Home'
import About from './features/about/About'
import Room from './features/room/Room'
import Account from './features/account/Account'
import Leaderboard from './features/leaderboard/Leaderboard'
import Donations from './features/donations/Donations'
import Sponsor from './features/sponsor/Sponsor'
import Settings from './features/settings/Settings'
import Owner from './features/owner/Owner'
import { getMe, User } from './utils/auth'

function SiteNav() {
  const [user, setUser] = useState<User | null>(null)
  const location = useLocation()

  useEffect(() => {
    getMe().then((data) => {
      if (data?.user) {
        setUser(data.user)
      }
    })
  }, [])

  const isOwner = user && user.is_owner === 1
  const isRoom = location.pathname.startsWith('/room/')

  // Hide the full nav in room view to keep it distraction-free
  if (isRoom) return null

  return (
    <nav className="site-nav">
      <div className="site-nav-left">
        <Link className="site-nav-logo" to="/">
          ClipClash
        </Link>
      </div>
      <div className="site-nav-center">
        <Link className="nav-link" to="/">Home</Link>
        <Link className="nav-link" to="/leaderboard">Leaderboard</Link>
        <Link className="nav-link" to="/donate">Donate</Link>
        <Link className="nav-link" to="/settings">Settings</Link>
        {isOwner && <Link className="nav-link" to="/owner">Owner</Link>}
      </div>
      <div className="site-nav-right">
        <Link className="nav-btn secondary" to="/sponsor">Sponsor</Link>
        <Link className="nav-btn" to="/account">{user ? 'Account' : 'Sign In'}</Link>
      </div>
    </nav>
  )
}

function SiteFooter() {
  const location = useLocation()
  if (location.pathname.startsWith('/room/')) return null

  return (
    <footer className="site-footer">
      <span>ClipClash</span>
      <div className="site-footer-links">
        <Link to="/about">About</Link>
        <Link to="/sponsor">Sponsor</Link>
        <Link to="/donate">Donate</Link>
      </div>
    </footer>
  )
}

export default function App() {
  const location = useLocation()
  const isRoom = location.pathname.startsWith('/room/')

  return (
    <div className="scene">
      <div className="scene__bg" aria-hidden="true" />
      <div className="scene__content">
        <div className="app">
          <SiteNav />
          {isRoom ? (
            <main className="site-main" style={{ maxWidth: 'none', padding: '0' }}>
              <Routes>
                <Route path="/room/:roomId" element={<Room />} />
              </Routes>
            </main>
          ) : (
            <main className="site-main">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/room/:roomId" element={<Room />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/donate" element={<Donations />} />
                <Route path="/account" element={<Account />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/owner" element={<Owner />} />
                <Route path="/about" element={<About />} />
                <Route path="/sponsor" element={<Sponsor />} />
              </Routes>
            </main>
          )}
          <SiteFooter />
        </div>
      </div>
    </div>
  )
}
