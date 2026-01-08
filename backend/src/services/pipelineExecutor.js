const pool = require('../config/database')
const sshService = require('./sshService')
const sonarService = require('./sonarService')
const pentestService = require('./pentestService')
const { exec } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs').promises

const execAsync = promisify(exec)

// Mode: 'simulate' for demo, 'real' for production
const MODE = process.env.PIPELINE_MODE || 'simulate'
const WORKSPACE = process.env.WORKSPACE_DIR || '/tmp/pipelines'
const PIPELINE_TIMEOUT = parseInt(process.env.PIPELINE_TIMEOUT) || 15 * 60 * 1000 // 15 minutes default

const STEPS = [
  'Clone Repository',
  'Run Tests',
  'Build Package',
  'SonarQube Analysis',
  'Build Docker Image',
  'Deploy to VM',
  'Health Check',
  'Security Scan'
]

// Track running pipelines for cancellation
const runningPipelines = new Map()

// Track running rollbacks to prevent concurrent rollbacks
const runningRollbacks = new Set()

// Global deployment lock to prevent any concurrent deployments/rollbacks
const deploymentLock = {
  locked: false,
  currentOperation: null, // 'pipeline' or 'rollback'
  pipelineId: null,
  startedAt: null
}

function acquireDeploymentLock(operation, pipelineId) {
  if (deploymentLock.locked) {
    const elapsed = Math.floor((Date.now() - deploymentLock.startedAt) / 1000)
    throw new Error(
      `Une opération ${deploymentLock.currentOperation} est déjà en cours ` +
      `(Pipeline #${deploymentLock.pipelineId}, démarrée il y a ${elapsed}s). ` +
      `Veuillez patienter.`
    )
  }
  deploymentLock.locked = true
  deploymentLock.currentOperation = operation
  deploymentLock.pipelineId = pipelineId
  deploymentLock.startedAt = Date.now()
  console.log(`🔒 Deployment lock acquired for ${operation} (Pipeline #${pipelineId})`)
}

function releaseDeploymentLock() {
  if (deploymentLock.locked) {
    const elapsed = Math.floor((Date.now() - deploymentLock.startedAt) / 1000)
    console.log(
      `🔓 Deployment lock released for ${deploymentLock.currentOperation} ` +
      `(Pipeline #${deploymentLock.pipelineId}, durée: ${elapsed}s)`
    )
  }
  deploymentLock.locked = false
  deploymentLock.currentOperation = null
  deploymentLock.pipelineId = null
  deploymentLock.startedAt = null
}

function isDeploymentLocked() {
  return deploymentLock.locked
}

function getDeploymentLockStatus() {
  if (!deploymentLock.locked) {
    return { locked: false }
  }
  const elapsed = Math.floor((Date.now() - deploymentLock.startedAt) / 1000)
  return {
    locked: true,
    operation: deploymentLock.currentOperation,
    pipelineId: deploymentLock.pipelineId,
    elapsedSeconds: elapsed
  }
}

// Cancel a running pipeline
function cancelPipeline(pipelineId) {
  const pipelineInfo = runningPipelines.get(pipelineId)
  if (pipelineInfo) {
    pipelineInfo.cancel()
    return true
  }
  return false
}

// Get list of running pipelines
function getRunningPipelines() {
  return Array.from(runningPipelines.keys())
}

// Check if a pipeline is running
function isPipelineRunning(pipelineId) {
  return runningPipelines.has(pipelineId)
}

async function executePipeline(pipeline, io) {
  const pipelineRoom = `pipeline-${pipeline.id}`
  const pipelineStartTime = Date.now()
  let timeoutId = null
  let isCancelled = false
  
  // Acquire deployment lock before starting
  try {
    acquireDeploymentLock('pipeline', pipeline.id)
  } catch (error) {
    // Update pipeline status to failed if lock cannot be acquired
    await pool.query(
      'UPDATE pipelines SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', error.message, pipeline.id]
    )
    io.to(pipelineRoom).emit('pipeline_failed', { error: error.message })
    throw error
  }
  
  // Register cancel function for this pipeline
  const cancelFn = () => {
    isCancelled = true
    if (timeoutId) clearTimeout(timeoutId)
  }
  runningPipelines.set(pipeline.id, { cancel: cancelFn, startTime: pipelineStartTime })
  
  // Create a promise that rejects after timeout
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      isCancelled = true
      reject(new Error(`Pipeline timeout: exceeded ${PIPELINE_TIMEOUT / 1000 / 60} minutes`))
    }, PIPELINE_TIMEOUT)
  })
  
  // Function to check if pipeline should continue
  const checkTimeout = () => {
    if (isCancelled) {
      throw new Error('Pipeline cancelled by user')
    }
  }
  
  try {
    // Update status to running
    await pool.query(
      'UPDATE pipelines SET status = $1, started_at = NOW() WHERE id = $2',
      ['running', pipeline.id]
    )
    
    // Emit to room and broadcast globally for notifications
    io.to(pipelineRoom).emit('pipeline_started', { id: pipeline.id })
    io.emit('pipeline:started', { id: pipeline.id })
    
    console.log(`⏱️  Pipeline ${pipeline.id} started with ${PIPELINE_TIMEOUT / 1000}s timeout`)
    
    for (const step of STEPS) {
      checkTimeout() // Check before each step
      await executeStep(pipeline, step, io, pipelineRoom)
    }
    
    // Clear timeout on success
    if (timeoutId) clearTimeout(timeoutId)
    
    // Pipeline completed successfully
    await pool.query(
      'UPDATE pipelines SET status = $1, completed_at = NOW() WHERE id = $2',
      ['success', pipeline.id]
    )
    
    const duration = Math.round((Date.now() - pipelineStartTime) / 1000)
    console.log(`✅ Pipeline ${pipeline.id} completed in ${duration}s`)
    
    // Record deployment
    await pool.query(
      `INSERT INTO deployments (pipeline_id, docker_image, status)
       VALUES ($1, $2, 'success')`,
      [pipeline.id, `bfb-management:${pipeline.commit_hash || 'latest'}`]
    )
    
    // Emit to room and broadcast globally for notifications
    io.to(pipelineRoom).emit('pipeline_completed', { id: pipeline.id })
    io.emit('pipeline:completed', { id: pipeline.id })
    
    // Remove from running pipelines and release lock
    runningPipelines.delete(pipeline.id)
    releaseDeploymentLock()
    
  } catch (error) {
    // Clear timeout on error
    if (timeoutId) clearTimeout(timeoutId)
    
    // Remove from running pipelines and release lock
    runningPipelines.delete(pipeline.id)
    releaseDeploymentLock()
    
    const duration = Math.round((Date.now() - pipelineStartTime) / 1000)
    const isTimeout = error.message.includes('timeout') || error.message.includes('cancelled')
    const status = isTimeout ? 'cancelled' : 'failed'
    
    console.log(`❌ Pipeline ${pipeline.id} ${status} after ${duration}s: ${error.message}`)
    
    // Pipeline failed or cancelled
    await pool.query(
      'UPDATE pipelines SET status = $1, completed_at = NOW() WHERE id = $2',
      [status, pipeline.id]
    )
    
    // Emit to room and broadcast globally for notifications
    io.to(pipelineRoom).emit('pipeline_failed', { 
      id: pipeline.id, 
      error: error.message,
      status: status
    })
    io.emit('pipeline:failed', { id: pipeline.id, error: error.message, status: status })
    
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
      // Fix mvnw permissions after clone
      await execAsync(`chmod +x ${workDir}/mvnw || true`)
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
      // Save image, transfer to VM, load and run
      const imageTarPath = `/tmp/${dockerImage.replace(':', '-')}.tar`
      
      // Save docker image to tar file
      await execAsync(`docker save ${dockerImage} -o ${imageTarPath}`, { timeout: 300000 })
      
      // Transfer image to VM using SCP
      const vmHost = process.env.VM_HOST
      const vmUser = process.env.VM_USER
      const sshKeyPath = process.env.SSH_KEY_PATH || '/tmp/vm_deployer'
      
      await execAsync(
        `scp -i ${sshKeyPath} -o StrictHostKeyChecking=no ${imageTarPath} ${vmUser}@${vmHost}:/tmp/`,
        { timeout: 300000 }
      )
      
      // Load image and deploy on VM
      const deployResult = await sshService.deployWithImage(dockerImage, imageTarPath)
      
      // Cleanup local tar file
      await execAsync(`rm -f ${imageTarPath}`)
      
      return deployResult.output

    case 'Health Check':
      // Wait for Java application to start (Spring Boot needs more time)
      const maxRetries = 12  // 12 retries * 10 seconds = 2 minutes max
      const retryInterval = 10000  // 10 seconds
      
      for (let i = 0; i < maxRetries; i++) {
        console.log(`Health check attempt ${i + 1}/${maxRetries}...`)
        await new Promise(resolve => setTimeout(resolve, retryInterval))
        
        const isHealthy = await sshService.healthCheck()
        if (isHealthy) {
          return `Health check passed after ${(i + 1) * 10} seconds: Application is UP`
        }
      }
      
      // Get container logs for debugging
      const logs = await sshService.getLogs(30)
      throw new Error(`Health check failed after ${maxRetries * 10} seconds. Container logs:\n${logs}`)

    case 'Security Scan':
      // Run penetration test against deployed application
      const pentestTargetUrl = process.env.PENTEST_TARGET_URL || `http://${process.env.VM_HOST}:8080`
      
      const pentestResult = await pentestService.runFullPentest(pentestTargetUrl, {
        useZap: true,
        quickScan: true
      })
      
      // Store pentest results in pipeline
      const pentestStatus = pentestResult.vulnerabilities.high > 0 ? 'critical' :
                           pentestResult.vulnerabilities.medium > 0 ? 'warning' : 'passed'
      
      await pool.query(
        `UPDATE pipelines SET 
         pentest_result = $1,
         pentest_status = $2
         WHERE id = $3`,
        [JSON.stringify(pentestResult), pentestStatus, pipeline.id]
      )
      
      // Generate report for output
      return pentestService.generatePipelineReport(pentestResult)

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
    
    case 'Security Scan':
      // Simulate penetration test
      const simPentestResult = pentestService.simulatePentest('http://localhost:8080')
      return pentestService.generatePipelineReport(simPentestResult)
    
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
  
  // Acquire deployment lock (replaces the old runningRollbacks check)
  try {
    acquireDeploymentLock('rollback', pipelineId)
  } catch (error) {
    io.to(room).emit('rollback_failed', { error: error.message })
    throw error
  }
  
  // Keep runningRollbacks for backward compatibility
  runningRollbacks.add('active')
  
  io.to(room).emit('rollback_started', { version: targetImage })

  try {
    if (MODE === 'real') {
      // Execute rollback with target image from database
      const rollbackResult = await sshService.rollback(targetImage)
      console.log('Rollback result:', rollbackResult.output)
      
      // Wait for Java application to start (up to 90 seconds)
      const maxRetries = 9
      const retryInterval = 10000
      let isHealthy = false
      
      for (let i = 0; i < maxRetries; i++) {
        console.log(`Rollback health check attempt ${i + 1}/${maxRetries}...`)
        try {
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          isHealthy = await sshService.healthCheck()
          console.log(`Health check ${i + 1} result: ${isHealthy}`)
          if (isHealthy) {
            console.log('Health check succeeded, breaking loop')
            break
          }
        } catch (healthErr) {
          console.error(`Health check attempt ${i + 1} failed:`, healthErr.message)
          // Continue to next attempt
        }
      }
      
      console.log(`Health check loop completed. Final health status: ${isHealthy}`)
      
      // If still not healthy, it might be because no container is running (intentional rollback to stop)
      if (!isHealthy) {
        const containerStatus = await sshService.getContainerStatus()
        if (containerStatus === 'not running' || containerStatus.includes('stopped')) {
          console.log('Container stopped - rollback completed (no previous version)')
        } else {
          throw new Error('Health check failed after rollback')
        }
      }
    } else {
      // Simulate rollback
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    // Release rollback lock and deployment lock
    runningRollbacks.delete('active')
    releaseDeploymentLock()
    
    io.to(room).emit('rollback_completed', { version: targetImage })
    return { success: true, version: targetImage }
  } catch (error) {
    // Release rollback lock and deployment lock on error
    runningRollbacks.delete('active')
    releaseDeploymentLock()
    console.error('Error during rollback:', error)
    io.to(room).emit('rollback_failed', { error: error.message })
    throw error
  }
}

module.exports = { 
  executePipeline, 
  rollbackPipeline,
  cancelPipeline,
  isPipelineRunning,
  getRunningPipelines,
  isDeploymentLocked,
  getDeploymentLockStatus
}
