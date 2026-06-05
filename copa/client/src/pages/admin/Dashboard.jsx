/**
 * Copa Fácil – JS Campinense
 * pages/admin/Dashboard.jsx – Admin overview
 *
 * Shows:
 *  - Stats: campeonatos, equipas, jogos hoje, próximos jogos
 *  - Quick action links
 *  - Recent results
 */

import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { campeonatos as campeonatosApi, equipas as equipasApi } from '../../api/index.js'

function AdminSidebar() {
  const navigate = useNavigate()
  const path = window.location.pathname

  const handleLogout = () => {
    localStorage.removeItem('copa_token')
    navigate('/admin/login')
  }

  const links = [
    { to: '/admin',              icon: '📊', label: 'Dashboard'     },
    { to: '/admin/campeonatos',  icon: '🏆', label: 'Campeonatos'   },
    { to: '/admin/equipas',      icon: '👥', label: 'Equipas'       },
    { to: '/admin/jogos',        icon: '⚽', label: 'Jogos'         },
  ]

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__title">Administração</div>
      <nav className="admin-sidebar__nav">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`admin-sidebar__link${path === l.to || (l.to !== '/admin' && path.startsWith(l.to)) ? ' active' : ''}`}
          >
            <span className="admin-sidebar__icon">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar__logout">
        <button
          className="btn btn--ghost btn--sm"
          onClick={handleLogout}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          🚪 Terminar Sessão
        </button>
      </div>
    </aside>
  )
}

// Export sidebar for reuse in other admin pages
export { AdminSidebar }

export default function Dashboard() {
  const [allCampeonatos, setAllCampeonatos] = useState([])
  const [allEquipas, setAllEquipas] = useState([])
  const [recentJogos, setRecentJogos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      campeonatosApi.getAll(),
      equipasApi.getAll(),
    ]).then(async ([camps, eqs]) => {
      setAllCampeonatos(camps)
      setAllEquipas(eqs)

      // Collect recent finished matches from all campeonatos
      const allJogos = []
      for (const c of camps.slice(0, 3)) {
        try {
          const jgs = await campeonatosApi.getJogos(c.id)
          jgs.filter(j => j.estado === 'terminado').forEach(j => {
            allJogos.push({ ...j, campeonato_nome: c.nome })
          })
        } catch (_) {}
      }
      // Sort by most recent
      allJogos.sort((a, b) => (b.data_jogo || '').localeCompare(a.data_jogo || ''))
      setRecentJogos(allJogos.slice(0, 6))
    }).finally(() => setLoading(false))
  }, [])

  const emCurso = allCampeonatos.filter(c => c.estado === 'em_curso').length
  const porIniciar = allCampeonatos.filter(c => c.estado === 'por_iniciar').length

  const today = new Date().toISOString().slice(0, 10)
  // Upcoming = agendado jogos from today onwards (rough count)
  const proximosTotal = allCampeonatos.reduce((s, c) => s + (c.num_jogos || 0), 0)

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-page-header">
          <h1 className="admin-page-title">
            <span>Painel</span> de Controlo
          </h1>
          <Link to="/" className="btn btn--ghost btn--sm">
            🌐 Ver site público
          </Link>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /> A carregar…</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid--4" style={{ marginBottom: '2rem' }}>
              <div className="stat-card">
                <div className="stat-card__icon">🏆</div>
                <div>
                  <div className="stat-card__value">{allCampeonatos.length}</div>
                  <div className="stat-card__label">Campeonatos</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon">▶️</div>
                <div>
                  <div className="stat-card__value">{emCurso}</div>
                  <div className="stat-card__label">Em Curso</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon">👥</div>
                <div>
                  <div className="stat-card__value">{allEquipas.length}</div>
                  <div className="stat-card__label">Equipas</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon">📅</div>
                <div>
                  <div className="stat-card__value">{porIniciar}</div>
                  <div className="stat-card__label">Por Iniciar</div>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="section-title" style={{ marginBottom: '1rem' }}>Acesso Rápido</div>
            <div className="grid grid--3" style={{ marginBottom: '2.5rem' }}>
              {[
                { to: '/admin/campeonatos', icon: '🏆', label: 'Gerir Campeonatos', desc: 'Criar, editar e eliminar campeonatos' },
                { to: '/admin/equipas',     icon: '👥', label: 'Gerir Equipas',     desc: 'Gerir equipas e jogadores' },
                { to: '/admin/jogos',       icon: '⚽', label: 'Gerir Jogos',       desc: 'Introduzir resultados e datas' },
              ].map(item => (
                <Link key={item.to} to={item.to} className="card" style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="card__body" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{item.icon}</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Recent results */}
            {recentJogos.length > 0 && (
              <>
                <div className="section-title">Resultados Recentes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recentJogos.map(jogo => (
                    <div
                      key={jogo.id}
                      className="jogo-item"
                      style={{ cursor: 'default' }}
                    >
                      <div className="jogo-equipa">
                        <span className="jogo-equipa__brasao">{jogo.equipa_casa_brasao || '⚽'}</span>
                        <span className="jogo-equipa__nome">{jogo.equipa_casa_nome}</span>
                      </div>
                      <div className="jogo-resultado">
                        <div className="jogo-placar">{jogo.gols_casa} – {jogo.gols_fora}</div>
                        <div className="jogo-data" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {jogo.campeonato_nome}
                        </div>
                      </div>
                      <div className="jogo-equipa jogo-equipa--fora">
                        <span className="jogo-equipa__brasao">{jogo.equipa_fora_brasao || '⚽'}</span>
                        <span className="jogo-equipa__nome">{jogo.equipa_fora_nome}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
