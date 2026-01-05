import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Icons } from '../components/Icons'
import './Login.css'

export default function Login() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')
  const loggedOut = searchParams.get('logged_out') === 'true'
  const [showLogoutMessage, setShowLogoutMessage] = useState(loggedOut)

  useEffect(() => {
    // Don't auto-redirect if user just logged out
    if (isAuthenticated && !loading && !loggedOut) {
      navigate('/')
    }
  }, [isAuthenticated, loading, navigate, loggedOut])

  useEffect(() => {
    // Clear the logout message after 5 seconds
    if (showLogoutMessage) {
      const timer = setTimeout(() => setShowLogoutMessage(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showLogoutMessage])

  const handleGitHubLogin = () => {
    // Clear logout state before redirecting to GitHub
    setShowLogoutMessage(false)
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    window.location.href = `${backendUrl}/api/auth/github`
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="spinner"></div>
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <span className="login-logo">{Icons.rocket}</span>
          <h1>CI/CD Platform</h1>
          <p className="login-subtitle">Plateforme de déploiement continu</p>
        </div>

        {showLogoutMessage && (
          <div className="login-success">
            <span>✅</span>
            <span>Déconnexion réussie</span>
          </div>
        )}

        {showLogoutMessage && (
          <div className="login-info-box">
            <span>💡</span>
            <span>Pour changer de compte GitHub, déconnectez-vous d'abord de GitHub ou révoquez l'accès dans vos paramètres GitHub.</span>
          </div>
        )}

        {error && (
          <div className="login-error">
            <span className="error-icon">{Icons.warning}</span>
            <span>
              {error === 'no_code' && 'Code d\'autorisation manquant'}
              {error === 'oauth_failed' && 'Échec de l\'authentification OAuth'}
              {error === 'server_error' && 'Erreur serveur'}
              {!['no_code', 'oauth_failed', 'server_error'].includes(error) && 'Erreur de connexion'}
            </span>
          </div>
        )}

        <div className="login-content">
          <p className="login-info">
            Connectez-vous avec votre compte GitHub pour accéder au dashboard.
          </p>

          <button className="btn-github" onClick={handleGitHubLogin}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>Continuer avec GitHub</span>
          </button>
        </div>

        <div className="login-footer">
          <p>En vous connectant, vous acceptez les conditions d'utilisation.</p>
          <div className="login-features">
            <div className="feature">
              <span className="feature-icon">{Icons.lock}</span>
              <span>Authentification sécurisée</span>
            </div>
            <div className="feature">
              <span className="feature-icon">{Icons.users}</span>
              <span>Gestion des rôles</span>
            </div>
            <div className="feature">
              <span className="feature-icon">{Icons.rocket}</span>
              <span>Déploiement automatique</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
