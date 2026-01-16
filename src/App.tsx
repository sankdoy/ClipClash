import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './features/home/Home'
import About from './features/about/About'
import Room from './features/room/Room'
import Account from './features/account/Account'
import Leaderboard from './features/leaderboard/Leaderboard'

function Header() {
  return (
    <header className="header">
      <h1>ClipClash</h1>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/room/alpha">Room</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        <Link to="/account">Account</Link>
        <Link to="/about">About</Link>
      </nav>
    </header>
  )
}

export default function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/account" element={<Account />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  )
}
