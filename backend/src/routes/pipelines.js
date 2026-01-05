const express = require('express')
const router = express.Router()
const pool = require('../config/database')
const { executePipeline } = require('../services/pipelineExecutor')

// GET all pipelines
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

// GET single pipeline with logs
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

// POST trigger new pipeline
router.post('/trigger', async (req, res) => {
  try {
    const { repo_url, branch = 'master', commit_hash } = req.body
    
    if (!repo_url) {
      return res.status(400).json({ error: 'repo_url is required' })
    }
    
    // Create pipeline record
    const result = await pool.query(
      `INSERT INTO pipelines (repo_url, branch, commit_hash, status, trigger_type)
       VALUES ($1, $2, $3, 'pending', 'manual')
       RETURNING *`,
      [repo_url, branch, commit_hash || null]
    )
    
    const pipeline = result.rows[0]
    const io = req.app.get('io')
    
    // Start pipeline execution asynchronously
    executePipeline(pipeline, io).catch(err => {
      console.error('Pipeline execution failed:', err)
    })
    
    res.status(201).json({ pipeline })
  } catch (err) {
    console.error('Error triggering pipeline:', err)
    res.status(500).json({ error: 'Failed to trigger pipeline' })
  }
})

// POST rollback
router.post('/:id/rollback', async (req, res) => {
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
    
    io.to(`pipeline-${id}`).emit('rollback_started')
    
    // In a real scenario, this would SSH to VM and switch containers
    setTimeout(() => {
      io.to(`pipeline-${id}`).emit('rollback_completed', { 
        version: previousVersion 
      })
    }, 3000)
    
    res.json({ message: 'Rollback initiated', version: previousVersion })
  } catch (err) {
    console.error('Error during rollback:', err)
    res.status(500).json({ error: 'Failed to rollback' })
  }
})

module.exports = router
