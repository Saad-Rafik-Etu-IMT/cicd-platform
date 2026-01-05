import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (token) {
      login(token)
      navigate('/')
    } else {
      navigate('/login?error=no_token')
    }
  }, [searchParams, login, navigate])

  return (
    <div className="login-page">
      <div className="login-container" style={{ textAlign: 'center' }}>
        <div className="spinner"></div>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Authentification en cours...</p>
      </div>
    </div>
  )
}
