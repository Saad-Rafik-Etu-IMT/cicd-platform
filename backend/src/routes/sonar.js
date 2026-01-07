const express = require('express')
const router = express.Router()
const sonarService = require('../services/sonarService')
const { authenticateToken, requireRole } = require('../middleware/auth')

// All routes require authentication
router.use(authenticateToken)

/**
 * GET /api/sonar/status
 * Get SonarQube server status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await sonarService.getStatus()
    res.json(status)
  } catch (error) {
    console.error('Error getting SonarQube status:', error)
    res.status(500).json({ 
      available: false, 
      error: 'Failed to connect to SonarQube' 
    })
  }
})

/**
 * GET /api/sonar/projects/:projectKey/metrics
 * Get metrics for a specific project
 */
router.get('/projects/:projectKey/metrics', async (req, res) => {
  try {
    const { projectKey } = req.params
    const metrics = await sonarService.getProjectMetrics(projectKey)
    res.json(metrics)
  } catch (error) {
    console.error('Error getting project metrics:', error)
    res.status(500).json({ error: 'Failed to fetch metrics' })
  }
})

/**
 * GET /api/sonar/projects/:projectKey/quality-gate
 * Get Quality Gate status for a project
 */
router.get('/projects/:projectKey/quality-gate', async (req, res) => {
  try {
    const { projectKey } = req.params
    const status = await sonarService.getQualityGateStatus(projectKey)
    res.json(status)
  } catch (error) {
    console.error('Error getting quality gate:', error)
    res.status(500).json({ error: 'Failed to fetch quality gate status' })
  }
})

/**
 * GET /api/sonar/projects/:projectKey/issues
 * Get issues for a project
 */
router.get('/projects/:projectKey/issues', async (req, res) => {
  try {
    const { projectKey } = req.params
    const { types, severities, page, pageSize } = req.query
    
    const issues = await sonarService.getProjectIssues(projectKey, {
      types,
      severities,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    res.json(issues)
  } catch (error) {
    console.error('Error getting issues:', error)
    res.status(500).json({ error: 'Failed to fetch issues' })
  }
})

/**
 * GET /api/sonar/projects/:projectKey/report
 * Get full analysis report for a project
 */
router.get('/projects/:projectKey/report', async (req, res) => {
  try {
    const { projectKey } = req.params
    const report = await sonarService.generateReport(projectKey)
    res.json(report)
  } catch (error) {
    console.error('Error generating report:', error)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

/**
 * POST /api/sonar/projects
 * Create a new SonarQube project (admin/developer only)
 */
router.post('/projects', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const { projectKey, projectName } = req.body
    
    if (!projectKey || !projectName) {
      return res.status(400).json({ 
        error: 'projectKey and projectName are required' 
      })
    }
    
    const result = await sonarService.createProject(projectKey, projectName)
    res.json(result)
  } catch (error) {
    console.error('Error creating project:', error)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

/**
 * GET /api/sonar/config
 * Get SonarQube configuration (for frontend)
 */
router.get('/config', (req, res) => {
  res.json({
    url: process.env.SONAR_EXTERNAL_URL || 'http://localhost:9001',
    configured: !!process.env.SONAR_TOKEN
  })
})

module.exports = router
