const pool = require('../config/database')
const sshService = require('./sshService')
const sonarService = require('./sonarService')
const { exec } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs').promises

const execAsync = promisify(exec)

// Mode: 'simulate' for demo, 'real' for production
const MODE = process.env.PIPELINE_MODE || 'simulate'
const WORKSPACE = process.env.WORKSPACE_DIR || '/tmp/pipelines'

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
    
    // Emit to room and broadcast globally for notifications
    io.to(pipelineRoom).emit('pipeline_started', { id: pipeline.id })
    io.emit('pipeline:started', { id: pipeline.id })
    
    for (const step of STEPS) {
      await executeStep(pipeline, step, io, pipelineRoom)
    }
    
    // Pipeline completed successfully
    await pool.query(
      'UPDATE pipelines SET status = $1, completed_at = NOW() WHERE id = $2',
      ['success', pipeline.id]
    )
    
    // Record deployment
    await pool.query(
      `INSERT INTO deployments (pipeline_id, docker_image, status)
       VALUES ($1, $2, 'success')`,
      [pipeline.id, `bfb-management:${pipeline.commit_hash || 'latest'}`]
    )
    
    // Emit to room and broadcast globally for notifications
    io.to(pipelineRoom).emit('pipeline_completed', { id: pipeline.id })
    io.emit('pipeline:completed', { id: pipeline.id })
    
  } catch (error) {
    // Pipeline failed
    await pool.query(
      'UPDATE pipelines SET status = $1, completed_at = NOW() WHERE id = $2',
      ['failed', pipeline.id]
    )
    
    // Emit to room and broadcast globally for notifications
    io.to(pipelineRoom).emit('pipeline_failed', { 
      id: pipeline.id, 
      error: error.message 
    })
    io.emit('pipeline:failed', { id: pipeline.id, error: error.message })
    
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
    // Execute step (simulate or real based on MODE)
    const output = await runStep(stepName, pipeline)
    
    // Update log with success
    await pool.query(
      `UPDATE pipeline_logs 
       SET status = 'success', output = $1, completed_at = NOW()
       WHERE pipeline_id = $2 AND step_name = $3`,
      [output, pipeline.id, stepName]
    )
    
    io.to(room).emit('step_completed', { step: stepName, output })
    
  } catch (error) {
    // Update log with failure
    await pool.query(
      `UPDATE pipeline_logs 
       SET status = 'failed', output = $1, completed_at = NOW()
       WHERE pipeline_id = $2 AND step_name = $3`,
      [error.message, pipeline.id, stepName]
    )
    
    io.to(room).emit('step_failed', { step: stepName, error: error.message })
    
    throw error
  }
}

// ============================================
// REAL EXECUTION (Production)
// ============================================
async function executeRealStep(stepName, pipeline) {
  const workDir = path.join(WORKSPACE, `pipeline-${pipeline.id}`)
  const dockerImage = `bfb-management:${pipeline.commit_hash || 'latest'}`

  switch (stepName) {
    case 'Clone Repository':
      await fs.mkdir(workDir, { recursive: true })
      const { stdout: cloneOut } = await execAsync(
        `git clone --branch ${pipeline.branch} --depth 1 ${pipeline.repo_url} ${workDir}`
      )
      return `Cloned ${pipeline.repo_url} (branch: ${pipeline.branch})\n${cloneOut}`

    case 'Run Tests':
      const { stdout: testOut } = await execAsync(
        `cd ${workDir} && ./mvnw test -q`,
        { timeout: 300000 } // 5 minutes
      )
      return `Tests completed\n${testOut}`

    case 'Build Package':
      const { stdout: buildOut } = await execAsync(
        `cd ${workDir} && ./mvnw package -DskipTests -q`,
        { timeout: 300000 }
      )
      return `BUILD SUCCESS\n${buildOut}`

    case 'SonarQube Analysis':
      // Check if SonarQube is available
      const sonarAvailable = await sonarService.isAvailable()
      if (!sonarAvailable) {
        return 'SonarQube skipped (server not available)'
      }
      
      // Extract project key from repo URL
      const repoName = pipeline.repo_url.split('/').pop().replace('.git', '')
      const projectKey = `cicd-${repoName}-${pipeline.branch}`
      
      // Create project if not exists
      await sonarService.createProject(projectKey, repoName)
      
      // Detect build tool and run appropriate analysis
      let analysisResult
      try {
        await fs.access(path.join(workDir, 'pom.xml'))
        analysisResult = await sonarService.runMavenAnalysis(workDir, projectKey)
      } catch {
        try {
          await fs.access(path.join(workDir, 'build.gradle'))
          analysisResult = await sonarService.runGradleAnalysis(workDir, projectKey)
        } catch {
          // Use sonar-scanner for other projects
          analysisResult = await sonarService.runAnalysis(workDir, projectKey, {
            projectName: repoName,
            sources: '.'
          })
        }
      }
      
      if (!analysisResult.success) {
        throw new Error(`SonarQube analysis failed: ${analysisResult.error}`)
      }
      
      // Wait for analysis to be processed
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Get quality gate status
      const qgStatus = await sonarService.getQualityGateStatus(projectKey)
      const report = await sonarService.generateReport(projectKey)
      
      // Store sonar results in pipeline
      await pool.query(
        `UPDATE pipelines SET 
         sonar_project_key = $1, 
         sonar_quality_gate = $2
         WHERE id = $3`,
        [projectKey, qgStatus.status, pipeline.id]
      )
      
      const summary = report.success ? report.summary : {}
      return `SonarQube Analysis completed
Quality Gate: ${qgStatus.status || 'N/A'}
Bugs: ${summary.bugs || 0} | Vulnerabilities: ${summary.vulnerabilities || 0}
Code Smells: ${summary.codeSmells || 0} | Coverage: ${summary.coverage || 0}%
Dashboard: ${report.dashboardUrl || 'N/A'}`

    case 'Build Docker Image':
      const { stdout: dockerOut } = await execAsync(
        `cd ${workDir} && docker build -t ${dockerImage} .`,
        { timeout: 600000 } // 10 minutes
      )
      return `Built image: ${dockerImage}\n${dockerOut}`

    case 'Deploy to VM':
      const deployResult = await sshService.deploy(dockerImage)
      return deployResult.output

    case 'Health Check':
      // Wait for container to start
      await new Promise(resolve => setTimeout(resolve, 5000))
      const isHealthy = await sshService.healthCheck()
      if (!isHealthy) {
        throw new Error('Health check failed')
      }
      return 'Health check passed: HTTP 200 OK'

    default:
      return 'Step completed'
  }
}

// ============================================
// SIMULATION (Demo/Development)
// ============================================
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
      // Simulate analysis with realistic output
      const simRepoName = pipeline.repo_url.split('/').pop().replace('.git', '')
      const simProjectKey = `cicd-${simRepoName}-${pipeline.branch}`
      const simReport = sonarService.simulateAnalysis(simProjectKey)
      
      return `SonarQube Analysis completed
Quality Gate: ${simReport.qualityGate.status}
Bugs: ${simReport.summary.bugs} | Vulnerabilities: ${simReport.summary.vulnerabilities}
Code Smells: ${simReport.summary.codeSmells} | Coverage: ${simReport.summary.coverage}%
Maintainability: ${simReport.summary.maintainabilityRating} | Security: ${simReport.summary.securityRating}
Dashboard: ${simReport.dashboardUrl}`
    
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

// Choose execution mode
async function runStep(stepName, pipeline) {
  if (MODE === 'real') {
    return executeRealStep(stepName, pipeline)
  }
  return simulateStep(stepName, pipeline)
}

async function rollbackPipeline(pipelineId, targetImage, io) {
  const room = `pipeline-${pipelineId}`
  io.to(room).emit('rollback_started', { version: targetImage })

  try {
    if (MODE === 'real') {
      await sshService.deploy(targetImage)
      // Verify health after rollback
      await new Promise(resolve => setTimeout(resolve, 5000))
      const isHealthy = await sshService.healthCheck()
      if (!isHealthy) throw new Error('Health check failed after rollback')
    } else {
      // Simulate rollback
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    io.to(room).emit('rollback_completed', { version: targetImage })
    return { success: true, version: targetImage }
  } catch (error) {
    io.to(room).emit('rollback_failed', { error: error.message })
    throw error
  }
}

module.exports = { executePipeline, rollbackPipeline }
