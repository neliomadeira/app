/**
 * Copa Fácil – JS Campinense
 * components/ProtectedRoute.jsx – Redirect to login if no JWT in localStorage
 */

import React from 'react'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('copa_token')
  if (!token) {
    return <Navigate to="/admin/login" replace />
  }
  return children
}
