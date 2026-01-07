require('dotenv').config()
const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

// Middleware
app.use(cors())

// Custom JSON parser that preserves raw body for webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    req.rawBody = buf
  }
}))

// Make io available to routes
app.set('io', io)

// Routes
const pipelinesRouter = require('./routes/pipelines')
const webhooksRouter = require('./routes/webhooks')
const vmRouter = require('./routes/vm')
const envVariablesRouter = require('./routes/envVariables')
const authRouter = require('./routes/auth')
const sonarRouter = require('./routes/sonar')
const pentestRouter = require('./routes/pentest')

// Auth routes (no authentication required for OAuth flow)
app.use('/api/auth', authRouter)

// Protected routes
app.use('/api/pipelines', pipelinesRouter)
app.use('/api/webhooks', webhooksRouter)
app.use('/api/vm', vmRouter)
app.use('/api/env', envVariablesRouter)
app.use('/api/sonar', sonarRouter)
app.use('/api/pentest', pentestRouter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('🔴 Unhandled error:', err.stack)
  
  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message
  
  res.status(err.status || 500).json({ 
    error: message,
    timestamp: new Date().toISOString()
  })
})

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('subscribe', (pipelineId) => {
    socket.join(pipelineId)
    console.log(`Client ${socket.id} subscribed to ${pipelineId}`)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 CI/CD Backend running on port ${PORT}`)
})

module.exports = { app, io }
