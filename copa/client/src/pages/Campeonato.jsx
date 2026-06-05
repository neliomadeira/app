/**
 * Copa Fácil – JS Campinense
 * pages/Campeonato.jsx – Public championship detail page
 *
 * Three tabs:
 *   1. Classificação – TabelaClassificacao component
 *   2. Jogos/Resultados – ListaJogos grouped by jornada
 *   3. Equipas – Grid of team cards
 */

import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { campeonatos as campeonatosApi } from '../api/index.js'
import TabelaClassificacao from '../components/TabelaClassificacao.jsx'
import ListaJogos from '../components/ListaJogos.jsx'

const TABS = [
  { id: 'classificacao', label: '📊 Classificação' },
  { id: 'jogos',         label: '⚽ Jogos / Resultados' },
  { id: 'equipas',       label: '👥 Equipas' },
]

const ESTADO_LABELS = {
  em_curso:    { label: 'Em Curso',    badgeClass: 'badge--green' },
  por_iniciar: { label: 'Por Iniciar', badgeClass: 'badge--blue'  },
  terminado:   { label: 'Terminado',   badgeClass: 'badge--gray'  },
}

const FORMATO_LABELS = {
  liga:           'Liga',
  eliminatorias:  'Eliminatórias',
  grupos:         'Grupos',
}

export default function Campeonato() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('classificacao')

  const [campeonato, setCampeonato] = useState(null)
  const [classificacao, setClassificacao] = useState([])
  const [jogosList, setJogosList] = useState([])
  const [equipasList, setEquipasList] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      campeonatosApi.getById(id),
      campeonatosApi.getClassificacao(id),
      campeonatosApi.getJogos(id),
      campeonatosApi.getEquipas(id),
    ])
      .then(([c, cls, jgs, eqs]) => {
        setCampeonato(c)
        setClassificacao(cls)
        setJogosList(jgs)
        setEquipasList(eqs)
      })
      .catch(() => setError('Erro ao carregar campeonato.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ marginTop: '4rem' }}>
        <div className="spinner" />
        A carregar...
      </div>
    )
  }

  if (error || !campeonato) {
    return (
      <div className="container page">
        <div className="alert alert--error">{error || 'Campeonato não encontrado.'}</div>
        <Link to="/" className="btn btn--ghost">← Voltar</Link>
      </div>
    )
  }

  const estadoInfo = ESTADO_LABELS[campeonato.estado] || { label: campeonato.estado, badgeClass: 'badge--gray' }

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="container hero__content">
          <div style={{ marginBottom: '0.5rem' }}>
            <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
              ← Campeonatos
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`badge ${estadoInfo.badgeClass}`}>{estadoInfo.label}</span>
                <span className="badge badge--yellow">{FORMATO_LABELS[campeonato.formato] || campeonato.formato}</span>
                <span className="badge badge--blue">{campeonato.modalidade}</span>
              </div>
              <h1 className="hero__title" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '0.4rem' }}>
                {campeonato.nome}
              </h1>
              {campeonato.descricao && (
                <p className="hero__desc">{campeonato.descricao}</p>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '2rem', lineHeight: 1, marginBottom: '0.25rem' }}>🏆</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Época {campeonato.epoca}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {campeonato.num_equipas} equipas · {campeonato.num_jogos} jogos
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="container" style={{ marginTop: '1.5rem' }}>
        <div className="tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Classificação */}
        {activeTab === 'classificacao' && (
          <div>
            {campeonato.formato === 'eliminatorias' ? (
              <div className="alert alert--info">
                Este campeonato usa formato eliminatório — a classificação por pontos não é aplicável. Consulte os jogos/resultados.
              </div>
            ) : (
              <TabelaClassificacao classificacao={classificacao} />
            )}
          </div>
        )}

        {/* Tab: Jogos */}
        {activeTab === 'jogos' && (
          <ListaJogos jogos={jogosList} />
        )}

        {/* Tab: Equipas */}
        {activeTab === 'equipas' && (
          <div>
            {equipasList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">👥</div>
                <p className="empty-state__text">Nenhuma equipa inscrita neste campeonato.</p>
              </div>
            ) : (
              <div className="grid grid--4" style={{ paddingBottom: '2rem' }}>
                {equipasList.map(equipa => (
                  <Link key={equipa.id} to={`/equipa/${equipa.id}`} className="equipa-card">
                    <div className="equipa-card__brasao">{equipa.brasao || '⚽'}</div>
                    <div className="equipa-card__nome">{equipa.nome}</div>
                    <div className="equipa-card__meta">
                      {equipa.num_jogadores} {equipa.num_jogadores === 1 ? 'jogador' : 'jogadores'}
                    </div>
                    <div
                      style={{
                        width: '2rem',
                        height: '4px',
                        borderRadius: '2px',
                        background: equipa.cor_principal || 'var(--yellow)',
                        marginTop: '0.25rem',
                      }}
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
