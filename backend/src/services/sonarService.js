const axios = require('axios')
const { exec } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs').promises

const execAsync = promisify(exec)

// SonarQube configuration
const SONAR_URL = process.env.SONAR_URL || 'http://sonarqube:9000'
const SONAR_EXTERNAL_URL = process.env.SONAR_EXTERNAL_URL || 'http://localhost:9001'
const SONAR_TOKEN = process.env.SONAR_TOKEN || ''

class SonarService {
  constructor() {
    this.baseUrl = SONAR_URL
    this.externalUrl = SONAR_EXTERNAL_URL
    this.token = SONAR_TOKEN
  }

  /**
   * Get axios config with authentication
   */
  getAuthConfig() {
    if (this.token) {
      return {
        auth: {
          username: this.token,
          password: ''
        }
      }
    }
    return {}
  }

  /**
   * Check if SonarQube is available
   */
  async isAvailable() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/system/status`,
        { timeout: 5000 }
      )
      return response.data.status === 'UP'
    } catch (error) {
      console.error('SonarQube not available:', error.message)
      return false
    }
  }

  /**
   * Get SonarQube system status
   */
  async getStatus() {
    try {
      console.log('Attempting to connect to SonarQube at:', this.baseUrl)
      const response = await axios.get(
        `${this.baseUrl}/api/system/status`,
        {
          ...this.getAuthConfig(),
          timeout: 10000
        }
      )
      console.log('SonarQube status response:', response.data)
      return {
        available: true,
        status: response.data.status,
        version: response.data.version
      }
    } catch (error) {
      console.error('Error getting SonarQube status:', {
        message: error.message,
        code: error.code,
        response: error.response?.status,
        url: this.baseUrl
      })
      return {
        available: false,
        error: error.message
      }
    }
  }

  /**
   * Create or update a project in SonarQube
   */
  async createProject(projectKey, projectName) {
    try {
      // Check if project exists
      const exists = await this.projectExists(projectKey)
      if (exists) {
        return { success: true, message: 'Project already exists', projectKey }
      }

      // Create new project
      const response = await axios.post(
        `${this.baseUrl}/api/projects/create`,
        null,
        {
          ...this.getAuthConfig(),
          params: {
            project: projectKey,
            name: projectName
          }
        }
      )
      
      return { 
        success: true, 
        message: 'Project created',
        projectKey: response.data.project?.key || projectKey
      }
    } catch (error) {
      console.error('Error creating SonarQube project:', error.message)
      return { 
        success: false, 
        error: error.response?.data?.errors?.[0]?.msg || error.message 
      }
    }
  }

  /**
   * Check if a project exists
   */
  async projectExists(projectKey) {
    try {
      await axios.get(
        `${this.baseUrl}/api/projects/search`,
        {
          ...this.getAuthConfig(),
          params: { projects: projectKey }
        }
      )
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Run SonarQube analysis using sonar-scanner CLI
   * For projects without Maven/Gradle
   */
  async runAnalysis(projectDir, projectKey, options = {}) {
    const {
      projectName = projectKey,
      sources = 'src',
      exclusions = '**/node_modules/**,**/test/**,**/tests/**,**/*.test.js,**/*.spec.js',
      language = null
    } = options

    // Create sonar-project.properties if not exists
    const sonarPropsPath = path.join(projectDir, 'sonar-project.properties')
    
    try {
      await fs.access(sonarPropsPath)
    } catch {
      // Create properties file
      const props = [
        `sonar.projectKey=${projectKey}`,
        `sonar.projectName=${projectName}`,
        `sonar.sources=${sources}`,
        `sonar.exclusions=${exclusions}`,
        `sonar.host.url=${this.baseUrl}`,
        this.token ? `sonar.token=${this.token}` : '',
        language ? `sonar.language=${language}` : ''
      ].filter(Boolean).join('\n')
      
      await fs.writeFile(sonarPropsPath, props)
    }

    // Run sonar-scanner
    try {
      const { stdout, stderr } = await execAsync(
        `cd ${projectDir} && sonar-scanner`,
        { timeout: 600000 } // 10 minutes
      )
      
      return {
        success: true,
        output: stdout,
        warnings: stderr
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || ''
      }
    }
  }

  /**
   * Run Maven SonarQube analysis
   */
  async runMavenAnalysis(projectDir, projectKey) {
    const sonarParams = [
      `-Dsonar.host.url=${this.baseUrl}`,
      `-Dsonar.projectKey=${projectKey}`,
      this.token ? `-Dsonar.token=${this.token}` : ''
    ].filter(Boolean).join(' ')

    try {
      const { stdout } = await execAsync(
        `cd ${projectDir} && ./mvnw sonar:sonar ${sonarParams}`,
        { timeout: 600000 }
      )
      return { success: true, output: stdout }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Run Gradle SonarQube analysis
   */
  async runGradleAnalysis(projectDir, projectKey) {
    const sonarParams = [
      `-Dsonar.host.url=${this.baseUrl}`,
      `-Dsonar.projectKey=${projectKey}`,
      this.token ? `-Dsonar.token=${this.token}` : ''
    ].filter(Boolean).join(' ')

    try {
      const { stdout } = await execAsync(
        `cd ${projectDir} && ./gradlew sonarqube ${sonarParams}`,
        { timeout: 600000 }
      )
      return { success: true, output: stdout }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Get project analysis results
   */
  async getProjectMetrics(projectKey) {
    try {
      const metricsToFetch = [
        'bugs',
        'vulnerabilities',
        'code_smells',
        'coverage',
        'duplicated_lines_density',
        'ncloc',
        'sqale_rating',
        'reliability_rating',
        'security_rating',
        'sqale_index'
      ].join(',')

      const response = await axios.get(
        `${this.baseUrl}/api/measures/component`,
        {
          ...this.getAuthConfig(),
          params: {
            component: projectKey,
            metricKeys: metricsToFetch
          }
        }
      )

      const measures = response.data.component?.measures || []
      const metrics = {}
      
      measures.forEach(m => {
        metrics[m.metric] = m.value
      })

      return {
        success: true,
        projectKey,
        metrics,
        dashboardUrl: `${this.externalUrl}/dashboard?id=${projectKey}`
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.msg || error.message
      }
    }
  }

  /**
   * Get Quality Gate status for a project
   */
  async getQualityGateStatus(projectKey) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/qualitygates/project_status`,
        {
          ...this.getAuthConfig(),
          params: { projectKey }
        }
      )

      const status = response.data.projectStatus
      return {
        success: true,
        status: status.status, // OK, WARN, ERROR, NONE
        conditions: status.conditions || [],
        dashboardUrl: `${this.externalUrl}/dashboard?id=${projectKey}`
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.msg || error.message
      }
    }
  }

  /**
   * Get issues for a project
   */
  async getProjectIssues(projectKey, options = {}) {
    const { 
      types = 'BUG,VULNERABILITY,CODE_SMELL',
      severities = null,
      page = 1,
      pageSize = 20
    } = options

    try {
      const params = {
        componentKeys: projectKey,
        types,
        p: page,
        ps: pageSize
      }
      if (severities) params.severities = severities

      const response = await axios.get(
        `${this.baseUrl}/api/issues/search`,
        {
          ...this.getAuthConfig(),
          params
        }
      )

      return {
        success: true,
        total: response.data.total,
        issues: response.data.issues,
        paging: response.data.paging
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.msg || error.message
      }
    }
  }

  /**
   * Generate analysis report summary
   */
  async generateReport(projectKey) {
    const [metrics, qualityGate, issues] = await Promise.all([
      this.getProjectMetrics(projectKey),
      this.getQualityGateStatus(projectKey),
      this.getProjectIssues(projectKey, { pageSize: 100 })
    ])

    if (!metrics.success) {
      return { success: false, error: 'Failed to fetch metrics' }
    }

    const m = metrics.metrics
    
    // Rating conversion (1-5 to A-E)
    const ratingToGrade = (rating) => {
      const grades = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' }
      return grades[rating] || rating
    }

    return {
      success: true,
      projectKey,
      qualityGate: {
        status: qualityGate.status,
        passed: qualityGate.status === 'OK'
      },
      summary: {
        bugs: parseInt(m.bugs) || 0,
        vulnerabilities: parseInt(m.vulnerabilities) || 0,
        codeSmells: parseInt(m.code_smells) || 0,
        coverage: parseFloat(m.coverage) || 0,
        duplications: parseFloat(m.duplicated_lines_density) || 0,
        linesOfCode: parseInt(m.ncloc) || 0,
        maintainabilityRating: ratingToGrade(m.sqale_rating),
        reliabilityRating: ratingToGrade(m.reliability_rating),
        securityRating: ratingToGrade(m.security_rating),
        technicalDebt: m.sqale_index || '0'
      },
      issues: {
        total: issues.total || 0,
        critical: issues.issues?.filter(i => i.severity === 'CRITICAL').length || 0,
        major: issues.issues?.filter(i => i.severity === 'MAJOR').length || 0,
        minor: issues.issues?.filter(i => i.severity === 'MINOR').length || 0
      },
      dashboardUrl: `${this.externalUrl}/dashboard?id=${projectKey}`
    }
  }

  /**
   * Simulate SonarQube analysis (for demo mode)
   */
  simulateAnalysis(projectKey) {
    return {
      success: true,
      projectKey,
      qualityGate: {
        status: 'OK',
        passed: true
      },
      summary: {
        bugs: Math.floor(Math.random() * 5),
        vulnerabilities: Math.floor(Math.random() * 3),
        codeSmells: Math.floor(Math.random() * 50) + 10,
        coverage: Math.floor(Math.random() * 30) + 65, // 65-95%
        duplications: Math.floor(Math.random() * 10) + 2,
        linesOfCode: Math.floor(Math.random() * 5000) + 1000,
        maintainabilityRating: 'A',
        reliabilityRating: 'A',
        securityRating: 'A',
        technicalDebt: `${Math.floor(Math.random() * 4) + 1}h`
      },
      issues: {
        total: Math.floor(Math.random() * 50) + 10,
        critical: Math.floor(Math.random() * 2),
        major: Math.floor(Math.random() * 10),
        minor: Math.floor(Math.random() * 20)
      },
      dashboardUrl: `${this.externalUrl}/dashboard?id=${projectKey}`
    }
  }
}

module.exports = new SonarService()
