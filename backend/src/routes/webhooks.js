const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const pool = require('../config/database')
const { executePipeline } = require('../services/pipelineExecutor')

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET

/**
 * Verify GitHub Webhook signature (HMAC-SHA256)
 * GitHub sends the signature in the X-Hub-Signature-256 header
 */
function verifyGitHubSignature(req, res, next) {
  // If no secret is configured, skip verification (development mode)
  if (!WEBHOOK_SECRET) {
    console.warn('⚠️  GITHUB_WEBHOOK_SECRET not configured - skipping signature verification')
    return next()
  }

  const signature = req.headers['x-hub-signature-256']
  
  if (!signature) {
    console.error('❌ Missing X-Hub-Signature-256 header')
    return res.status(401).json({ 
      error: 'Missing signature',
      message: 'X-Hub-Signature-256 header is required'
    })
  }

  // Get raw body for signature verification
  const rawBody = req.rawBody
  
  if (!rawBody) {
    console.error('❌ Raw body not available for signature verification')
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Raw body not available'
    })
  }

  // Calculate expected signature
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET)
  const digest = 'sha256=' + hmac.update(rawBody).digest('hex')

  // Constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'utf8')
  const digestBuffer = Buffer.from(digest, 'utf8')

  if (signatureBuffer.length !== digestBuffer.length) {
    console.error('❌ Invalid signature length')
    return res.status(401).json({ 
      error: 'Invalid signature',
      message: 'Webhook signature verification failed'
    })
  }

  if (!crypto.timingSafeEqual(signatureBuffer, digestBuffer)) {
    console.error('❌ Signature mismatch')
    console.error('   Expected:', digest)
    console.error('   Received:', signature)
    return res.status(401).json({ 
      error: 'Invalid signature',
      message: 'Webhook signature verification failed'
    })
  }

  console.log('✅ GitHub webhook signature verified')
  next()
}

/**
 * Verify GitHub Webhook signature for legacy SHA-1 (X-Hub-Signature)
 * Fallback for older GitHub Enterprise versions
 */
function verifyGitHubSignatureLegacy(req) {
  const signature = req.headers['x-hub-signature']
  if (!signature || !WEBHOOK_SECRET || !req.rawBody) {
    return false
  }

  const hmac = crypto.createHmac('sha1', WEBHOOK_SECRET)
  const digest = 'sha1=' + hmac.update(req.rawBody).digest('hex')
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(digest, 'utf8')
    )
  } catch {
    return false
  }
}

// GitHub webhook handler with signature verification
router.post('/github', verifyGitHubSignature, async (req, res) => {
  try {
    const event = req.headers['x-github-event']
    const deliveryId = req.headers['x-github-delivery']
    const payload = req.body
    
    console.log(`📨 Received GitHub webhook: ${event} (delivery: ${deliveryId})`)
    
    // Respond to ping events (used when setting up webhook)
    if (event === 'ping') {
      console.log('🏓 Ping received from GitHub')
      return res.json({ 
        message: 'Pong! Webhook configured successfully',
        zen: payload.zen,
        hook_id: payload.hook_id
      })
    }
    
    // Only process push events
    if (event !== 'push') {
      console.log(`ℹ️  Ignoring event: ${event}`)
      return res.json({ message: 'Event ignored', event })
    }
    
    // Skip if this is a branch/tag deletion (after is all zeros)
    if (payload.deleted || payload.after === '0000000000000000000000000000000000000000') {
      console.log('ℹ️  Ignoring branch/tag deletion')
      return res.json({ message: 'Deletion event ignored' })
    }
    
    const repoUrl = payload.repository?.clone_url
    const branch = payload.ref?.replace('refs/heads/', '')
    const commitHash = payload.after
    const pusher = payload.pusher?.name
    const commitMessage = payload.head_commit?.message || ''
    const repoName = payload.repository?.full_name
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'Invalid payload: missing repository URL' })
    }
    
    console.log(`🚀 Triggering pipeline for ${repoName}@${branch}`)
    console.log(`   Commit: ${commitHash?.substring(0, 7)} - ${commitMessage.split('\n')[0]}`)
    console.log(`   Pusher: ${pusher}`)
    
    // Create pipeline
    const result = await pool.query(
      `INSERT INTO pipelines (repo_url, branch, commit_hash, status, trigger_type)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [repoUrl, branch, commitHash, `webhook:github:${pusher}`]
    )
    
    const pipeline = result.rows[0]
    const io = req.app.get('io')
    
    // Notify connected clients about new pipeline
    io.emit('pipeline:created', { 
      id: pipeline.id, 
      repo: repoName,
      branch,
      trigger: 'GitHub Webhook'
    })
    
    // Execute pipeline asynchronously
    executePipeline(pipeline, io).catch(err => {
      console.error('Pipeline execution failed:', err)
    })
    
    res.status(201).json({ 
      message: 'Pipeline triggered successfully',
      pipeline_id: pipeline.id,
      repo: repoName,
      branch,
      commit: commitHash
    })
  } catch (err) {
    console.error('❌ Webhook error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

/**
 * Endpoint to verify webhook configuration
 * GET /api/webhooks/github/verify
 */
router.get('/github/verify', (req, res) => {
  res.json({
    configured: !!WEBHOOK_SECRET,
    message: WEBHOOK_SECRET 
      ? 'Webhook secret is configured' 
      : 'Warning: GITHUB_WEBHOOK_SECRET is not set'
  })
})

module.exports = router
