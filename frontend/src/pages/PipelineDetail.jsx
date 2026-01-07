import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Icons } from '../components/Icons'
import './PipelineDetail.css'

const PIPELINE_STEPS = [
  { name: 'Clone Repository', icon: 'gitClone' },
  { name: 'Run Tests', icon: 'test' },
  { name: 'Build Package', icon: 'build' },
  { name: 'SonarQube Analysis', icon: 'scan' },
  { name: 'Build Docker Image', icon: 'docker' },
  { name: 'Deploy to VM', icon: 'deploy' },
  { name: 'Health Check', icon: 'health' },
  { name: 'Security Scan', icon: 'security' }
]

export default function PipelineDetail() {
  const { id } = useParams()
  const { hasPermission } = useAuth()
  const [pipeline, setPipeline] = useState(null)
  const [logs, setLogs] = useState([])
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [expandedStep, setExpandedStep] = useState(null)
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
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3002'
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
        started_at: new Date().toISOString(),
        logs: []
      }])
      addLog(`Démarrage: ${data.step}`, 'info', data.step)
    })

    socketRef.current.on('step_log', (data) => {
      setSteps(prev => prev.map(s => 
        s.step_name === data.step 
          ? { ...s, logs: [...(s.logs || []), { message: data.message, type: data.type || 'output', timestamp: new Date().toISOString() }] }
          : s
      ))
      addLog(data.message, data.type || 'output', data.step)
    })

    socketRef.current.on('step_completed', (data) => {
      setSteps(prev => prev.map(s => 
        s.step_name === data.step 
          ? { ...s, status: 'success', output: data.output, duration: data.duration }
          : s
      ))
      addLog(`Terminé: ${data.step}`, 'success', data.step)
      if (data.output) {
        addLog(data.output, 'output', data.step)
      }
    })

    socketRef.current.on('step_failed', (data) => {
      setSteps(prev => prev.map(s => 
        s.step_name === data.step 
          ? { ...s, status: 'failed', output: data.error }
          : s
      ))
      addLog(`Échec: ${data.step}`, 'error', data.step)
      addLog(data.error, 'error', data.step)
    })

    socketRef.current.on('pipeline_completed', () => {
      setPipeline(prev => ({ ...prev, status: 'success' }))
      addLog('Pipeline terminé avec succès', 'success')
    })

    socketRef.current.on('pipeline_failed', (data) => {
      setPipeline(prev => ({ ...prev, status: 'failed' }))
      addLog(`Pipeline échoué: ${data.error}`, 'error')
    })

    socketRef.current.on('rollback_started', () => {
      addLog('Démarrage du rollback...', 'warning')
    })

    socketRef.current.on('rollback_completed', (data) => {
      addLog(`Rollback vers ${data.version} terminé`, 'success')
    })
  }

  const addLog = (message, type = 'info', stepName = null) => {
    const timestamp = new Date().toLocaleTimeString('fr-FR')
    setLogs(prev => [...prev, { timestamp, message, type, stepName }])
  }

  const triggerRollback = async () => {
    if (!confirm('Voulez-vous vraiment effectuer un rollback ?')) return
    
    try {
      await api.post(`/pipelines/${id}/rollback`)
      addLog('Rollback déclenché', 'warning')
    } catch (err) {
      addLog('Erreur lors du rollback', 'error')
    }
  }

  const getStepData = (stepName) => {
    return steps.find(s => s.step_name === stepName) || { status: 'pending', logs: [] }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return Icons.success
      case 'failed': return Icons.error
      case 'running': return Icons.running
      default: return Icons.pending
    }
  }

  const getLogIcon = (type) => {
    switch (type) {
      case 'success': return Icons.success
      case 'error': return Icons.error
      case 'warning': return Icons.warning
      case 'info': return Icons.info
      default: return Icons.terminal
    }
  }

  const toggleStep = (stepName) => {
    setExpandedStep(expandedStep === stepName ? null : stepName)
  }

  const getStepLogs = (stepName) => {
    return logs.filter(log => log.stepName === stepName)
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
        <Link to="/">{Icons.arrowLeft} Retour au dashboard</Link>
      </div>
    )
  }

  return (
    <div className="pipeline-detail">
      {/* Header */}
      <div className="detail-header">
        <div>
          <Link to="/" className="back-link">
            <span className="icon-inline">{Icons.arrowLeft}</span>
            Retour
          </Link>
          <h1>Pipeline #{id}</h1>
          <div className="pipeline-meta">
            <span className={`status status-${pipeline.status}`}>
              <span className="status-icon">{getStatusIcon(pipeline.status)}</span>
              {pipeline.status}
            </span>
            <span>Branche: <code>{pipeline.branch || 'master'}</code></span>
            {pipeline.commit_hash && (
              <span>Commit: <code>{pipeline.commit_hash.substring(0, 7)}</code></span>
            )}
            {pipeline.sonar_project_key && (
              <a 
                href={`${import.meta.env.VITE_SONAR_URL || 'http://localhost:9001'}/dashboard?id=${pipeline.sonar_project_key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sonar-link"
              >
                📊 SonarQube: {pipeline.sonar_quality_gate || 'N/A'}
              </a>
            )}
          </div>
        </div>
        <div className="header-actions">
          <span className={`connection-status ${connected ? 'connected' : ''}`}>
            <span className="status-dot">{connected ? Icons.connected : Icons.disconnected}</span>
            {connected ? 'Temps réel' : 'Déconnecté'}
          </span>
          {pipeline.status === 'success' && canRollback && (
            <button className="btn-danger" onClick={triggerRollback}>
              <span className="icon-inline">{Icons.rollback}</span>
              Rollback
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
              const stepData = getStepData(step.name)
              const status = stepData.status
              const isExpanded = expandedStep === step.name
              const stepLogs = getStepLogs(step.name)
              const hasLogs = stepLogs.length > 0 || stepData.output

              return (
                <div key={step.name} className="step-wrapper">
                  <div 
                    className={`step-item step-${status} ${hasLogs ? 'clickable' : ''} ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => hasLogs && toggleStep(step.name)}
                  >
                    <div className="step-number">{index + 1}</div>
                    <div className="step-icon">{Icons[step.icon]}</div>
                    <div className="step-info">
                      <span className="step-name">{step.name}</span>
                      <span className={`step-status status-text-${status}`}>
                        {status}
                        {stepData.duration && ` • ${stepData.duration}s`}
                      </span>
                    </div>
                    <div className="step-status-icon">
                      {status === 'running' ? (
                        <div className="step-spinner"></div>
                      ) : (
                        getStatusIcon(status)
                      )}
                    </div>
                    {hasLogs && (
                      <div className={`step-chevron ${isExpanded ? 'rotated' : ''}`}>
                        {Icons.chevronDown}
                      </div>
                    )}
                  </div>
                  
                  {/* Expanded Step Logs */}
                  {isExpanded && (
                    <div className="step-logs">
                      <div className="step-logs-header">
                        <span className="icon-inline">{Icons.terminal}</span>
                        Logs de l'étape
                      </div>
                      <div className="step-logs-content">
                        {stepLogs.length === 0 && stepData.output ? (
                          <div className="log-line log-output">
                            <span className="log-message">{stepData.output}</span>
                          </div>
                        ) : (
                          stepLogs.map((log, idx) => (
                            <div key={idx} className={`log-line log-${log.type}`}>
                              <span className="log-icon">{getLogIcon(log.type)}</span>
                              <span className="log-time">[{log.timestamp}]</span>
                              <span className="log-message">{log.message}</span>
                            </div>
                          ))
                        )}
                        {stepLogs.length === 0 && !stepData.output && (
                          <div className="logs-empty-small">Aucun log disponible</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Live Logs */}
        <div className="card logs-card">
          <div className="logs-header">
            <h2>
              <span className="icon-inline">{Icons.terminal}</span>
              Logs en temps réel
            </h2>
            <button 
              className="btn-secondary btn-sm"
              onClick={() => setLogs([])}
            >
              <span className="icon-inline">{Icons.trash}</span>
              Effacer
            </button>
          </div>
          <div className="logs-container">
            {logs.length === 0 ? (
              <div className="logs-empty">
                <span className="icon-muted">{Icons.terminal}</span>
                <p>En attente des logs...</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-line log-${log.type}`}>
                  <span className="log-icon">{getLogIcon(log.type)}</span>
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
