import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()

  if (loading) {
    return <main className="auth-page"><p className="auth-status" role="status">Checking your session...</p></main>
  }

  if (!user) {
    return <Navigate replace to="/sign-in" />
  }

  return children
}