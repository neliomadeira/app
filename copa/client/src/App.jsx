/**
 * Copa Fácil – JS Campinense
 * App.jsx – Root component with React Router configuration
 *
 * Public routes:
 *   /            → Home (list championships)
 *   /campeonato/:id → Championship detail
 *   /equipa/:id  → Team detail
 *   /admin/login → Login page
 *
 * Protected routes (/admin/*):
 *   /admin       → Dashboard
 *   /admin/campeonatos → GerirCampeonatos
 *   /admin/equipas     → GerirEquipas
 *   /admin/jogos       → GerirJogos
 */

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import Home from './pages/Home.jsx'
import Campeonato from './pages/Campeonato.jsx'
import Equipa from './pages/Equipa.jsx'
import Equipas from './pages/Equipas.jsx'
import Login from './pages/admin/Login.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import GerirCampeonatos from './pages/admin/GerirCampeonatos.jsx'
import GerirEquipas from './pages/admin/GerirEquipas.jsx'
import GerirJogos from './pages/admin/GerirJogos.jsx'

export default function App() {
  return (
    <BrowserRouter basename="/copa">
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/equipas" element={<Equipas />} />
          <Route path="/campeonato/:id" element={<Campeonato />} />
          <Route path="/equipa/:id" element={<Equipa />} />
          <Route path="/admin/login" element={<Login />} />

          {/* Protected admin routes */}
          <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/campeonatos" element={<ProtectedRoute><GerirCampeonatos /></ProtectedRoute>} />
          <Route path="/admin/equipas" element={<ProtectedRoute><GerirEquipas /></ProtectedRoute>} />
          <Route path="/admin/jogos" element={<ProtectedRoute><GerirJogos /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
