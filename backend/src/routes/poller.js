/**
 * Git Polling Routes
 * API pour contrôler le service de polling GitHub
 */

const express = require('express')
const router = express.Router()

/**
 * GET /api/poller/status
 * Retourne le statut actuel du poller
 */
router.get('/status', (req, res) => {
  const poller = req.app.get('gitPoller')
  
  if (!poller) {
    return res.status(503).json({ 
      error: 'Git Poller not initialized',
      isRunning: false
    })
  }

  res.json(poller.getStatus())
})

/**
 * POST /api/poller/start
 * Démarre le poller
 */
router.post('/start', async (req, res) => {
  const poller = req.app.get('gitPoller')
  
  if (!poller) {
    return res.status(503).json({ error: 'Git Poller not initialized' })
  }

  try {
    await poller.start()
    res.json({ 
      message: 'Git Poller started',
      status: poller.getStatus()
    })
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to start Git Poller',
      message: error.message
    })
  }
})

/**
 * POST /api/poller/stop
 * Arrête le poller
 */
router.post('/stop', (req, res) => {
  const poller = req.app.get('gitPoller')
  
  if (!poller) {
    return res.status(503).json({ error: 'Git Poller not initialized' })
  }

  poller.stop()
  res.json({ 
    message: 'Git Poller stopped',
    status: poller.getStatus()
  })
})

/**
 * POST /api/poller/check
 * Force une vérification immédiate
 */
router.post('/check', async (req, res) => {
  const poller = req.app.get('gitPoller')
  
  if (!poller) {
    return res.status(503).json({ error: 'Git Poller not initialized' })
  }

  try {
    const result = await poller.forceCheck()
    res.json({ 
      message: 'Check completed',
      ...result,
      status: poller.getStatus()
    })
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to check for new commits',
      message: error.message
    })
  }
})

/**
 * PUT /api/poller/interval
 * Modifie l'intervalle de polling
 */
router.put('/interval', (req, res) => {
  const poller = req.app.get('gitPoller')
  const { interval } = req.body

  if (!poller) {
    return res.status(503).json({ error: 'Git Poller not initialized' })
  }

  if (!interval || interval < 10000) {
    return res.status(400).json({ 
      error: 'Invalid interval',
      message: 'Interval must be at least 10000ms (10 seconds)'
    })
  }

  // Arrêter et redémarrer avec le nouvel intervalle
  const wasRunning = poller.isRunning
  poller.stop()
  poller.pollInterval = interval
  
  if (wasRunning) {
    poller.start()
  }

  res.json({ 
    message: `Interval updated to ${interval}ms`,
    status: poller.getStatus()
  })
})

module.exports = router
