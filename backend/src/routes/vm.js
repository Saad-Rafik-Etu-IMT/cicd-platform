const express = require('express')
const router = express.Router()
const sshService = require('../services/sshService')
const { authenticateToken, requireRole } = require('../middleware/auth')

// All VM routes require authentication
router.use(authenticateToken)

// GET VM status - requires at least viewer role
router.get('/status', async (req, res) => {
  try {
    const [connectionOk, containerStatus, isHealthy] = await Promise.all([
      sshService.testConnection(),
      sshService.getContainerStatus(),
      sshService.healthCheck()
    ])

    res.json({
      vm: {
        connected: connectionOk,
        host: process.env.VM_HOST || 'not configured'
      },
      container: {
        status: containerStatus,
        healthy: isHealthy
      }
    })
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to get VM status',
      details: err.message 
    })
  }
})

// GET container logs
router.get('/logs', async (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 50
    const logs = await sshService.getLogs(lines)
    res.json({ logs })
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to get logs',
      details: err.message 
    })
  }
})

// POST test connection
router.post('/test-connection', async (req, res) => {
  try {
    const isConnected = await sshService.testConnection()
    res.json({ 
      success: isConnected,
      message: isConnected ? 'SSH connection successful' : 'SSH connection failed'
    })
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// POST manual rollback - requires developer or admin role
router.post('/rollback', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const result = await sshService.rollback()
    res.json({ 
      success: true,
      output: result.output 
    })
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

module.exports = router
