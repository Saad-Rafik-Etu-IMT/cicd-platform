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
app.use(express.json())

// Make io available to routes
app.set('io', io)

// Routes
const pipelinesRouter = require('./routes/pipelines')
const webhooksRouter = require('./routes/webhooks')

app.use('/api/pipelines', pipelinesRouter)
app.use('/api/webhooks', webhooksRouter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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
