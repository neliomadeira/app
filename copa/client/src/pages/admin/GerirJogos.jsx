/**
 * Copa Fácil – JS Campinense
 * pages/admin/GerirJogos.jsx – Admin match management
 *
 * Features:
 *  - Dropdown to select campeonato
 *  - List all matches for selected campeonato
 *  - Click match to open inline edit: gols_casa, gols_fora, data_jogo, local, estado
 */

import React, { useEffect, useState } from 'react'
import { campeonatos as campeonatosApi, jogos as jogosApi } from '../../api/index.js'
import { AdminSidebar } from './Dashboard.jsx'
import ListaJogos from '../../components/ListaJogos.jsx'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

// ── Inline result edit form ───────────────────────────────────────────────────
function ResultadoForm({ jogo, onSave, onClose }) {
  const [form, setForm] = useState({
    gols_casa:  jogo.gols_casa >= 0 ? String(jogo.gols_casa) : '',
    gols_fora:  jogo.gols_fora >= 0 ? String(jogo.gols_fora) : '',
    data_jogo:  formatDate(jogo.data_jogo),
    local:      jogo.local || '',
    estado:     jogo.estado,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const change = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const gc = form.gols_casa.trim()
    const gf = form.gols_fora.trim()

    if ((gc !== '' && isNaN(Number(gc))) || (gf !== '' && isNaN(Number(gf)))) {
      setError('Os golos devem ser números válidos.')
      return
    }
    if ((gc !== '' && gf === '') || (gc === '' && gf !== '')) {
      setError('Introduza resultado completo (golos de ambas as equipas).')
      return
    }

    const payload = {
      gols_casa:  gc !== '' ? Number(gc) : -1,
      gols_fora:  gf !== '' ? Number(gf) : -1,
      data_jogo:  form.data_jogo || null,
      local:      form.local || null,
      estado:     form.estado,
    }

    // Auto set to terminado when result is given
    if (payload.gols_casa >= 0 && payload.gols_fora >= 0 && form.estado === 'agendado') {
      payload.estado = 'terminado'
    }

    setSaving(true)
    try {
      const updated = await jogosApi.update(jogo.id, payload)
      onSave(updated)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao guardar resultado.')
    } finally {
      setSaving(false)
    }
  }

  const handleClearResult = async () => {
    setSaving(true)
    try {
      const updated = await jogosApi.update(jogo.id, {
        gols_casa: -1,
        gols_fora: -1,
        estado: 'agendado',
      })
      onSave(updated)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="resultado-form"
      style={{ background: 'var(--gray-medium)', border: '1px solid rgba(255,209,0,0.2)' }}
    >
      {/* Match header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '0.75rem',
          background: 'var(--gray-dark)',
          borderRadius: 'var(--radius)',
          marginBottom: '1rem',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        <span>{jogo.equipa_casa_brasao || '⚽'} {jogo.equipa_casa_nome}</span>
        <span style={{ color: 'var(--text-muted)' }}>vs</span>
        <span>{jogo.equipa_fora_nome} {jogo.equipa_fora_brasao || '⚽'}</span>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: '0.75rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Scores */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '0.5rem',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ textAlign: 'center', display: 'block' }}>
              {jogo.equipa_casa_nome}
            </label>
            <input
              type="number"
              name="gols_casa"
              className="form-control"
              value={form.gols_casa}
              onChange={change}
              min="0"
              max="99"
              placeholder="–"
              style={{ textAlign: 'center', fontSize: '1.5rem', fontFamily: "'Bebas Neue', sans-serif" }}
            />
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'var(--text-muted)', paddingTop: '1.5rem' }}>
            –
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ textAlign: 'center', display: 'block' }}>
              {jogo.equipa_fora_nome}
            </label>
            <input
              type="number"
              name="gols_fora"
              className="form-control"
              value={form.gols_fora}
              onChange={change}
              min="0"
              max="99"
              placeholder="–"
              style={{ textAlign: 'center', fontSize: '1.5rem', fontFamily: "'Bebas Neue', sans-serif" }}
            />
          </div>
        </div>

        {/* Date, local, estado */}
        <div className="form-row" style={{ marginBottom: '0.75rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Data do Jogo</label>
            <input type="date" name="data_jogo" className="form-control" value={form.data_jogo} onChange={change} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Estado</label>
            <select name="estado" className="form-control" value={form.estado} onChange={change}>
              <option value="agendado">Agendado</option>
              <option value="terminado">Terminado</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Local</label>
          <input
            type="text"
            name="local"
            className="form-control"
            value={form.local}
            onChange={change}
            placeholder="ex: Estádio Municipal de Loulé"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleClearResult}
            disabled={saving}
          >
            🗑 Limpar Resultado
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
              {saving ? 'A guardar…' : '✓ Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ── Enhanced jogo list with inline edit ───────────────────────────────────────
function JogosEditList({ jogos, onJogoUpdated }) {
  const [editingId, setEditingId] = useState(null)

  const handleSave = (updated) => {
    onJogoUpdated(updated)
    setEditingId(null)
  }

  if (jogos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">⚽</div>
        <p className="empty-state__text">Nenhum jogo neste campeonato.</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Gere fixtures na página de Campeonatos.
        </p>
      </div>
    )
  }

  // Group by jornada
  const groups = {}
  for (const j of jogos) {
    const key = j.fase
      ? `${j.jornada ?? ''}_${j.fase}`
      : `j_${j.jornada ?? 'sem'}`
    if (!groups[key]) {
      groups[key] = { jornada: j.jornada, fase: j.fase, jogos: [] }
    }
    groups[key].jogos.push(j)
  }
  const groupArr = Object.values(groups)

  return (
    <div>
      {groupArr.map((group, gi) => {
        const label = group.fase
          ? group.fase
          : group.jornada != null ? `Jornada ${group.jornada}` : 'Jogos'

        return (
          <div key={gi} className="jornada-group">
            <div className="jornada-label">⚽ {label}</div>

            {group.jogos.map(jogo => {
              const isEditing = editingId === jogo.id
              const hasResult = jogo.gols_casa >= 0 && jogo.gols_fora >= 0

              return (
                <div key={jogo.id} style={{ marginBottom: '0.5rem' }}>
                  {/* Jogo row */}
                  <div
                    className="jogo-item clickable"
                    onClick={() => setEditingId(isEditing ? null : jogo.id)}
                    style={{ borderColor: isEditing ? 'rgba(255,209,0,0.3)' : undefined }}
                  >
                    <div className="jogo-equipa">
                      <span className="jogo-equipa__brasao">{jogo.equipa_casa_brasao || '⚽'}</span>
                      <span className="jogo-equipa__nome">{jogo.equipa_casa_nome}</span>
                    </div>
                    <div className="jogo-resultado">
                      {hasResult ? (
                        <div className="jogo-placar">{jogo.gols_casa} – {jogo.gols_fora}</div>
                      ) : (
                        <div className="jogo-vs">VS</div>
                      )}
                      {jogo.data_jogo && (
                        <div className="jogo-data">
                          {new Date(jogo.data_jogo).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                      <div style={{ marginTop: '0.2rem' }}>
                        <span className={`badge ${jogo.estado === 'terminado' ? 'badge--green' : 'badge--gray'}`}>
                          {jogo.estado === 'terminado' ? 'Terminado' : 'Agendado'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--yellow)', marginTop: '0.2rem' }}>
                        {isEditing ? '▲ Fechar' : '✏️ Editar'}
                      </div>
                    </div>
                    <div className="jogo-equipa jogo-equipa--fora">
                      <span className="jogo-equipa__brasao">{jogo.equipa_fora_brasao || '⚽'}</span>
                      <span className="jogo-equipa__nome">{jogo.equipa_fora_nome}</span>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isEditing && (
                    <ResultadoForm
                      jogo={jogo}
                      onSave={handleSave}
                      onClose={() => setEditingId(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GerirJogos() {
  const [allCampeonatos, setAllCampeonatos] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [jogos, setJogos] = useState([])
  const [loadingCamps, setLoadingCamps] = useState(true)
  const [loadingJogos, setLoadingJogos] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Load campeonatos
  useEffect(() => {
    campeonatosApi.getAll()
      .then(data => {
        setAllCampeonatos(data)
        if (data.length > 0) setSelectedId(String(data[0].id))
      })
      .finally(() => setLoadingCamps(false))
  }, [])

  // Load jogos when campeonato changes
  useEffect(() => {
    if (!selectedId) { setJogos([]); return }
    setLoadingJogos(true)
    campeonatosApi.getJogos(selectedId)
      .then(setJogos)
      .catch(() => setJogos([]))
      .finally(() => setLoadingJogos(false))
  }, [selectedId])

  const handleJogoUpdated = (updated) => {
    setJogos(prev => prev.map(j => j.id === updated.id ? { ...j, ...updated } : j))
    setFeedback({ type: 'success', text: 'Resultado guardado com sucesso.' })
    setTimeout(() => setFeedback(null), 3000)
  }

  const selectedCamp = allCampeonatos.find(c => String(c.id) === selectedId)

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span>Gerir</span> Jogos</h1>
        </div>

        {feedback && (
          <div className={`alert alert--${feedback.type}`} style={{ marginBottom: '1rem' }}>
            {feedback.text}
          </div>
        )}

        {/* Campeonato selector */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '220px' }}>
              <label>Campeonato</label>
              {loadingCamps ? (
                <div className="form-control" style={{ color: 'var(--text-muted)' }}>A carregar…</div>
              ) : (
                <select
                  className="form-control"
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                >
                  {allCampeonatos.length === 0 && (
                    <option value="">Nenhum campeonato disponível</option>
                  )}
                  {allCampeonatos.map(c => (
                    <option key={c.id} value={String(c.id)}>
                      {c.nome} ({c.epoca})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedCamp && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '1.2rem' }}>
                <span className={`badge ${selectedCamp.estado === 'em_curso' ? 'badge--green' : selectedCamp.estado === 'terminado' ? 'badge--gray' : 'badge--blue'}`}>
                  {selectedCamp.estado === 'em_curso' ? 'Em Curso' : selectedCamp.estado === 'terminado' ? 'Terminado' : 'Por Iniciar'}
                </span>
                <span className="badge badge--yellow">{selectedCamp.modalidade}</span>
                <span className="badge badge--gray">{jogos.length} jogos</span>
              </div>
            )}
          </div>
        </div>

        {/* Jogos list */}
        {loadingJogos ? (
          <div className="spinner-wrap"><div className="spinner" /> A carregar jogos…</div>
        ) : !selectedId ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚽</div>
            <p className="empty-state__text">Selecione um campeonato acima.</p>
          </div>
        ) : (
          <>
            <div className="alert alert--info" style={{ marginBottom: '1rem', fontSize: '0.83rem' }}>
              Clique num jogo para editar o resultado, data e local.
            </div>
            <JogosEditList jogos={jogos} onJogoUpdated={handleJogoUpdated} />
          </>
        )}
      </main>
    </div>
  )
}
