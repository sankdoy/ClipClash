import React, { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
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

function Header() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    getMe().then((data) => {
      if (data?.user) {
        setUser(data.user)
      }
    })
  }, [])

  const isOwner = user && user.is_owner === 1
  return (
    <header className="board-header">
      <div className="board-header-left">
        <Link className="board-back" to="/">
          Home
        </Link>
      </div>
      <div className="board-header-center">
        <h1>ClipClash</h1>
      </div>
      <div className="board-header-right">
        <Link className="icon-btn" to="/donate">
          Donate
        </Link>
        <Link className="icon-btn" to="/sponsor">
          Sponsor
        </Link>
        <Link className="icon-btn" to="/leaderboard">
          Rank
        </Link>
        <Link className="icon-btn" to="/settings">
          Settings
        </Link>
        {isOwner && (
          <Link className="icon-btn" to="/owner">
            Owner
          </Link>
        )}
        <Link className="icon-btn" to="/account">
          Account
        </Link>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="scene">
      <div className="scene__bg" aria-hidden="true" />
      <div className="scene__content">
        <div className="app">
          <div className="board">
            <Header />
            <main className="board-body">
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
          </div>
        </div>
      </div>
    </div>
  )
}
