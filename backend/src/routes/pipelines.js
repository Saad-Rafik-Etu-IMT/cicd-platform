const express = require('express')
const router = express.Router()
const pool = require('../config/database')
const { executePipeline, rollbackPipeline } = require('../services/pipelineExecutor')
const { authenticateToken, requireRole } = require('../middleware/auth')

// All routes require authentication
router.use(authenticateToken)

// GET all pipelines - all authenticated users can view
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM pipelines ORDER BY created_at DESC LIMIT 50'
    )
    res.json({ pipelines: result.rows })
  } catch (err) {
    console.error('Error fetching pipelines:', err)
    res.status(500).json({ error: 'Failed to fetch pipelines' })
  }
})

// GET single pipeline with logs - all authenticated users can view
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const pipelineResult = await pool.query(
      'SELECT * FROM pipelines WHERE id = $1',
      [id]
    )
    
    if (pipelineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline not found' })
    }
    
    const logsResult = await pool.query(
      'SELECT * FROM pipeline_logs WHERE pipeline_id = $1 ORDER BY started_at',
      [id]
    )
    
    res.json({
      pipeline: pipelineResult.rows[0],
      logs: logsResult.rows
    })
  } catch (err) {
    console.error('Error fetching pipeline:', err)
    res.status(500).json({ error: 'Failed to fetch pipeline' })
  }
})

// POST trigger new pipeline - requires admin or developer role
router.post('/trigger', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const { repo_url, branch = 'master', commit_hash } = req.body
    
    if (!repo_url) {
      return res.status(400).json({ error: 'repo_url is required' })
    }
    
    // Create pipeline record with user info
    const result = await pool.query(
      `INSERT INTO pipelines (repo_url, branch, commit_hash, status, trigger_type, user_id)
       VALUES ($1, $2, $3, 'pending', 'manual', $4)
       RETURNING *`,
      [repo_url, branch, commit_hash || null, req.user.id]
    )
    
    const pipeline = result.rows[0]
    const io = req.app.get('io')
    
    // Start pipeline execution asynchronously
    executePipeline(pipeline, io).catch(err => {
      console.error('Pipeline execution failed:', err)
    })
    
    res.status(201).json({ pipeline, triggeredBy: req.user.username })
  } catch (err) {
    console.error('Error triggering pipeline:', err)
    res.status(500).json({ error: 'Failed to trigger pipeline' })
  }
})

// GET pipeline logs only - all authenticated users can view
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params
    
    const logsResult = await pool.query(
      'SELECT * FROM pipeline_logs WHERE pipeline_id = $1 ORDER BY step_order ASC',
      [id]
    )
    
    res.json({ logs: logsResult.rows })
  } catch (err) {
    console.error('Error fetching pipeline logs:', err)
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

// POST rollback - requires admin or developer role
router.post('/:id/rollback', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const { id } = req.params
    const io = req.app.get('io')
    
    // Get previous successful deployment
    const result = await pool.query(
      `SELECT * FROM deployments 
       WHERE status = 'success' 
       ORDER BY deployed_at DESC 
       LIMIT 1 OFFSET 1`
    )
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No previous deployment to rollback to' })
    }
    
    const previousVersion = result.rows[0].docker_image
    
    // Execute rollback
    await rollbackPipeline(id, previousVersion, io)
    
    res.json({ message: 'Rollback initiated', version: previousVersion })
  } catch (err) {
    console.error('Error during rollback:', err)
    res.status(500).json({ error: 'Failed to rollback' })
  }
})

module.exports = router
