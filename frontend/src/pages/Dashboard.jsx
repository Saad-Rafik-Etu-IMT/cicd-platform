import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Icons } from '../components/Icons'
import { StatusChart, TrendChart, DurationChart } from '../components/Charts'
import LoadingSpinner from '../components/LoadingSpinner'
import { useToast } from '../components/Toast'
import ProductionStatus from '../components/ProductionStatus'
import { formatDate, formatDuration } from '../utils/formatters'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { showToast } = useToast()
  const [pipelines, setPipelines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [triggering, setTriggering] = useState(false)
  const [actionInProgress, setActionInProgress] = useState(null)
  const socketRef = useRef(null)

  const canTrigger = hasPermission('trigger')
  const canRollback = hasPermission('rollback')

  useEffect(() => {
    fetchPipelines()
    connectWebSocket()
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchPipelines, 5000)
    return () => {
      clearInterval(interval)
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  const connectWebSocket = () => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3002'
    socketRef.current = io(wsUrl)

    socketRef.current.on('pipeline:completed', (data) => {
      showToast(`Pipeline #${data.id} termine avec succes`, 'success')
      fetchPipelines()
    })

    socketRef.current.on('pipeline:failed', (data) => {
      showToast(`Pipeline #${data.id} a echoue`, 'error')
      fetchPipelines()
    })

    socketRef.current.on('pipeline:cancelled', (data) => {
      showToast(`Pipeline #${data.id} annule`, 'warning')
      fetchPipelines()
    })

    socketRef.current.on('rollback:started', (data) => {
      showToast(`Rollback en cours vers #${data.targetPipelineId}...`, 'info')
    })

    socketRef.current.on('rollback:completed', (data) => {
      showToast(`Rollback termine - Version ${data.targetVersion} active`, 'success')
      fetchPipelines()
    })

    socketRef.current.on('rollback:failed', (data) => {
      showToast(`Rollback echoue: ${data.error}`, 'error')
    })
  }

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
      showToast('Pipeline declenche avec succes', 'success')
    } catch (err) {
      showToast('Erreur lors du declenchement du pipeline', 'error')
    }
    setTriggering(false)
  }

  const cancelPipeline = async (pipelineId, e) => {
    e.stopPropagation()
    if (!confirm('Annuler ce pipeline ?')) return
    
    setActionInProgress(pipelineId)
    try {
      await api.post(`/pipelines/${pipelineId}/cancel`)
      showToast(`Pipeline #${pipelineId} annule`, 'warning')
      await fetchPipelines()
    } catch (err) {
      showToast('Erreur lors de l\'annulation', 'error')
    }
    setActionInProgress(null)
  }

  const rollbackToPipeline = async (pipelineId, e) => {
    e.stopPropagation()
    if (!confirm('Effectuer un rollback vers cette version ?')) return
    
    setActionInProgress(pipelineId)
    try {
      await api.post(`/pipelines/${pipelineId}/rollback`)
      showToast('Rollback en cours...', 'info')
    } catch (err) {
      showToast('Erreur lors du rollback: ' + (err.response?.data?.error || err.message), 'error')
    }
    setActionInProgress(null)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return Icons.success
      case 'failed': return Icons.error
      case 'cancelled': return Icons.cancelled
      case 'rolled_back': return Icons.rollback
      case 'running': return Icons.running
      default: return Icons.pending
    }
  }

  // Statistics
  const stats = {
    total: pipelines.length,
    success: pipelines.filter(p => p.status === 'success').length,
    failed: pipelines.filter(p => p.status === 'failed').length,
    running: pipelines.filter(p => p.status === 'running').length
  }

  if (loading) {
    return <LoadingSpinner message="Chargement des pipelines..." />
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

      {/* Production Status */}
      <ProductionStatus onRollback={canRollback ? () => {
        const lastSuccess = pipelines.find(p => p.status === 'success')
        if (lastSuccess) rollbackToPipeline(lastSuccess.id, { stopPropagation: () => {} })
      } : null} />

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
                  <td className="actions-cell">
                    <div className="action-buttons">
                      {(pipeline.status === 'running' || pipeline.status === 'pending') && canTrigger && (
                        <button 
                          className="btn-icon btn-cancel"
                          onClick={(e) => cancelPipeline(pipeline.id, e)}
                          disabled={actionInProgress === pipeline.id}
                          title="Annuler"
                        >
                          {actionInProgress === pipeline.id ? Icons.running : Icons.stop}
                        </button>
                      )}
                      {pipeline.status === 'success' && canRollback && (
                        <button 
                          className="btn-icon btn-rollback"
                          onClick={(e) => rollbackToPipeline(pipeline.id, e)}
                          disabled={actionInProgress === pipeline.id}
                          title="Rollback vers cette version"
                        >
                          {actionInProgress === pipeline.id ? Icons.running : Icons.rollback}
                        </button>
                      )}
                      <Link 
                        to={`/pipeline/${pipeline.id}`} 
                        className="btn-icon btn-view"
                        onClick={(e) => e.stopPropagation()}
                        title="Voir details"
                      >
                        {Icons.eye}
                      </Link>
                    </div>
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
