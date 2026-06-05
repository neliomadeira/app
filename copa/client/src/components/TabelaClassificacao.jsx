/**
 * Copa Fácil – JS Campinense
 * components/TabelaClassificacao.jsx – League standings table
 *
 * Props:
 *   classificacao   {Array}  – array from /api/campeonatos/:id/classificacao
 *   equipaDestaque  {number} – optional equipa_id to highlight in the table
 */

import React from 'react'

export default function TabelaClassificacao({ classificacao = [], equipaDestaque }) {
  if (classificacao.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📊</div>
        <p className="empty-state__text">Ainda não há classificação disponível.</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          A classificação será calculada automaticamente após os primeiros jogos terminarem.
        </p>
      </div>
    )
  }

  // Determine zones (top 3 highlighted differently)
  const getZoneClass = (pos) => {
    if (pos <= 1) return 'row--zona-verde'
    if (pos <= 3) return 'row--zona-amarela'
    return ''
  }

  const getPosClass = (pos) => {
    if (pos === 1) return 'pos--1'
    if (pos === 2) return 'pos--2'
    if (pos === 3) return 'pos--3'
    return ''
  }

  return (
    <div className="table-wrap">
      <table className="tabela-classificacao">
        <thead>
          <tr>
            <th className="center" style={{ width: '2.5rem' }}>Pos</th>
            <th>Equipa</th>
            <th className="center hide-mobile">J</th>
            <th className="center hide-mobile">V</th>
            <th className="center hide-mobile">E</th>
            <th className="center hide-mobile">D</th>
            <th className="center hide-mobile">GM</th>
            <th className="center hide-mobile">GS</th>
            <th className="center">DG</th>
            <th className="center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {classificacao.map((equipa, idx) => {
            const pos = idx + 1
            const isDestaque = equipaDestaque && equipa.equipa_id === equipaDestaque
            const rowClass = [
              getZoneClass(pos),
              isDestaque ? 'row--highlight' : '',
            ].filter(Boolean).join(' ')

            return (
              <tr key={equipa.equipa_id} className={rowClass}>
                <td className={`pos ${getPosClass(pos)}`}>
                  {pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos}
                </td>
                <td>
                  <div className="equipa-cell">
                    <span className="equipa-brasao">
                      {equipa.brasao || '⚽'}
                    </span>
                    <span
                      className="equipa-nome"
                      style={isDestaque ? { color: 'var(--yellow)' } : {}}
                    >
                      {equipa.nome}
                    </span>
                  </div>
                </td>
                <td className="center hide-mobile">{equipa.jogos}</td>
                <td className="center hide-mobile">{equipa.vitorias}</td>
                <td className="center hide-mobile">{equipa.empates}</td>
                <td className="center hide-mobile">{equipa.derrotas}</td>
                <td className="center hide-mobile">{equipa.gols_marcados}</td>
                <td className="center hide-mobile">{equipa.gols_sofridos}</td>
                <td className="center">
                  <span style={{ color: equipa.diferenca_golos > 0 ? '#68d391' : equipa.diferenca_golos < 0 ? '#fc8181' : 'inherit' }}>
                    {equipa.diferenca_golos > 0 ? `+${equipa.diferenca_golos}` : equipa.diferenca_golos}
                  </span>
                </td>
                <td className="pts">{equipa.pontos}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
