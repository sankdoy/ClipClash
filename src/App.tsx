import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './features/home/Home'
import About from './features/about/About'
import Room from './features/room/Room'

function Header() {
  return (
    <header className="header">
      <h1>ClipClash</h1>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/room/alpha">Room</Link>
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
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  )
}
