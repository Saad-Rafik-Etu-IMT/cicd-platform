import { useState, useEffect } from 'react'
import api from '../services/api'
import './EnvVariables.css'

export default function EnvVariables() {
  const [variables, setVariables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingVar, setEditingVar] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    value: '',
    is_secret: true,
    description: ''
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchVariables()
  }, [])

  const fetchVariables = async () => {
    try {
      const response = await api.get('/env')
      setVariables(response.data.variables || [])
      setLoading(false)
    } catch (err) {
      setError('Erreur de chargement des variables')
      setLoading(false)
    }
  }

  const openModal = (variable = null) => {
    if (variable) {
      setEditingVar(variable)
      setFormData({
        name: variable.name,
        value: '',
        is_secret: variable.is_secret,
        description: variable.description || ''
      })
    } else {
      setEditingVar(null)
      setFormData({
        name: '',
        value: '',
        is_secret: true,
        description: ''
      })
    }
    setShowModal(true)
    setError(null)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingVar(null)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (editingVar) {
        // Update
        const updateData = { ...formData }
        if (updateData.value === '') {
          delete updateData.value // Don't update value if empty
        }
        await api.put(`/env/${editingVar.id}`, updateData)
      } else {
        // Create
        await api.post('/env', formData)
      }
      
      await fetchVariables()
      closeModal()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  const handleDelete = async (variable) => {
    if (!confirm(`Supprimer la variable "${variable.name}" ?`)) {
      return
    }

    try {
      await api.delete(`/env/${variable.id}`)
      await fetchVariables()
    } catch (err) {
      alert('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="env-variables">
      <div className="page-header">
        <div>
          <h1>🔐 Variables d'environnement</h1>
          <p className="subtitle">Gérez les secrets et configurations des pipelines</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          ➕ Nouvelle variable
        </button>
      </div>

      {variables.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔑</span>
          <h3>Aucune variable configurée</h3>
          <p>Ajoutez des variables d'environnement pour vos pipelines</p>
          <button className="btn-primary" onClick={() => openModal()}>
            Créer une variable
          </button>
        </div>
      ) : (
        <div className="variables-list">
          {variables.map(variable => (
            <div key={variable.id} className="variable-card">
              <div className="variable-info">
                <div className="variable-header">
                  <code className="variable-name">{variable.name}</code>
                  {variable.is_secret && <span className="badge secret">🔒 Secret</span>}
                </div>
                {variable.description && (
                  <p className="variable-description">{variable.description}</p>
                )}
                <span className="variable-value">
                  {variable.is_secret ? '••••••••' : variable.value}
                </span>
              </div>
              <div className="variable-actions">
                <button 
                  className="btn-icon" 
                  onClick={() => openModal(variable)}
                  title="Modifier"
                >
                  ✏️
                </button>
                <button 
                  className="btn-icon danger" 
                  onClick={() => handleDelete(variable)}
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingVar ? 'Modifier la variable' : 'Nouvelle variable'}</h2>
              <button className="btn-close" onClick={closeModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              {error && <div className="form-error">{error}</div>}
              
              <div className="form-group">
                <label htmlFor="name">Nom de la variable</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  placeholder="DATABASE_URL"
                  required
                  disabled={!!editingVar}
                  pattern="^[A-Z][A-Z0-9_]*$"
                  title="Majuscules, chiffres et underscores uniquement"
                />
                <small>Majuscules, commence par une lettre, underscores autorisés</small>
              </div>

              <div className="form-group">
                <label htmlFor="value">
                  Valeur {editingVar && <span className="optional">(laisser vide pour conserver)</span>}
                </label>
                <input
                  type={formData.is_secret ? 'password' : 'text'}
                  id="value"
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: e.target.value })}
                  placeholder={editingVar ? '••••••••' : 'Valeur de la variable'}
                  required={!editingVar}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description (optionnel)</label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de la variable"
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_secret}
                    onChange={e => setFormData({ ...formData, is_secret: e.target.checked })}
                  />
                  <span>🔒 Masquer la valeur (secret)</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '⏳ Enregistrement...' : (editingVar ? 'Modifier' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
