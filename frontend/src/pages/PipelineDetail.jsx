import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import './PipelineDetail.css'

const PIPELINE_STEPS = [
  { name: 'Clone Repository', icon: '📥' },
  { name: 'Run Tests', icon: '🧪' },
  { name: 'Build Package', icon: '📦' },
  { name: 'SonarQube Analysis', icon: '🔍' },
  { name: 'Build Docker Image', icon: '🐳' },
  { name: 'Deploy to VM', icon: '🚀' },
  { name: 'Health Check', icon: '💚' }
]

export default function PipelineDetail() {
  const { id } = useParams()
  const { hasPermission } = useAuth()
  const [pipeline, setPipeline] = useState(null)
  const [logs, setLogs] = useState([])
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const logsEndRef = useRef(null)
  const socketRef = useRef(null)

  const canRollback = hasPermission('rollback')

  useEffect(() => {
    fetchPipeline()
    connectWebSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [id])

  useEffect(() => {
    // Auto-scroll logs
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const fetchPipeline = async () => {
    try {
      const response = await api.get(`/pipelines/${id}`)
      setPipeline(response.data.pipeline)
      setSteps(response.data.logs || [])
      setLoading(false)
    } catch (err) {
      console.error('Error fetching pipeline:', err)
      setLoading(false)
    }
  }

  const connectWebSocket = () => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001'
    socketRef.current = io(wsUrl)

    socketRef.current.on('connect', () => {
      setConnected(true)
      socketRef.current.emit('subscribe', `pipeline-${id}`)
    })

    socketRef.current.on('disconnect', () => {
      setConnected(false)
    })

    socketRef.current.on('step_started', (data) => {
      setSteps(prev => [...prev, { 
        step_name: data.step, 
        status: 'running',
        started_at: new Date().toISOString()
      }])
      addLog(`▶️ Démarrage: ${data.step}`)
    })

    socketRef.current.on('step_completed', (data) => {
      setSteps(prev => prev.map(s => 
        s.step_name === data.step 
          ? { ...s, status: 'success', output: data.output }
          : s
      ))
      addLog(`✅ Terminé: ${data.step}`)
      if (data.output) {
        addLog(data.output, 'output')
      }
    })

    socketRef.current.on('step_failed', (data) => {
      setSteps(prev => prev.map(s => 
        s.step_name === data.step 
          ? { ...s, status: 'failed', output: data.error }
          : s
      ))
      addLog(`❌ Échec: ${data.step}`, 'error')
      addLog(data.error, 'error')
    })

    socketRef.current.on('pipeline_completed', () => {
      setPipeline(prev => ({ ...prev, status: 'success' }))
      addLog('🎉 Pipeline terminé avec succès!', 'success')
    })

    socketRef.current.on('pipeline_failed', (data) => {
      setPipeline(prev => ({ ...prev, status: 'failed' }))
      addLog(`💥 Pipeline échoué: ${data.error}`, 'error')
    })

    socketRef.current.on('rollback_started', () => {
      addLog('⏮️ Démarrage du rollback...', 'warning')
    })

    socketRef.current.on('rollback_completed', (data) => {
      addLog(`✅ Rollback vers ${data.version} terminé`, 'success')
    })
  }

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('fr-FR')
    setLogs(prev => [...prev, { timestamp, message, type }])
  }

  const triggerRollback = async () => {
    if (!confirm('Voulez-vous vraiment effectuer un rollback ?')) return
    
    try {
      await api.post(`/pipelines/${id}/rollback`)
      addLog('⏮️ Rollback déclenché', 'warning')
    } catch (err) {
      addLog('Erreur lors du rollback', 'error')
    }
  }

  const getStepStatus = (stepName) => {
    const step = steps.find(s => s.step_name === stepName)
    return step?.status || 'pending'
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅'
      case 'failed': return '❌'
      case 'running': return '⏳'
      default: return '⏸️'
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Chargement du pipeline...</p>
      </div>
    )
  }

  if (!pipeline) {
    return (
      <div className="error-page">
        <h2>Pipeline non trouvé</h2>
        <Link to="/">← Retour au dashboard</Link>
      </div>
    )
  }

  return (
    <div className="pipeline-detail">
      {/* Header */}
      <div className="detail-header">
        <div>
          <Link to="/" className="back-link">← Retour</Link>
          <h1>Pipeline #{id}</h1>
          <div className="pipeline-meta">
            <span className={`status status-${pipeline.status}`}>
              {getStatusIcon(pipeline.status)} {pipeline.status}
            </span>
            <span>Branche: <code>{pipeline.branch || 'master'}</code></span>
            {pipeline.commit_hash && (
              <span>Commit: <code>{pipeline.commit_hash.substring(0, 7)}</code></span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <span className={`connection-status ${connected ? 'connected' : ''}`}>
            {connected ? '🟢 Temps réel' : '🔴 Déconnecté'}
          </span>
          {pipeline.status === 'success' && canRollback && (
            <button className="btn-danger" onClick={triggerRollback}>
              ⏮️ Rollback
            </button>
          )}
        </div>
      </div>

      <div className="detail-content">
        {/* Steps Progress */}
        <div className="card steps-card">
          <h2>Étapes du pipeline</h2>
          <div className="steps-list">
            {PIPELINE_STEPS.map((step, index) => {
              const status = getStepStatus(step.name)
              return (
                <div key={step.name} className={`step-item step-${status}`}>
                  <div className="step-number">{index + 1}</div>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-info">
                    <span className="step-name">{step.name}</span>
                    <span className={`step-status status-${status}`}>
                      {getStatusIcon(status)} {status}
                    </span>
                  </div>
                  {status === 'running' && (
                    <div className="step-spinner"></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Live Logs */}
        <div className="card logs-card">
          <div className="logs-header">
            <h2>Logs en temps réel</h2>
            <button 
              className="btn-secondary"
              onClick={() => setLogs([])}
            >
              Effacer
            </button>
          </div>
          <div className="logs-container">
            {logs.length === 0 ? (
              <div className="logs-empty">
                En attente des logs...
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-line log-${log.type}`}>
                  <span className="log-time">[{log.timestamp}]</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
