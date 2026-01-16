import React from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Home from './features/home/Home'
import About from './features/about/About'
import Room from './features/room/Room'
import Account from './features/account/Account'
import Leaderboard from './features/leaderboard/Leaderboard'
import Donations from './features/donations/Donations'

function Header() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  return (
    <header className="board-header">
      <div className="board-header-left">
        <Link className="board-back" to="/">
          {isHome ? 'Home' : 'Back'}
        </Link>
      </div>
      <div className="board-header-center">
        <h1>ClipClash</h1>
      </div>
      <div className="board-header-right">
        <Link className="icon-btn" to="/donate">
          Donate
        </Link>
        <Link className="icon-btn" to="/leaderboard">
          Rank
        </Link>
        <Link className="icon-btn" to="/account">
          Account
        </Link>
      </div>
    </header>
  )
}

export default function App() {
  return (
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
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
