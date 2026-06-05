/**
 * Copa Fácil – JS Campinense
 * pages/Equipa.jsx – Public team detail page
 *
 * Shows:
 *  - Team header with name, colours, brasao
 *  - Player list with number, name, position
 */

import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { equipas as equipasApi } from '../api/index.js'

const POSICAO_LABELS = {
  GR:  'Guarda-Redes',
  DD:  'Defesa Direito',
  DC:  'Defesa Central',
  DE:  'Defesa Esquerdo',
  MCD: 'Médio Defensivo',
  MC:  'Médio Centro',
  MCO: 'Médio Ofensivo',
  ED:  'Extremo Direito',
  EE:  'Extremo Esquerdo',
  PL:  'Ponta de Lança',
  AV:  'Avançado',
}

const POSICAO_CORES = {
  GR:  '#e2b96c',
  DD:  '#68d391',
  DC:  '#68d391',
  DE:  '#68d391',
  MCD: '#90cdf4',
  MC:  '#90cdf4',
  MCO: '#90cdf4',
  ED:  '#fc8181',
  EE:  '#fc8181',
  PL:  '#FFD100',
  AV:  '#FFD100',
}

function groupByPosition(jogadores) {
  const groups = {
    'Guarda-Redes':    [],
    'Defesas':         [],
    'Médios':          [],
    'Avançados':       [],
  }
  for (const j of jogadores) {
    if (j.posicao === 'GR') {
      groups['Guarda-Redes'].push(j)
    } else if (['DD', 'DC', 'DE'].includes(j.posicao)) {
      groups['Defesas'].push(j)
    } else if (['MCD', 'MC', 'MCO'].includes(j.posicao)) {
      groups['Médios'].push(j)
    } else {
      groups['Avançados'].push(j)
    }
  }
  return groups
}

export default function Equipa() {
  const { id } = useParams()
  const [equipa, setEquipa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    equipasApi.getById(id)
      .then(setEquipa)
      .catch(() => setError('Equipa não encontrada.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ marginTop: '4rem' }}>
        <div className="spinner" />
        A carregar equipa...
      </div>
    )
  }

  if (error || !equipa) {
    return (
      <div className="container page">
        <div className="alert alert--error">{error || 'Equipa não encontrada.'}</div>
        <Link to="/" className="btn btn--ghost" style={{ marginTop: '1rem' }}>← Voltar</Link>
      </div>
    )
  }

  const jogadores = equipa.jogadores || []
  const groups = groupByPosition(jogadores)

  return (
    <div>
      {/* Hero */}
      <section className="hero" style={{ background: `linear-gradient(135deg, ${equipa.cor_principal || '#003B8E'} 0%, var(--gray-dark) 60%)` }}>
        <div className="container hero__content">
          <div style={{ marginBottom: '0.5rem' }}>
            <Link to="/" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none' }}>
              ← Campeonatos
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ fontSize: '4rem', lineHeight: 1 }}>{equipa.brasao || '⚽'}</div>
            <div>
              <h1 className="hero__title" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', marginBottom: '0.25rem' }}>
                {equipa.nome}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '50%',
                  background: equipa.cor_principal || '#003B8E',
                  border: '2px solid rgba(255,255,255,0.3)',
                }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {jogadores.length} {jogadores.length === 1 ? 'jogador' : 'jogadores'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Players */}
      <div className="container page">
        {jogadores.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👤</div>
            <p className="empty-state__text">Nenhum jogador registado nesta equipa.</p>
          </div>
        ) : (
          <div className="grid grid--2">
            {Object.entries(groups).map(([groupName, players]) => {
              if (players.length === 0) return null
              return (
                <div key={groupName} className="card">
                  <div className="card__header">
                    <h3 className="card__title" style={{ fontSize: '1.1rem' }}>{groupName}</h3>
                    <span className="badge badge--gray">{players.length}</span>
                  </div>
                  <div className="card__body" style={{ padding: '0.5rem 1.25rem' }}>
                    {players
                      .sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99))
                      .map(jogador => (
                        <div key={jogador.id} className="jogador-row">
                          <div className="jogador-numero">
                            {jogador.numero ?? '–'}
                          </div>
                          <div className="jogador-info">
                            <div className="jogador-nome">{jogador.nome}</div>
                            <div className="jogador-posicao" style={{ color: POSICAO_CORES[jogador.posicao] || 'var(--text-muted)' }}>
                              {jogador.posicao} · {POSICAO_LABELS[jogador.posicao] || jogador.posicao || '–'}
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
