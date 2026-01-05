const pool = require('../config/database')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

const STEPS = [
  'Clone Repository',
  'Run Tests',
  'Build Package',
  'SonarQube Analysis',
  'Build Docker Image',
  'Deploy to VM',
  'Health Check'
]

async function executePipeline(pipeline, io) {
  const pipelineRoom = `pipeline-${pipeline.id}`
  
  try {
    // Update status to running
    await pool.query(
      'UPDATE pipelines SET status = $1, started_at = NOW() WHERE id = $2',
      ['running', pipeline.id]
    )
    
    io.to(pipelineRoom).emit('pipeline_started', { id: pipeline.id })
    
    for (const step of STEPS) {
      await executeStep(pipeline, step, io, pipelineRoom)
    }
    
    // Pipeline completed successfully
    await pool.query(
      'UPDATE pipelines SET status = $1, finished_at = NOW() WHERE id = $2',
      ['success', pipeline.id]
    )
    
    // Record deployment
    await pool.query(
      `INSERT INTO deployments (pipeline_id, docker_image, status)
       VALUES ($1, $2, 'success')`,
      [pipeline.id, `bfb-management:${pipeline.commit_hash || 'latest'}`]
    )
    
    io.to(pipelineRoom).emit('pipeline_completed', { id: pipeline.id })
    
  } catch (error) {
    // Pipeline failed
    await pool.query(
      'UPDATE pipelines SET status = $1, finished_at = NOW() WHERE id = $2',
      ['failed', pipeline.id]
    )
    
    io.to(pipelineRoom).emit('pipeline_failed', { 
      id: pipeline.id, 
      error: error.message 
    })
    
    throw error
  }
}

async function executeStep(pipeline, stepName, io, room) {
  const startTime = new Date()
  
  // Emit step started
  io.to(room).emit('step_started', { step: stepName })
  
  // Log step start
  await pool.query(
    `INSERT INTO pipeline_logs (pipeline_id, step_name, status, started_at)
     VALUES ($1, $2, 'running', $3)`,
    [pipeline.id, stepName, startTime]
  )
  
  try {
    // Simulate step execution (in real implementation, run actual commands)
    const output = await simulateStep(stepName, pipeline)
    
    // Update log with success
    await pool.query(
      `UPDATE pipeline_logs 
       SET status = 'success', output = $1, finished_at = NOW()
       WHERE pipeline_id = $2 AND step_name = $3`,
      [output, pipeline.id, stepName]
    )
    
    io.to(room).emit('step_completed', { step: stepName, output })
    
  } catch (error) {
    // Update log with failure
    await pool.query(
      `UPDATE pipeline_logs 
       SET status = 'failed', output = $1, finished_at = NOW()
       WHERE pipeline_id = $2 AND step_name = $3`,
      [error.message, pipeline.id, stepName]
    )
    
    io.to(room).emit('step_failed', { step: stepName, error: error.message })
    
    throw error
  }
}

async function simulateStep(stepName, pipeline) {
  // Simulate step duration
  const duration = 1000 + Math.random() * 2000
  await new Promise(resolve => setTimeout(resolve, duration))
  
  // Simulate step output
  switch (stepName) {
    case 'Clone Repository':
      return `Cloned ${pipeline.repo_url} (branch: ${pipeline.branch})`
    
    case 'Run Tests':
      return 'Tests passed: 117/117 ✓'
    
    case 'Build Package':
      return 'BUILD SUCCESS - bfb-management-0.0.1-SNAPSHOT.jar'
    
    case 'SonarQube Analysis':
      return 'Quality Gate: PASSED - Coverage: 85%'
    
    case 'Build Docker Image':
      return `Built image: bfb-management:${pipeline.commit_hash || 'latest'}`
    
    case 'Deploy to VM':
      return 'Container deployed and running on VM'
    
    case 'Health Check':
      return 'Health check passed: HTTP 200 OK'
    
    default:
      return 'Step completed'
  }
}

module.exports = { executePipeline }
