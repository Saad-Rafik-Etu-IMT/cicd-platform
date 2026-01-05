import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requiredPermission }) {
  const { isAuthenticated, loading, hasPermission } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Chargement...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="error-page" style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: '#fff' 
      }}>
        <h2>🔒 Accès refusé</h2>
        <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        <a href="/" style={{ color: '#3b82f6' }}>← Retour au dashboard</a>
      </div>
    )
  }

  return children
}
