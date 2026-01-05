const express = require('express')
const router = express.Router()
const pool = require('../config/database')
const { executePipeline } = require('../services/pipelineExecutor')

// GitHub webhook handler
router.post('/github', async (req, res) => {
  try {
    const event = req.headers['x-github-event']
    const payload = req.body
    
    console.log(`Received GitHub webhook: ${event}`)
    
    // Only process push events
    if (event !== 'push') {
      return res.json({ message: 'Event ignored', event })
    }
    
    const repoUrl = payload.repository?.clone_url
    const branch = payload.ref?.replace('refs/heads/', '')
    const commitHash = payload.after
    const pusher = payload.pusher?.name
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'Invalid payload' })
    }
    
    // Create pipeline
    const result = await pool.query(
      `INSERT INTO pipelines (repo_url, branch, commit_hash, status, triggered_by)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [repoUrl, branch, commitHash, `github:${pusher}`]
    )
    
    const pipeline = result.rows[0]
    const io = req.app.get('io')
    
    // Execute pipeline
    executePipeline(pipeline, io).catch(err => {
      console.error('Pipeline execution failed:', err)
    })
    
    res.status(201).json({ 
      message: 'Pipeline triggered',
      pipeline_id: pipeline.id 
    })
  } catch (err) {
    console.error('Webhook error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

module.exports = router
