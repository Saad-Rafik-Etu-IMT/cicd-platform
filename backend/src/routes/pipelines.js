const express = require('express')
const router = express.Router()
const pool = require('../config/database')
const { executePipeline, rollbackPipeline, cancelPipeline, isPipelineRunning, getRunningPipelines } = require('../services/pipelineExecutor')
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
    
    // Check if a deployment is already in progress
    const { isDeploymentLocked, getDeploymentLockStatus } = require('../services/pipelineExecutor')
    
    if (isDeploymentLocked()) {
      const lockStatus = getDeploymentLockStatus()
      return res.status(409).json({ 
        error: `Une opération ${lockStatus.operation} est déjà en cours ` +
               `(Pipeline #${lockStatus.pipelineId}, démarrée il y a ${lockStatus.elapsedSeconds}s). ` +
               `Veuillez patienter.`
      })
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
    
    // Get current deployment to rollback from
    const currentResult = await pool.query(
      `SELECT id, docker_image FROM deployments 
       WHERE status = 'success' AND rolled_back_at IS NULL
       ORDER BY deployed_at DESC 
       LIMIT 1`
    )
    
    // Get previous successful deployment to rollback to
    // Exclude rollback deployments to prevent rolling back to a rollback
    const targetResult = await pool.query(
      `SELECT * FROM deployments 
       WHERE status = 'success' 
         AND rolled_back_at IS NULL 
         AND (is_rollback IS NULL OR is_rollback = false)
       ORDER BY deployed_at DESC 
       LIMIT 1 OFFSET 1`
    )
    
    if (targetResult.rows.length === 0) {
      return res.status(400).json({ error: 'No previous deployment to rollback to' })
    }
    
    const targetDeployment = targetResult.rows[0]
    const previousVersion = targetDeployment.docker_image
    
    // Validate image format before executing
    if (!/^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/.test(previousVersion)) {
      return res.status(400).json({ error: 'Invalid image format in database' })
    }
    
    // Execute rollback
    await rollbackPipeline(id, previousVersion, io)
    
    // Mark current deployment as rolled back
    if (currentResult.rows.length > 0) {
      await pool.query(
        `UPDATE deployments 
         SET rolled_back_at = NOW() 
         WHERE id = $1`,
        [currentResult.rows[0].id]
      )
    }
    
    // Create rollback deployment record
    await pool.query(
      `INSERT INTO deployments (
        pipeline_id, docker_image, commit_hash, commit_message, 
        status, is_rollback, rolled_back_from, deployed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        id,
        targetDeployment.docker_image,
        targetDeployment.commit_hash,
        `Rollback to: ${targetDeployment.commit_message}`,
        'success',
        true,
        currentResult.rows[0]?.id || null
      ]
    )
    
    res.json({ message: 'Rollback completed', version: previousVersion })
  } catch (err) {
    console.error('Error during rollback:', err)
    res.status(500).json({ error: err.message || 'Failed to rollback' })
  }
})

// POST cancel running pipeline - requires admin or developer role
router.post('/:id/cancel', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const pipelineId = parseInt(req.params.id)
    const io = req.app.get('io')
    
    // Check if pipeline is running
    if (!isPipelineRunning(pipelineId)) {
      // Check database for current status
      const result = await pool.query('SELECT status FROM pipelines WHERE id = $1', [pipelineId])
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Pipeline not found' })
      }
      const status = result.rows[0].status
      if (status !== 'running' && status !== 'pending') {
        return res.status(400).json({ error: `Pipeline is not running (status: ${status})` })
      }
      // Pipeline might have just finished, update status anyway
    }
    
    // Cancel the pipeline
    const cancelled = cancelPipeline(pipelineId)
    
    // Update database status
    await pool.query(
      'UPDATE pipelines SET status = $1, completed_at = NOW() WHERE id = $2',
      ['cancelled', pipelineId]
    )
    
    // Emit cancellation event
    const room = `pipeline-${pipelineId}`
    io.to(room).emit('pipeline_cancelled', { id: pipelineId })
    io.emit('pipeline:cancelled', { id: pipelineId })
    
    console.log(`🛑 Pipeline ${pipelineId} cancelled by user ${req.user.username}`)
    
    res.json({ 
      message: 'Pipeline cancelled', 
      pipelineId, 
      cancelledBy: req.user.username 
    })
  } catch (err) {
    console.error('Error cancelling pipeline:', err)
    res.status(500).json({ error: 'Failed to cancel pipeline' })
  }
})

// GET running pipelines - all authenticated users can view
router.get('/status/running', async (req, res) => {
  try {
    const runningIds = getRunningPipelines()
    
    // Also get from database for accuracy
    const result = await pool.query(
      "SELECT id, repo_url, branch, status, started_at FROM pipelines WHERE status IN ('running', 'pending') ORDER BY started_at DESC"
    )
    
    res.json({ 
      running: result.rows,
      inMemory: runningIds
    })
  } catch (err) {
    console.error('Error fetching running pipelines:', err)
    res.status(500).json({ error: 'Failed to fetch running pipelines' })
  }
})

module.exports = router
