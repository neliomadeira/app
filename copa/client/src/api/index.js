/**
 * Copa Fácil – JS Campinense
 * api/index.js – Axios API client
 *
 * Sends JWT token (stored in localStorage as 'copa_token') in Authorization header.
 *
 * Exports:
 *   auth        – login, getMe
 *   campeonatos – full CRUD + classificacao, jogos, equipas, gerarFixtures
 *   equipas     – full CRUD + player management
 *   jogos       – getById, update
 */

import axios from 'axios'

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// Attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('copa_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname
      if (!path.includes('/admin/login')) {
        // only redirect from admin pages
        if (path.includes('/admin')) {
          localStorage.removeItem('copa_token')
          window.location.href = '/copa/admin/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login: (credentials) => api.post('/auth/login', credentials).then(r => r.data),
  getMe:  ()           => api.get('/auth/me').then(r => r.data),
}

// ── Campeonatos ───────────────────────────────────────────────────────────────
export const campeonatos = {
  getAll:         ()            => api.get('/campeonatos').then(r => r.data),
  getById:        (id)          => api.get(`/campeonatos/${id}`).then(r => r.data),
  getClassificacao:(id)         => api.get(`/campeonatos/${id}/classificacao`).then(r => r.data),
  getJogos:       (id)          => api.get(`/campeonatos/${id}/jogos`).then(r => r.data),
  getEquipas:     (id)          => api.get(`/campeonatos/${id}/equipas`).then(r => r.data),
  create:         (data)        => api.post('/campeonatos', data).then(r => r.data),
  update:         (id, data)    => api.put(`/campeonatos/${id}`, data).then(r => r.data),
  delete:         (id)          => api.delete(`/campeonatos/${id}`).then(r => r.data),
  addEquipa:      (id, equipaId)=> api.post(`/campeonatos/${id}/equipas`, { equipa_id: equipaId }).then(r => r.data),
  removeEquipa:   (id, equipaId)=> api.delete(`/campeonatos/${id}/equipas/${equipaId}`).then(r => r.data),
  gerarFixtures:  (id)          => api.post(`/campeonatos/${id}/gerar-fixtures`).then(r => r.data),
}

// ── Equipas ───────────────────────────────────────────────────────────────────
export const equipas = {
  getAll:         ()                  => api.get('/equipas').then(r => r.data),
  getById:        (id)                => api.get(`/equipas/${id}`).then(r => r.data),
  create:         (data)              => api.post('/equipas', data).then(r => r.data),
  update:         (id, data)          => api.put(`/equipas/${id}`, data).then(r => r.data),
  delete:         (id)                => api.delete(`/equipas/${id}`).then(r => r.data),
  addJogador:     (id, data)          => api.post(`/equipas/${id}/jogadores`, data).then(r => r.data),
  updateJogador:  (id, jId, data)     => api.put(`/equipas/${id}/jogadores/${jId}`, data).then(r => r.data),
  deleteJogador:  (id, jId)           => api.delete(`/equipas/${id}/jogadores/${jId}`).then(r => r.data),
}

// ── Jogos ─────────────────────────────────────────────────────────────────────
export const jogos = {
  getById: (id)       => api.get(`/jogos/${id}`).then(r => r.data),
  update:  (id, data) => api.put(`/jogos/${id}`, data).then(r => r.data),
}

export default api
