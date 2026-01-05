import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await api.get('/auth/me')
      setUser(response.data.user)
      setError(null)
    } catch (err) {
      console.error('Auth check failed:', err)
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = (token) => {
    localStorage.setItem('token', token)
    checkAuth()
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  const hasPermission = (permission) => {
    if (!user) return false
    
    const permissions = {
      admin: ['read', 'write', 'trigger', 'rollback', 'manage_users', 'manage_env'],
      developer: ['read', 'write', 'trigger', 'rollback'],
      viewer: ['read']
    }
    
    return permissions[user.role]?.includes(permission) || false
  }

  const isAdmin = () => user?.role === 'admin'
  const isDeveloper = () => ['admin', 'developer'].includes(user?.role)

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      logout,
      checkAuth,
      hasPermission,
      isAdmin,
      isDeveloper,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
