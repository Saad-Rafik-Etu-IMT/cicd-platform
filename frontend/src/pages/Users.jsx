import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import './Users.css'

export default function Users() {
  const { user: currentUser, isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users')
      setUsers(response.data.users || [])
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateRole = async (userId, newRole) => {
    if (userId === currentUser.id) {
      alert('Vous ne pouvez pas modifier votre propre rôle')
      return
    }

    setUpdating(userId)
    try {
      await api.patch(`/auth/users/${userId}/role`, { role: newRole })
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ))
    } catch (err) {
      alert('Erreur lors de la mise à jour du rôle')
      console.error(err)
    } finally {
      setUpdating(null)
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'role-admin'
      case 'developer': return 'role-developer'
      case 'viewer': return 'role-viewer'
      default: return ''
    }
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return '👑'
      case 'developer': return '💻'
      case 'viewer': return '👁️'
      default: return '👤'
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (!isAdmin()) {
    return (
      <div className="access-denied">
        <h2>🔒 Accès refusé</h2>
        <p>Seuls les administrateurs peuvent accéder à cette page.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Chargement des utilisateurs...</p>
      </div>
    )
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1>👥 Gestion des utilisateurs</h1>
          <p className="subtitle">Gérez les rôles et permissions des utilisateurs</p>
        </div>
        <div className="user-count">
          <span className="count">{users.length}</span>
          <span className="label">utilisateurs</span>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className="roles-legend">
        <h3>Rôles et permissions</h3>
        <div className="legend-grid">
          <div className="legend-item">
            <span className="role-badge role-admin">👑 Admin</span>
            <span className="permissions">Toutes les permissions</span>
          </div>
          <div className="legend-item">
            <span className="role-badge role-developer">💻 Developer</span>
            <span className="permissions">Déclencher pipelines, rollback, lecture</span>
          </div>
          <div className="legend-item">
            <span className="role-badge role-viewer">👁️ Viewer</span>
            <span className="permissions">Lecture seule</span>
          </div>
        </div>
      </div>

      <div className="card users-card">
        <table className="users-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Inscrit le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={user.id === currentUser.id ? 'current-user' : ''}>
                <td className="user-cell">
                  {user.avatar_url && (
                    <img src={user.avatar_url} alt={user.username} className="user-avatar" />
                  )}
                  <div className="user-info">
                    <span className="username">{user.username}</span>
                    {user.id === currentUser.id && (
                      <span className="you-badge">Vous</span>
                    )}
                  </div>
                </td>
                <td className="email-cell">{user.email || '-'}</td>
                <td>
                  <span className={`role-badge ${getRoleColor(user.role)}`}>
                    {getRoleIcon(user.role)} {user.role}
                  </span>
                </td>
                <td className="date-cell">{formatDate(user.created_at)}</td>
                <td className="actions-cell">
                  {user.id === currentUser.id ? (
                    <span className="no-action">-</span>
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      disabled={updating === user.id}
                      className="role-select"
                    >
                      <option value="admin">👑 Admin</option>
                      <option value="developer">💻 Developer</option>
                      <option value="viewer">👁️ Viewer</option>
                    </select>
                  )}
                  {updating === user.id && <span className="updating">⏳</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="empty-state">
            <p>Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>
    </div>
  )
}
