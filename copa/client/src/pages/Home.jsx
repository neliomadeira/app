/**
 * Copa Fácil – JS Campinense
 * pages/Home.jsx – Public page listing all championships
 *
 * Features:
 *  - Hero header with JS Campinense branding
 *  - Filter by status: todos, em_curso, por_iniciar, terminado
 *  - Grid of championship cards
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { campeonatos as campeonatosApi } from '../api/index.js'

const ESTADO_LABELS = {
  em_curso:    { label: 'Em Curso',    badgeClass: 'badge--green'  },
  por_iniciar: { label: 'Por Iniciar', badgeClass: 'badge--blue'   },
  terminado:   { label: 'Terminado',   badgeClass: 'badge--gray'   },
}

const FORMATO_LABELS = {
  liga:           'Liga',
  eliminatorias:  'Eliminatórias',
  grupos:         'Grupos',
}

const FILTER_OPTIONS = [
  { value: 'todos',       label: 'Todos' },
  { value: 'em_curso',    label: 'Em Curso' },
  { value: 'por_iniciar', label: 'Por Iniciar' },
  { value: 'terminado',   label: 'Terminados' },
]

function CampeonatoCard({ c }) {
  const estado = ESTADO_LABELS[c.estado] || { label: c.estado, badgeClass: 'badge--gray' }

  return (
    <Link to={`/campeonato/${c.id}`} className="campeonato-card">
      <div className={`campeonato-card__top campeonato-card__top--${c.estado}`} />
      <div className="campeonato-card__body">
        <div className="campeonato-card__header">
          <div>
            <div className="campeonato-card__nome">{c.nome}</div>
            <div className="campeonato-card__meta">
              <span className={`badge ${estado.badgeClass}`}>{estado.label}</span>
              <span className="badge badge--yellow">{FORMATO_LABELS[c.formato] || c.formato}</span>
              <span className="badge badge--blue">{c.modalidade}</span>
            </div>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            {c.epoca}
          </span>
        </div>

        {c.descricao && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            {c.descricao.length > 100 ? c.descricao.slice(0, 100) + '…' : c.descricao}
          </p>
        )}

        <div className="campeonato-card__stats">
          <div className="campeonato-card__stat">
            <span>👥</span>
            <span>{c.num_equipas} {c.num_equipas === 1 ? 'equipa' : 'equipas'}</span>
          </div>
          <div className="campeonato-card__stat">
            <span>⚽</span>
            <span>{c.num_jogos} {c.num_jogos === 1 ? 'jogo' : 'jogos'}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function Home() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('todos')

  useEffect(() => {
    campeonatosApi.getAll()
      .then(setData)
      .catch(err => setError('Erro ao carregar campeonatos.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'todos'
    ? data
    : data.filter(c => c.estado === filter)

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="container hero__content">
          <p className="hero__subtitle">Juventude Sport Campinense – Loulé</p>
          <h1 className="hero__title">
            Copa <span>Fácil</span>
          </h1>
          <p className="hero__desc">
            Gestão de campeonatos, classificações e resultados do JS Campinense e parceiros.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="page">
        <div className="container">
          {/* Filter bar */}
          <div className="filter-bar" style={{ marginTop: '1.5rem' }}>
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`filter-btn${filter === opt.value ? ' active' : ''}`}
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* States */}
          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              A carregar campeonatos...
            </div>
          )}

          {error && (
            <div className="alert alert--error">{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">🏆</div>
              <p className="empty-state__text">
                {filter === 'todos'
                  ? 'Não há campeonatos criados ainda.'
                  : `Não há campeonatos com o estado "${FILTER_OPTIONS.find(o => o.value === filter)?.label}".`}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                {filtered.length} {filtered.length === 1 ? 'campeonato encontrado' : 'campeonatos encontrados'}
              </p>
              <div className="grid grid--3">
                {filtered.map(c => (
                  <CampeonatoCard key={c.id} c={c} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
