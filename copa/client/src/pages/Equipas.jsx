/**
 * Copa Fácil – JS Campinense
 * pages/Equipas.jsx – Public listing of all teams
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { equipas as equipasApi } from '../api/index.js'

export default function Equipas() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    equipasApi.getAll()
      .then(setData)
      .catch(() => setError('Erro ao carregar equipas.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <section className="hero">
        <div className="container hero__content">
          <p className="hero__subtitle">JS Campinense – Loulé</p>
          <h1 className="hero__title">
            <span>Equipas</span>
          </h1>
          <p className="hero__desc">Todas as equipas registadas no sistema.</p>
        </div>
      </section>

      <div className="page">
        <div className="container">
          {loading && (
            <div className="spinner-wrap"><div className="spinner" /> A carregar…</div>
          )}
          {error && <div className="alert alert--error">{error}</div>}
          {!loading && !error && data.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">👥</div>
              <p className="empty-state__text">Nenhuma equipa registada.</p>
            </div>
          )}
          {!loading && !error && data.length > 0 && (
            <div className="grid grid--4">
              {data.map(equipa => (
                <Link key={equipa.id} to={`/equipa/${equipa.id}`} className="equipa-card">
                  <div className="equipa-card__brasao">{equipa.brasao || '⚽'}</div>
                  <div className="equipa-card__nome">{equipa.nome}</div>
                  <div className="equipa-card__meta">
                    {equipa.num_jogadores} {equipa.num_jogadores === 1 ? 'jogador' : 'jogadores'}
                  </div>
                  <div style={{
                    width: '2rem', height: '4px', borderRadius: '2px',
                    background: equipa.cor_principal || 'var(--yellow)', marginTop: '0.25rem',
                  }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
