import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Icons } from './Icons'
import { formatDate } from '../utils/formatters'
import './ProductionStatus.css'

export default function ProductionStatus({ onRollback }) {
  const [currentDeployment, setCurrentDeployment] = useState(null)
  const [vmStatus, setVmStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const [deploymentRes, vmRes] = await Promise.all([
        api.get('/deployments/current'),
        api.get('/vm/status')
      ])
      setCurrentDeployment(deploymentRes.data.current)
      setVmStatus(vmRes.data)
      setError(null)
    } catch (err) {
      setError('Impossible de charger le statut')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="production-status card">
        <div className="production-header">
          <h2>
            <span className="icon-inline">{Icons.server}</span>
            Production
          </h2>
        </div>
        <div className="production-loading">
          <div className="spinner-small"></div>
          <span>Chargement...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="production-status card">
        <div className="production-header">
          <h2>
            <span className="icon-inline">{Icons.server}</span>
            Production
          </h2>
        </div>
        <div className="production-error">
          <span className="icon-inline">{Icons.warning}</span>
          {error}
        </div>
      </div>
    )
  }

  const isHealthy = vmStatus?.container?.healthy
  const isConnected = vmStatus?.vm?.connected

  return (
    <div className="production-status card">
      <div className="production-header">
        <h2>
          <span className="icon-inline">{Icons.server}</span>
          Production
        </h2>
        <div className="production-indicators">
          <span className={`indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? Icons.connected : Icons.disconnected}
            SSH
          </span>
          <span className={`indicator ${isHealthy ? 'healthy' : 'unhealthy'}`}>
            {isHealthy ? Icons.success : Icons.warning}
            Health
          </span>
        </div>
      </div>

      {currentDeployment ? (
        <div className="production-content">
          <div className="deployment-info">
            <div className="deployment-main">
              <div className="deployment-version">
                <span className="label">Version active</span>
                <div className="version-details">
                  <code className="commit-hash">
                    {currentDeployment.commitHash?.substring(0, 7) || 'N/A'}
                  </code>
                  {currentDeployment.isRollback && (
                    <span className="rollback-badge">
                      {Icons.rollback}
                      Rollback
                    </span>
                  )}
                </div>
              </div>
              <div className="deployment-pipeline">
                <span className="label">Pipeline</span>
                <Link to={`/pipeline/${currentDeployment.pipelineId}`} className="pipeline-link">
                  #{currentDeployment.pipelineId}
                </Link>
              </div>
              <div className="deployment-branch">
                <span className="label">Branche</span>
                <code>{currentDeployment.branch || 'master'}</code>
              </div>
              <div className="deployment-date">
                <span className="label">Deploye le</span>
                <span>{formatDate(currentDeployment.deployedAt)}</span>
              </div>
            </div>
            {currentDeployment.commitMessage && (
              <div className="deployment-message">
                <span className="icon-inline">{Icons.gitCommit}</span>
                <span className="message-text">{currentDeployment.commitMessage}</span>
              </div>
            )}
          </div>

          <div className="production-actions">
            {onRollback && (
              <button className="btn-secondary btn-sm" onClick={onRollback}>
                <span className="icon-inline">{Icons.rollback}</span>
                Rollback
              </button>
            )}
            <Link to={`/pipeline/${currentDeployment.pipelineId}`} className="btn-secondary btn-sm">
              <span className="icon-inline">{Icons.eye}</span>
              Details
            </Link>
          </div>
        </div>
      ) : (
        <div className="production-empty">
          <span className="icon-muted">{Icons.server}</span>
          <p>Aucun deploiement actif</p>
          <p className="subtitle">Lancez un pipeline pour deployer</p>
        </div>
      )}

      {vmStatus && (
        <div className="vm-info">
          <div className="vm-detail">
            <span className="icon-inline">{Icons.server}</span>
            <span>{vmStatus.vm?.host || 'Non configure'}</span>
          </div>
          <div className="vm-detail">
            <span className="icon-inline">{Icons.docker}</span>
            <span>{vmStatus.container?.status || 'Inconnu'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
