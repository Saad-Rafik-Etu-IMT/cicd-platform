const express = require('express')
const router = express.Router()
const pool = require('../config/database')
const { authenticateToken, requireRole } = require('../middleware/auth')

// All deployment routes require authentication
router.use(authenticateToken)

/**
 * GET /api/deployments/current
 * Get the current active deployment in production
 */
router.get('/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.id,
        d.pipeline_id,
        d.docker_image,
        d.commit_hash,
        d.commit_message,
        d.status,
        d.is_rollback,
        d.rolled_back_from,
        d.deployed_at,
        p.branch,
        p.repo_url
      FROM deployments d
      LEFT JOIN pipelines p ON d.pipeline_id = p.id
      WHERE d.status = 'success' 
        AND d.rolled_back_at IS NULL
      ORDER BY d.deployed_at DESC
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      return res.json({ 
        current: null,
        message: 'No active deployment found'
      })
    }

    const deployment = result.rows[0]
    
    res.json({
      current: {
        id: deployment.id,
        pipelineId: deployment.pipeline_id,
        dockerImage: deployment.docker_image,
        commitHash: deployment.commit_hash,
        commitMessage: deployment.commit_message,
        branch: deployment.branch,
        isRollback: deployment.is_rollback,
        rolledBackFrom: deployment.rolled_back_from,
        deployedAt: deployment.deployed_at
      }
    })
  } catch (err) {
    console.error('Error fetching current deployment:', err)
    res.status(500).json({ error: 'Failed to fetch current deployment' })
  }
})

/**
 * GET /api/deployments/history
 * Get deployment history with rollback information
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10

    const result = await pool.query(`
      SELECT 
        d.id,
        d.pipeline_id,
        d.docker_image,
        d.commit_hash,
        d.commit_message,
        d.status,
        d.is_rollback,
        d.rolled_back_from,
        d.rolled_back_at,
        d.deployed_at,
        p.branch,
        p.status as pipeline_status
      FROM deployments d
      LEFT JOIN pipelines p ON d.pipeline_id = p.id
      ORDER BY d.deployed_at DESC
      LIMIT $1
    `, [limit])

    const deployments = result.rows.map(d => ({
      id: d.id,
      pipelineId: d.pipeline_id,
      dockerImage: d.docker_image,
      commitHash: d.commit_hash,
      commitMessage: d.commit_message,
      status: d.rolled_back_at ? 'rolled_back' : d.status,
      branch: d.branch,
      pipelineStatus: d.pipeline_status,
      isRollback: d.is_rollback,
      rolledBackFrom: d.rolled_back_from,
      rolledBackAt: d.rolled_back_at,
      deployedAt: d.deployed_at
    }))

    res.json({ deployments })
  } catch (err) {
    console.error('Error fetching deployment history:', err)
    res.status(500).json({ error: 'Failed to fetch deployment history' })
  }
})

/**
 * GET /api/deployments/:id
 * Get a specific deployment
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(`
      SELECT 
        d.*,
        p.branch,
        p.repo_url,
        p.status as pipeline_status
      FROM deployments d
      LEFT JOIN pipelines p ON d.pipeline_id = p.id
      WHERE d.id = $1
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deployment not found' })
    }

    res.json({ deployment: result.rows[0] })
  } catch (err) {
    console.error('Error fetching deployment:', err)
    res.status(500).json({ error: 'Failed to fetch deployment' })
  }
})

module.exports = router
