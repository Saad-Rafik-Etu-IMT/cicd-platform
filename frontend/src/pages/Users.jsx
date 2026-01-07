import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Icons } from '../components/Icons'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../components/Toast'
import './Users.css'

export default function Users() {
  const { user: currentUser, isAdmin } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [roleConfirm, setRoleConfirm] = useState(null)

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
      showToast('Vous ne pouvez pas modifier votre propre rôle', 'warning')
      return
    }

    setUpdating(userId)
    try {
      await api.patch(`/auth/users/${userId}/role`, { role: newRole })
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ))
      showToast('Rôle mis à jour avec succès', 'success')
    } catch (err) {
      showToast('Erreur lors de la mise à jour du rôle', 'error')
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
      case 'admin': return Icons.crown
      case 'developer': return Icons.code
      case 'viewer': return Icons.eye
      default: return Icons.user
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
        <h2><span className="access-icon">{Icons.lock}</span> Accès refusé</h2>
        <p>Seuls les administrateurs peuvent accéder à cette page.</p>
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner message="Chargement des utilisateurs..." />
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1><span className="header-icon">{Icons.users}</span> Gestion des utilisateurs</h1>
          <p className="subtitle">Gérez les rôles et permissions des utilisateurs</p>
        </div>
        <div className="user-count">
          <span className="count">{users.length}</span>
          <span className="label">utilisateurs</span>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">{Icons.warning}</span> {error}
        </div>
      )}

      <div className="roles-legend">
        <h3>Rôles et permissions</h3>
        <div className="legend-grid">
          <div className="legend-item">
            <span className="role-badge role-admin"><span className="role-icon">{Icons.crown}</span> Admin</span>
            <span className="permissions">Toutes les permissions</span>
          </div>
          <div className="legend-item">
            <span className="role-badge role-developer"><span className="role-icon">{Icons.code}</span> Developer</span>
            <span className="permissions">Déclencher pipelines, rollback, lecture</span>
          </div>
          <div className="legend-item">
            <span className="role-badge role-viewer"><span className="role-icon">{Icons.eye}</span> Viewer</span>
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
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                  {updating === user.id && <span className="updating">{Icons.running}</span>}
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
