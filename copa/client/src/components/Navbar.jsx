/**
 * Copa Fácil – JS Campinense
 * components/Navbar.jsx – Top navigation bar
 *
 * Features:
 *  - Logo linking to /
 *  - Nav links: Campeonatos, Equipas, Painel Admin
 *  - Link back to main site
 *  - Mobile hamburger menu
 *  - Sticky dark background with yellow accent
 */

import React, { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Close menu on route change
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!e.target.closest('.navbar')) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <nav className="navbar">
      <div className="container navbar__inner">
        {/* Logo */}
        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-icon">🏆</span>
          <span>Copa <span>JS Campinense</span></span>
        </Link>

        {/* Desktop nav */}
        <ul className={`navbar__nav${open ? ' open' : ''}`}>
          <li>
            <NavLink
              to="/"
              className={({ isActive }) => `navbar__link${isActive && !isAdmin ? ' active' : ''}`}
              end
            >
              Campeonatos
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/equipas"
              className={({ isActive }) => `navbar__link${isActive ? ' active' : ''}`}
            >
              Equipas
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `navbar__link${isActive || isAdmin ? ' active' : ''}`
              }
            >
              Admin
            </NavLink>
          </li>
          <li>
            <a
              href="../index.html"
              className="navbar__link navbar__link--accent"
            >
              ← Site Principal
            </a>
          </li>
        </ul>

        {/* Hamburger */}
        <button
          className={`navbar__hamburger${open ? ' open' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  )
}
