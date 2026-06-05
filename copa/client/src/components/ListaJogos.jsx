/**
 * Copa Fácil – JS Campinense
 * components/ListaJogos.jsx – Match list grouped by jornada
 *
 * Props:
 *   jogos          {Array}    – array of match objects from API
 *   onResultClick  {Function} – optional callback(jogo) for admin inline edit
 */

import React from 'react'

// Format date to pt-PT locale
function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

// Group matches by jornada (or fase)
function groupByJornada(jogos) {
  const groups = {}
  for (const jogo of jogos) {
    const key = jogo.fase
      ? `${jogo.jornada ?? ''}_${jogo.fase}`
      : `jornada_${jogo.jornada ?? 'sem-jornada'}`
    if (!groups[key]) {
      groups[key] = { jornada: jogo.jornada, fase: jogo.fase, jogos: [] }
    }
    groups[key].jogos.push(jogo)
  }
  return Object.values(groups)
}

function JogoEstadoBadge({ estado }) {
  if (estado === 'terminado') return <span className="badge badge--green">Terminado</span>
  return <span className="badge badge--gray">Agendado</span>
}

export default function ListaJogos({ jogos = [], onResultClick }) {
  if (jogos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">⚽</div>
        <p className="empty-state__text">Ainda não há jogos agendados.</p>
      </div>
    )
  }

  const groups = groupByJornada(jogos)

  return (
    <div>
      {groups.map((group, gi) => {
        const label = group.fase
          ? group.fase
          : group.jornada != null
            ? `Jornada ${group.jornada}`
            : 'Jogos'

        return (
          <div key={gi} className="jornada-group">
            <div className="jornada-label">
              <span>⚽</span>
              {label}
            </div>

            {group.jogos.map((jogo) => {
              const hasResult = jogo.gols_casa >= 0 && jogo.gols_fora >= 0
              const clickable = !!onResultClick

              return (
                <div
                  key={jogo.id}
                  className={`jogo-item${clickable ? ' clickable' : ''}`}
                  onClick={clickable ? () => onResultClick(jogo) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? (e) => e.key === 'Enter' && onResultClick(jogo) : undefined}
                >
                  {/* Casa */}
                  <div className="jogo-equipa">
                    <span className="jogo-equipa__brasao">{jogo.equipa_casa_brasao || '⚽'}</span>
                    <span className="jogo-equipa__nome">{jogo.equipa_casa_nome}</span>
                  </div>

                  {/* Result / VS */}
                  <div className="jogo-resultado">
                    {hasResult ? (
                      <div className="jogo-placar">
                        {jogo.gols_casa} – {jogo.gols_fora}
                      </div>
                    ) : (
                      <div className="jogo-vs">VS</div>
                    )}
                    {jogo.data_jogo && (
                      <div className="jogo-data">{formatDate(jogo.data_jogo)}</div>
                    )}
                    <div style={{ marginTop: '0.3rem' }}>
                      <JogoEstadoBadge estado={jogo.estado} />
                    </div>
                    {clickable && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Clique para editar
                      </div>
                    )}
                  </div>

                  {/* Fora */}
                  <div className="jogo-equipa jogo-equipa--fora">
                    <span className="jogo-equipa__brasao">{jogo.equipa_fora_brasao || '⚽'}</span>
                    <span className="jogo-equipa__nome">{jogo.equipa_fora_nome}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
