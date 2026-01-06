import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import './SonarDashboard.css'

export default function SonarDashboard() {
  const { hasPermission } = useAuth()
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [projectKey, setProjectKey] = useState('')
  const [report, setReport] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const [statusRes, configRes] = await Promise.all([
        api.get('/sonar/status'),
        api.get('/sonar/config')
      ])
      setStatus(statusRes.data)
      setConfig(configRes.data)
    } catch (err) {
      console.error('Error fetching SonarQube status:', err)
      setStatus({ available: false, error: 'Connection failed' })
    } finally {
      setLoading(false)
    }
  }

  const fetchReport = async () => {
    if (!projectKey.trim()) return
    
    setLoadingReport(true)
    try {
      const response = await api.get(`/sonar/projects/${projectKey}/report`)
      setReport(response.data)
    } catch (err) {
      console.error('Error fetching report:', err)
      setReport({ success: false, error: 'Failed to fetch report' })
    } finally {
      setLoadingReport(false)
    }
  }

  const getRatingClass = (rating) => {
    const classes = {
      'A': 'rating-a',
      'B': 'rating-b',
      'C': 'rating-c',
      'D': 'rating-d',
      'E': 'rating-e'
    }
    return classes[rating] || ''
  }

  const getQualityGateClass = (status) => {
    return status === 'OK' ? 'quality-gate-passed' : 'quality-gate-failed'
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Chargement de SonarQube...</p>
      </div>
    )
  }

  return (
    <div className="sonar-dashboard">
      <div className="page-header">
        <div>
          <h1>📊 SonarQube</h1>
          <p className="subtitle">Analyse de qualité de code</p>
        </div>
        {config?.url && (
          <a 
            href={config.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Ouvrir SonarQube ↗
          </a>
        )}
      </div>

      {/* Status Card */}
      <div className="sonar-status-card">
        <h3>État du serveur</h3>
        <div className="status-info">
          <div className={`status-indicator ${status?.available ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {status?.available ? 'En ligne' : 'Hors ligne'}
          </div>
          {status?.version && (
            <span className="version">Version: {status.version}</span>
          )}
          {!status?.available && status?.error && (
            <span className="error-message">{status.error}</span>
          )}
        </div>
      </div>

      {/* Project Search */}
      <div className="project-search-card">
        <h3>Rechercher un projet</h3>
        <div className="search-form">
          <input
            type="text"
            placeholder="Clé du projet (ex: cicd-demo-master)"
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchReport()}
          />
          <button 
            onClick={fetchReport}
            disabled={loadingReport || !projectKey.trim()}
            className="btn btn-primary"
          >
            {loadingReport ? 'Chargement...' : 'Analyser'}
          </button>
        </div>
      </div>

      {/* Report Display */}
      {report && (
        <div className="report-section">
          {report.success ? (
            <>
              {/* Quality Gate */}
              <div className={`quality-gate-card ${getQualityGateClass(report.qualityGate?.status)}`}>
                <div className="quality-gate-header">
                  <h3>Quality Gate</h3>
                  <span className="quality-gate-status">
                    {report.qualityGate?.passed ? '✅ PASSED' : '❌ FAILED'}
                  </span>
                </div>
                {report.dashboardUrl && (
                  <a 
                    href={report.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dashboard-link"
                  >
                    Voir le dashboard complet ↗
                  </a>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="metrics-grid">
                {/* Bugs */}
                <div className="metric-card bugs">
                  <div className="metric-icon">🐛</div>
                  <div className="metric-value">{report.summary?.bugs || 0}</div>
                  <div className="metric-label">Bugs</div>
                </div>

                {/* Vulnerabilities */}
                <div className="metric-card vulnerabilities">
                  <div className="metric-icon">🔓</div>
                  <div className="metric-value">{report.summary?.vulnerabilities || 0}</div>
                  <div className="metric-label">Vulnérabilités</div>
                </div>

                {/* Code Smells */}
                <div className="metric-card code-smells">
                  <div className="metric-icon">💨</div>
                  <div className="metric-value">{report.summary?.codeSmells || 0}</div>
                  <div className="metric-label">Code Smells</div>
                </div>

                {/* Coverage */}
                <div className="metric-card coverage">
                  <div className="metric-icon">📊</div>
                  <div className="metric-value">{report.summary?.coverage || 0}%</div>
                  <div className="metric-label">Couverture</div>
                </div>

                {/* Duplications */}
                <div className="metric-card duplications">
                  <div className="metric-icon">📋</div>
                  <div className="metric-value">{report.summary?.duplications || 0}%</div>
                  <div className="metric-label">Duplications</div>
                </div>

                {/* Lines of Code */}
                <div className="metric-card loc">
                  <div className="metric-icon">📝</div>
                  <div className="metric-value">
                    {(report.summary?.linesOfCode || 0).toLocaleString()}
                  </div>
                  <div className="metric-label">Lignes de code</div>
                </div>
              </div>

              {/* Ratings */}
              <div className="ratings-section">
                <h3>Évaluations</h3>
                <div className="ratings-grid">
                  <div className={`rating-card ${getRatingClass(report.summary?.reliabilityRating)}`}>
                    <span className="rating-value">{report.summary?.reliabilityRating || '-'}</span>
                    <span className="rating-label">Fiabilité</span>
                  </div>
                  <div className={`rating-card ${getRatingClass(report.summary?.securityRating)}`}>
                    <span className="rating-value">{report.summary?.securityRating || '-'}</span>
                    <span className="rating-label">Sécurité</span>
                  </div>
                  <div className={`rating-card ${getRatingClass(report.summary?.maintainabilityRating)}`}>
                    <span className="rating-value">{report.summary?.maintainabilityRating || '-'}</span>
                    <span className="rating-label">Maintenabilité</span>
                  </div>
                </div>
              </div>

              {/* Issues Summary */}
              {report.issues && (
                <div className="issues-summary">
                  <h3>Problèmes détectés</h3>
                  <div className="issues-grid">
                    <div className="issue-card critical">
                      <span className="issue-count">{report.issues.critical}</span>
                      <span className="issue-label">Critiques</span>
                    </div>
                    <div className="issue-card major">
                      <span className="issue-count">{report.issues.major}</span>
                      <span className="issue-label">Majeurs</span>
                    </div>
                    <div className="issue-card minor">
                      <span className="issue-count">{report.issues.minor}</span>
                      <span className="issue-label">Mineurs</span>
                    </div>
                    <div className="issue-card total">
                      <span className="issue-count">{report.issues.total}</span>
                      <span className="issue-label">Total</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="error-card">
              <h3>❌ Erreur</h3>
              <p>{report.error || 'Impossible de récupérer le rapport'}</p>
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="help-section">
        <h3>💡 Aide</h3>
        <div className="help-content">
          <p>
            Les analyses SonarQube sont automatiquement exécutées lors de chaque pipeline CI/CD.
            Vous pouvez consulter les résultats détaillés ici ou directement dans l'interface SonarQube.
          </p>
          <p>
            <strong>Format de la clé de projet :</strong> cicd-[nom-du-repo]-[branche]
          </p>
        </div>
      </div>
    </div>
  )
}
