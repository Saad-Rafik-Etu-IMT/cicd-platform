import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Icons } from '../components/Icons'
import { StatusChart, TrendChart, DurationChart } from '../components/Charts'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [pipelines, setPipelines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [triggering, setTriggering] = useState(false)

  const canTrigger = hasPermission('trigger')

  useEffect(() => {
    fetchPipelines()
    // Refresh every 5 seconds
    const interval = setInterval(fetchPipelines, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchPipelines = async () => {
    try {
      const response = await api.get('/pipelines')
      setPipelines(response.data.pipelines || [])
      setError(null)
      setLoading(false)
    } catch (err) {
      setError('Erreur de connexion au serveur')
      setLoading(false)
    }
  }

  const triggerPipeline = async () => {
    setTriggering(true)
    try {
      await api.post('/pipelines/trigger', { 
        repo_url: 'https://github.com/Saad-Rafik-Etu-IMT/demo.git',
        branch: 'master' 
      })
      await fetchPipelines()
    } catch (err) {
      alert('Erreur lors du déclenchement du pipeline')
    }
    setTriggering(false)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return Icons.success
      case 'failed': return Icons.error
      case 'running': return Icons.running
      default: return Icons.pending
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('fr-FR')
  }

  const formatDuration = (start, end) => {
    if (!start || !end) return '-'
    const duration = new Date(end) - new Date(start)
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  // Statistics
  const stats = {
    total: pipelines.length,
    success: pipelines.filter(p => p.status === 'success').length,
    failed: pipelines.filter(p => p.status === 'failed').length,
    running: pipelines.filter(p => p.status === 'running').length
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
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Gestion des pipelines CI/CD</p>
        </div>
        {canTrigger && (
          <button 
            className="btn-primary trigger-btn"
            onClick={triggerPipeline}
            disabled={triggering}
          >
            {triggering ? <><span className="icon-inline">{Icons.running}</span>Déclenchement...</> : <><span className="icon-inline">{Icons.deploy}</span>Nouveau déploiement</>}
          </button>
        )}
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Pipelines</span>
        </div>
        <div className="stat-card success">
          <span className="stat-value">{stats.success}</span>
          <span className="stat-label">Réussis</span>
        </div>
        <div className="stat-card failed">
          <span className="stat-value">{stats.failed}</span>
          <span className="stat-label">Échoués</span>
        </div>
        <div className="stat-card running">
          <span className="stat-value">{stats.running}</span>
          <span className="stat-label">En cours</span>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-section">
        <StatusChart pipelines={pipelines} />
        <TrendChart pipelines={pipelines} />
        <DurationChart pipelines={pipelines} />
      </div>

      {/* Error message */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">{Icons.warning}</span>
          <span>{error}</span>
        </div>
      )}

      {/* Pipelines list */}
      <div className="card">
        <h2>Pipelines récents</h2>
        
        {pipelines.length === 0 ? (
          <div className="empty-state">
            <p>Aucun pipeline exécuté</p>
            <p className="subtitle">Cliquez sur "Nouveau déploiement" pour commencer</p>
          </div>
        ) : (
          <table className="pipeline-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Branche</th>
                <th>Commit</th>
                <th>Trigger</th>
                <th>Durée</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map(pipeline => (
                <tr 
                  key={pipeline.id} 
                  className={`row-${pipeline.status}`}
                  onClick={() => navigate(`/pipeline/${pipeline.id}`)}
                >
                  <td>
                    <Link to={`/pipeline/${pipeline.id}`} onClick={(e) => e.stopPropagation()}>
                      #{pipeline.id}
                    </Link>
                  </td>
                  <td>
                    <span className={`status status-${pipeline.status}`}>
                      <span className={`status-cell status-${pipeline.status}`}>{getStatusIcon(pipeline.status)}</span>
                      {pipeline.status}
                    </span>
                  </td>
                  <td>
                    <code>{pipeline.branch || 'master'}</code>
                  </td>
                  <td>
                    <code className="commit-hash">
                      {pipeline.commit_hash ? pipeline.commit_hash.substring(0, 7) : '-'}
                    </code>
                  </td>
                  <td>{pipeline.trigger_type || 'manual'}</td>
                  <td>{formatDuration(pipeline.started_at, pipeline.completed_at)}</td>
                  <td>{formatDate(pipeline.created_at)}</td>
                  <td>
                    <Link 
                      to={`/pipeline/${pipeline.id}`} 
                      className="btn-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Voir détails →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
