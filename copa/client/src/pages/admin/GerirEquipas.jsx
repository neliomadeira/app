/**
 * Copa Fácil – JS Campinense
 * pages/admin/GerirEquipas.jsx – Admin team management
 *
 * Features:
 *  - List all teams with player count, edit/delete
 *  - Modal to create/edit team: nome, brasao, cor_principal
 *  - Expandable section per team to list/add/edit/delete players
 *  - Player form: nome, numero, posicao
 */

import React, { useEffect, useState } from 'react'
import { equipas as equipasApi } from '../../api/index.js'
import { AdminSidebar } from './Dashboard.jsx'

const POSICOES = ['GR', 'DD', 'DC', 'DE', 'MCD', 'MC', 'MCO', 'ED', 'EE', 'PL', 'AV']

const BRASAO_OPTIONS = ['⚽', '🏆', '🔴', '🔵', '🟡', '⚫', '🟢', '🟠', '🏅', '⭐', '🦅', '🐉']

const EMPTY_EQUIPA = { nome: '', brasao: '⚽', cor_principal: '#003B8E' }
const EMPTY_JOGADOR = { nome: '', numero: '', posicao: 'AV' }

// ── Team modal ────────────────────────────────────────────────────────────────
function EquipaModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? {
    nome: initial.nome || '',
    brasao: initial.brasao || '⚽',
    cor_principal: initial.cor_principal || '#003B8E',
  } : EMPTY_EQUIPA)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial?.id

  const change = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nome.trim()) { setErrors({ nome: 'Nome é obrigatório.' }); return }
    setSaving(true)
    try {
      let saved
      if (isEdit) {
        saved = await equipasApi.update(initial.id, form)
      } else {
        saved = await equipasApi.create(form)
      }
      onSave(saved)
    } catch (err) {
      setErrors({ _global: err.response?.data?.error || 'Erro ao guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">{isEdit ? 'Editar' : 'Nova'} Equipa</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <div className="modal__body">
          {errors._global && <div className="alert alert--error">{errors._global}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nome da Equipa *</label>
              <input name="nome" className="form-control" value={form.nome} onChange={change} placeholder="ex: JS Campinense" />
              {errors.nome && <div className="form-error">{errors.nome}</div>}
            </div>

            <div className="form-group">
              <label>Brasão (emoji)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                {BRASAO_OPTIONS.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, brasao: b }))}
                    style={{
                      fontSize: '1.4rem',
                      background: form.brasao === b ? 'rgba(255,209,0,0.2)' : 'var(--gray-dark)',
                      border: form.brasao === b ? '2px solid var(--yellow)' : '2px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '0.3rem 0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <input name="brasao" className="form-control" value={form.brasao} onChange={change} placeholder="Ou escreva um emoji" style={{ maxWidth: '200px' }} />
            </div>

            <div className="form-group">
              <label>Cor Principal</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="color" name="cor_principal" value={form.cor_principal} onChange={change}
                  style={{ width: '3rem', height: '2.5rem', padding: '0.2rem', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }} />
                <input type="text" name="cor_principal" className="form-control" value={form.cor_principal} onChange={change}
                  placeholder="#003B8E" style={{ maxWidth: '140px' }} />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'A guardar…' : isEdit ? 'Guardar Alterações' : 'Criar Equipa'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Player form (inline) ──────────────────────────────────────────────────────
function JogadorForm({ equipaId, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial
    ? { nome: initial.nome, numero: initial.numero ?? '', posicao: initial.posicao || 'AV' }
    : EMPTY_JOGADOR
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const isEdit = !!initial?.id

  const change = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nome.trim()) { setError('Nome é obrigatório.'); return }
    setSaving(true)
    try {
      let saved
      if (isEdit) {
        saved = await equipasApi.updateJogador(equipaId, initial.id, {
          nome: form.nome,
          numero: form.numero ? Number(form.numero) : null,
          posicao: form.posicao,
        })
      } else {
        saved = await equipasApi.addJogador(equipaId, {
          nome: form.nome,
          numero: form.numero ? Number(form.numero) : null,
          posicao: form.posicao,
        })
      }
      onSave(saved)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao guardar jogador.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--gray-dark)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1rem',
        marginBottom: '0.5rem',
      }}
    >
      {error && <div className="form-error" style={{ marginBottom: '0.5rem' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px', gap: '0.5rem', alignItems: 'end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Nome</label>
          <input name="nome" className="form-control" value={form.nome} onChange={change} placeholder="Nome do jogador" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Nº</label>
          <input name="numero" type="number" min="1" max="99" className="form-control" value={form.numero} onChange={change} placeholder="–" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Posição</label>
          <select name="posicao" className="form-control" value={form.posicao} onChange={change}>
            {POSICOES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
          {saving ? '…' : isEdit ? 'Guardar' : 'Adicionar'}
        </button>
      </div>
    </form>
  )
}

// ── Expanded team row with players ────────────────────────────────────────────
function EquipaRow({ equipa: initialEquipa, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [equipa, setEquipa] = useState(initialEquipa)
  const [jogadores, setJogadores] = useState(null)
  const [loadingJ, setLoadingJ] = useState(false)
  const [addingJ, setAddingJ] = useState(false)
  const [editingJ, setEditingJ] = useState(null)
  const [deletingJ, setDeletingJ] = useState(null)

  // Load players when expanded
  useEffect(() => {
    if (expanded && jogadores === null) {
      setLoadingJ(true)
      equipasApi.getById(equipa.id)
        .then(data => setJogadores(data.jogadores || []))
        .finally(() => setLoadingJ(false))
    }
  }, [expanded, equipa.id, jogadores])

  const handleAddJogador = (saved) => {
    setJogadores(prev => [...(prev || []), saved])
    setAddingJ(false)
  }

  const handleEditJogador = (saved) => {
    setJogadores(prev => prev.map(j => j.id === saved.id ? saved : j))
    setEditingJ(null)
  }

  const handleDeleteJogador = async (jogador) => {
    try {
      await equipasApi.deleteJogador(equipa.id, jogador.id)
      setJogadores(prev => prev.filter(j => j.id !== jogador.id))
      setDeletingJ(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao eliminar jogador.')
    }
  }

  return (
    <>
      <tr>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{equipa.brasao || '⚽'}</span>
            <div>
              <div style={{ fontWeight: 600 }}>{equipa.nome}</div>
              <div style={{ fontSize: '0.75rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: equipa.cor_principal || '#003B8E',
                    marginRight: '0.3rem',
                    verticalAlign: 'middle',
                  }}
                />
                <span style={{ color: 'var(--text-muted)' }}>{equipa.cor_principal || '#003B8E'}</span>
              </div>
            </div>
          </div>
        </td>
        <td className="center">{equipa.num_jogadores ?? (jogadores ? jogadores.length : '–')}</td>
        <td>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? '▲ Ocultar' : '▼ Jogadores'}
            </button>
            <button className="btn btn--outline btn--sm" onClick={() => onEdit(equipa)}>✏️ Editar</button>
            <button className="btn btn--danger btn--sm" onClick={() => onDelete(equipa)}>🗑</button>
          </div>
        </td>
      </tr>

      {/* Expanded players */}
      {expanded && (
        <tr>
          <td colSpan={3} style={{ padding: '0.5rem 1rem 1rem 1rem', background: 'rgba(0,0,0,0.15)' }}>
            {loadingJ ? (
              <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>A carregar jogadores…</div>
            ) : (
              <>
                {/* Player list */}
                {(jogadores || []).length === 0 && !addingJ ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                    Nenhum jogador. Clique em "Adicionar Jogador" abaixo.
                  </p>
                ) : (
                  <div style={{ marginBottom: '0.5rem' }}>
                    {(jogadores || [])
                      .sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99))
                      .map(j => (
                        <div key={j.id}>
                          {editingJ?.id === j.id ? (
                            <JogadorForm
                              equipaId={equipa.id}
                              initial={j}
                              onSave={handleEditJogador}
                              onCancel={() => setEditingJ(null)}
                            />
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.4rem 0.5rem',
                                borderBottom: '1px solid var(--border)',
                              }}
                            >
                              <div
                                style={{
                                  width: '2rem',
                                  height: '2rem',
                                  background: 'var(--gray-medium)',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontFamily: "'Bebas Neue', sans-serif",
                                  fontSize: '0.9rem',
                                  color: 'var(--yellow)',
                                  flexShrink: 0,
                                }}
                              >
                                {j.numero ?? '–'}
                              </div>
                              <div style={{ flex: 1, fontSize: '0.875rem' }}>
                                <strong>{j.nome}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{j.posicao}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                <button className="btn btn--ghost btn--sm" onClick={() => setEditingJ(j)}>✏️</button>
                                {deletingJ?.id === j.id ? (
                                  <>
                                    <button className="btn btn--danger btn--sm" onClick={() => handleDeleteJogador(j)}>Confirmar</button>
                                    <button className="btn btn--ghost btn--sm" onClick={() => setDeletingJ(null)}>✕</button>
                                  </>
                                ) : (
                                  <button className="btn btn--danger btn--sm" onClick={() => setDeletingJ(j)}>🗑</button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                    ))}
                  </div>
                )}

                {/* Add player form */}
                {addingJ ? (
                  <JogadorForm
                    equipaId={equipa.id}
                    initial={null}
                    onSave={handleAddJogador}
                    onCancel={() => setAddingJ(false)}
                  />
                ) : (
                  <button
                    className="btn btn--outline btn--sm"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => { setAddingJ(true); setEditingJ(null) }}
                  >
                    + Adicionar Jogador
                  </button>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GerirEquipas() {
  const [equipas, setEquipas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const load = () => {
    setLoading(true)
    equipasApi.getAll()
      .then(setEquipas)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showFeedback = (type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleSave = (saved) => {
    setEquipas(prev => {
      const exists = prev.find(e => e.id === saved.id)
      if (exists) return prev.map(e => e.id === saved.id ? { ...e, ...saved } : e)
      return [{ ...saved, num_jogadores: 0 }, ...prev]
    })
    setEditModal(null)
    showFeedback('success', `Equipa "${saved.nome}" guardada.`)
  }

  const handleDelete = async (equipa) => {
    try {
      await equipasApi.delete(equipa.id)
      setEquipas(prev => prev.filter(e => e.id !== equipa.id))
      setDeleteConfirm(null)
      showFeedback('success', `Equipa "${equipa.nome}" eliminada.`)
    } catch (err) {
      showFeedback('error', err.response?.data?.error || 'Erro ao eliminar.')
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span>Gerir</span> Equipas</h1>
          <button className="btn btn--primary" onClick={() => setEditModal({})}>
            + Nova Equipa
          </button>
        </div>

        {feedback && (
          <div className={`alert alert--${feedback.type}`} style={{ marginBottom: '1rem' }}>
            {feedback.text}
          </div>
        )}

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /> A carregar…</div>
        ) : equipas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            <p className="empty-state__text">Nenhuma equipa criada ainda.</p>
            <button className="btn btn--primary" onClick={() => setEditModal({})}>Criar primeira equipa</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Equipa</th>
                  <th className="center">Jogadores</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {equipas.map(equipa => (
                  <EquipaRow
                    key={equipa.id}
                    equipa={equipa}
                    onEdit={e => setEditModal(e)}
                    onDelete={e => setDeleteConfirm(e)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit modal */}
        {editModal !== null && (
          <EquipaModal
            initial={editModal?.id ? editModal : null}
            onSave={handleSave}
            onClose={() => setEditModal(null)}
          />
        )}

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '420px' }}>
              <div className="modal__header">
                <h2 className="modal__title">Confirmar Eliminação</h2>
                <button className="modal__close" onClick={() => setDeleteConfirm(null)}>×</button>
              </div>
              <div className="modal__body">
                <p style={{ marginBottom: '1.5rem' }}>
                  Eliminar <strong>"{deleteConfirm.nome}"</strong>?
                  Todos os jogadores e associações serão eliminados.
                </p>
                <div className="form-actions" style={{ marginTop: 0 }}>
                  <button className="btn btn--ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                  <button className="btn btn--danger" onClick={() => handleDelete(deleteConfirm)}>Eliminar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
