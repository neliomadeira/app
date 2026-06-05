/**
 * Copa Fácil – JS Campinense
 * pages/admin/GerirCampeonatos.jsx – Admin campeonato management
 *
 * Features:
 *  - List all campeonatos with edit/delete
 *  - Create/edit modal with: nome, modalidade, formato, epoca, descricao, estado
 *  - Manage teams per campeonato (add/remove)
 *  - Generate round-robin fixtures button
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { campeonatos as campeonatosApi, equipas as equipasApi } from '../../api/index.js'
import { AdminSidebar } from './Dashboard.jsx'

const MODALIDADES = ['Futebol 11', 'Futsal', 'Futebol 7', 'Futebol 5']
const FORMATOS    = [
  { value: 'liga',          label: 'Liga' },
  { value: 'eliminatorias', label: 'Eliminatórias' },
  { value: 'grupos',        label: 'Grupos' },
]
const ESTADOS = [
  { value: 'por_iniciar', label: 'Por Iniciar' },
  { value: 'em_curso',    label: 'Em Curso' },
  { value: 'terminado',   label: 'Terminado' },
]
const ESTADO_BADGE = {
  em_curso:    'badge--green',
  por_iniciar: 'badge--blue',
  terminado:   'badge--gray',
}
const ESTADO_LABEL = {
  em_curso:    'Em Curso',
  por_iniciar: 'Por Iniciar',
  terminado:   'Terminado',
}

const EMPTY_FORM = {
  nome: '', modalidade: 'Futebol 11', formato: 'liga',
  epoca: new Date().getFullYear().toString(), descricao: '', estado: 'por_iniciar',
}

// ── Modal: create/edit campeonato ─────────────────────────────────────────────
function CampeonatoModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial?.id

  const change = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: null }))
  }

  const validate = () => {
    const errs = {}
    if (!form.nome.trim()) errs.nome = 'Nome é obrigatório'
    if (!form.epoca.trim()) errs.epoca = 'Época é obrigatória'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      let saved
      if (isEdit) {
        saved = await campeonatosApi.update(initial.id, form)
      } else {
        saved = await campeonatosApi.create(form)
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
          <h2 className="modal__title">{isEdit ? 'Editar' : 'Novo'} Campeonato</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <div className="modal__body">
          {errors._global && <div className="alert alert--error">{errors._global}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nome *</label>
              <input name="nome" className="form-control" value={form.nome} onChange={change} placeholder="ex: Torneio de Verão 2025" />
              {errors.nome && <div className="form-error">{errors.nome}</div>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Época *</label>
                <input name="epoca" className="form-control" value={form.epoca} onChange={change} placeholder="ex: 2025" />
                {errors.epoca && <div className="form-error">{errors.epoca}</div>}
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select name="estado" className="form-control" value={form.estado} onChange={change}>
                  {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Modalidade</label>
                <select name="modalidade" className="form-control" value={form.modalidade} onChange={change}>
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Formato</label>
                <select name="formato" className="form-control" value={form.formato} onChange={change}>
                  {FORMATOS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea name="descricao" className="form-control" value={form.descricao} onChange={change} placeholder="Breve descrição do campeonato..." />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'A guardar…' : isEdit ? 'Guardar Alterações' : 'Criar Campeonato'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Modal: manage teams in campeonato ─────────────────────────────────────────
function EquipasModal({ campeonato, onClose }) {
  const [allEquipas, setAllEquipas] = useState([])
  const [inscritasIds, setInscritasIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [fixtureMsg, setFixtureMsg] = useState(null)
  const [generatingFixtures, setGeneratingFixtures] = useState(false)

  useEffect(() => {
    Promise.all([
      equipasApi.getAll(),
      campeonatosApi.getEquipas(campeonato.id),
    ]).then(([all, inscritas]) => {
      setAllEquipas(all)
      setInscritasIds(new Set(inscritas.map(e => e.id)))
    }).finally(() => setLoading(false))
  }, [campeonato.id])

  const toggle = async (equipaId, isIn) => {
    setMessage(null)
    try {
      if (isIn) {
        await campeonatosApi.removeEquipa(campeonato.id, equipaId)
        setInscritasIds(prev => { const s = new Set(prev); s.delete(equipaId); return s })
        setMessage({ type: 'success', text: 'Equipa removida.' })
      } else {
        await campeonatosApi.addEquipa(campeonato.id, equipaId)
        setInscritasIds(prev => new Set([...prev, equipaId]))
        setMessage({ type: 'success', text: 'Equipa adicionada.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro.' })
    }
  }

  const handleGerarFixtures = async () => {
    if (!window.confirm(`Gerar jogos round-robin para "${campeonato.nome}"? Os jogos existentes serão eliminados.`)) return
    setGeneratingFixtures(true)
    setFixtureMsg(null)
    try {
      const res = await campeonatosApi.gerarFixtures(campeonato.id)
      setFixtureMsg({ type: 'success', text: res.message })
    } catch (err) {
      setFixtureMsg({ type: 'error', text: err.response?.data?.error || 'Erro ao gerar fixtures.' })
    } finally {
      setGeneratingFixtures(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--lg">
        <div className="modal__header">
          <h2 className="modal__title">Equipas – {campeonato.nome}</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <div className="modal__body">
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : (
            <>
              {message && (
                <div className={`alert alert--${message.type}`} style={{ marginBottom: '1rem' }}>
                  {message.text}
                </div>
              )}

              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Selecione as equipas que participam neste campeonato:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {allEquipas.map(equipa => {
                  const isIn = inscritasIds.has(equipa.id)
                  return (
                    <div
                      key={equipa.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: isIn ? 'rgba(56,161,105,0.08)' : 'var(--gray-dark)',
                        border: `1px solid ${isIn ? 'rgba(56,161,105,0.25)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>{equipa.brasao || '⚽'}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{equipa.nome}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {equipa.num_jogadores} jogadores
                          </div>
                        </div>
                      </div>
                      <button
                        className={`btn btn--sm ${isIn ? 'btn--danger' : 'btn--primary'}`}
                        onClick={() => toggle(equipa.id, isIn)}
                      >
                        {isIn ? 'Remover' : 'Adicionar'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Generate fixtures section */}
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1.25rem',
                }}
              >
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
                    Gerar Calendário
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Gera jogos round-robin para as {inscritasIds.size} equipas inscritas.
                    Os jogos existentes serão eliminados.
                  </p>
                </div>
                {fixtureMsg && (
                  <div className={`alert alert--${fixtureMsg.type}`} style={{ marginBottom: '0.75rem' }}>
                    {fixtureMsg.text}
                  </div>
                )}
                <button
                  className="btn btn--blue"
                  onClick={handleGerarFixtures}
                  disabled={generatingFixtures || inscritasIds.size < 2}
                >
                  {generatingFixtures ? 'A gerar…' : '⚽ Gerar Fixtures Round-Robin'}
                </button>
                {inscritasIds.size < 2 && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Necessário pelo menos 2 equipas inscritas.
                  </p>
                )}
              </div>

              <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                <button className="btn btn--ghost" onClick={onClose}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GerirCampeonatos() {
  const [campeonatos, setCampeonatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(null)   // null | {} | campeonato object
  const [equipasModal, setEquipasModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const load = () => {
    setLoading(true)
    campeonatosApi.getAll()
      .then(setCampeonatos)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSave = (saved) => {
    setCampeonatos(prev => {
      const exists = prev.find(c => c.id === saved.id)
      if (exists) return prev.map(c => c.id === saved.id ? { ...saved, num_equipas: c.num_equipas, num_jogos: c.num_jogos } : c)
      return [{ ...saved, num_equipas: 0, num_jogos: 0 }, ...prev]
    })
    setEditModal(null)
    setFeedback({ type: 'success', text: `Campeonato "${saved.nome}" guardado com sucesso.` })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleDelete = async (c) => {
    try {
      await campeonatosApi.delete(c.id)
      setCampeonatos(prev => prev.filter(x => x.id !== c.id))
      setDeleteConfirm(null)
      setFeedback({ type: 'success', text: `Campeonato "${c.nome}" eliminado.` })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Erro ao eliminar.' })
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span>Gerir</span> Campeonatos</h1>
          <button className="btn btn--primary" onClick={() => setEditModal({})}>
            + Novo Campeonato
          </button>
        </div>

        {feedback && (
          <div className={`alert alert--${feedback.type}`} style={{ marginBottom: '1rem' }}>
            {feedback.text}
          </div>
        )}

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /> A carregar…</div>
        ) : campeonatos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏆</div>
            <p className="empty-state__text">Nenhum campeonato criado ainda.</p>
            <button className="btn btn--primary" onClick={() => setEditModal({})}>Criar primeiro campeonato</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Modalidade</th>
                  <th>Formato</th>
                  <th>Época</th>
                  <th>Estado</th>
                  <th className="center">Equipas</th>
                  <th className="center">Jogos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campeonatos.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.nome}</div>
                      {c.descricao && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {c.descricao.slice(0, 60)}{c.descricao.length > 60 ? '…' : ''}
                        </div>
                      )}
                    </td>
                    <td>{c.modalidade}</td>
                    <td>
                      {c.formato === 'liga' ? 'Liga' : c.formato === 'eliminatorias' ? 'Eliminatórias' : 'Grupos'}
                    </td>
                    <td>{c.epoca}</td>
                    <td>
                      <span className={`badge ${ESTADO_BADGE[c.estado] || 'badge--gray'}`}>
                        {ESTADO_LABEL[c.estado] || c.estado}
                      </span>
                    </td>
                    <td className="center">{c.num_equipas}</td>
                    <td className="center">{c.num_jogos}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <Link to={`/campeonato/${c.id}`} className="btn btn--ghost btn--sm">👁 Ver</Link>
                        <button className="btn btn--ghost btn--sm" onClick={() => setEquipasModal(c)}>👥 Equipas</button>
                        <button className="btn btn--outline btn--sm" onClick={() => setEditModal(c)}>✏️ Editar</button>
                        <button className="btn btn--danger btn--sm" onClick={() => setDeleteConfirm(c)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/edit modal */}
        {editModal !== null && (
          <CampeonatoModal
            initial={editModal?.id ? editModal : null}
            onSave={handleSave}
            onClose={() => setEditModal(null)}
          />
        )}

        {/* Teams modal */}
        {equipasModal && (
          <EquipasModal
            campeonato={equipasModal}
            onClose={() => { setEquipasModal(null); load() }}
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
                  Tem a certeza que deseja eliminar <strong>"{deleteConfirm.nome}"</strong>?
                  Todos os jogos associados serão eliminados permanentemente.
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
