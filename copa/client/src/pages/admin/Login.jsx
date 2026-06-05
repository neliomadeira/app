/**
 * Copa Fácil – JS Campinense
 * pages/admin/Login.jsx – Admin login form
 *
 * On success: store JWT in localStorage('copa_token'), redirect to /admin
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth as authApi } from '../../api/index.js'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // If already logged in, redirect
  useEffect(() => {
    if (localStorage.getItem('copa_token')) {
      navigate('/admin', { replace: true })
    }
  }, [navigate])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username.trim() || !form.password.trim()) {
      setError('Por favor preencha todos os campos.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.login(form)
      localStorage.setItem('copa_token', data.token)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciais inválidas. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - var(--navbar-h))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🏆</div>
          <h1
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '2.5rem',
              letterSpacing: '0.06em',
              marginBottom: '0.3rem',
            }}
          >
            Copa <span style={{ color: 'var(--yellow)' }}>Fácil</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Painel de Administração – JS Campinense
          </p>
        </div>

        {/* Form card */}
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Iniciar Sessão</h2>
          </div>
          <div className="card__body">
            {error && <div className="alert alert--error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">Utilizador</label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  className="form-control"
                  placeholder="admin"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={loading}
                style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
              >
                {loading ? 'A entrar…' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Acesso restrito a administradores do JS Campinense
        </p>
      </div>
    </div>
  )
}
