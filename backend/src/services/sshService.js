const { Client } = require('ssh2')
const fs = require('fs')

class SSHService {
  constructor() {
    // Load private key from file if path is provided
    let privateKey = process.env.VM_SSH_PRIVATE_KEY || null
    const keyPath = process.env.SSH_KEY_PATH
    
    if (!privateKey && keyPath) {
      try {
        privateKey = fs.readFileSync(keyPath, 'utf8')
        console.log(`SSH key loaded from: ${keyPath}`)
      } catch (err) {
        console.error(`Failed to load SSH key from ${keyPath}:`, err.message)
      }
    }

    this.config = {
      host: process.env.VM_HOST,
      port: parseInt(process.env.VM_SSH_PORT) || 22,
      username: process.env.VM_USER || 'deploy',
      privateKey: privateKey
    }
  }

  /**
   * Execute a command on the remote VM
   */
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const conn = new Client()
      let settled = false

      conn.on('ready', () => {
        console.log(`SSH connected to ${this.config.host}`)
        
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end()
            if (!settled) {
              settled = true
              return reject(err)
            }
            return
          }

          let stdout = ''
          let stderr = ''

          stream.on('close', (code) => {
            conn.end()
            if (!settled) {
              settled = true
              if (code === 0) {
                resolve({ success: true, output: stdout, code })
              } else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`))
              }
            }
          })

          stream.on('data', (data) => {
            stdout += data.toString()
          })

          stream.stderr.on('data', (data) => {
            stderr += data.toString()
          })
        })
      })

      conn.on('error', (err) => {
        if (!settled) {
          settled = true
          reject(new Error(`SSH connection failed: ${err.message}`))
        } else {
          // Log error after promise is settled to avoid unhandled rejection
          console.error(`SSH error after connection: ${err.message}`)
        }
      })

      conn.connect(this.config)
    })
  }

  /**
   * Deploy a Docker image to the VM
   * Directly runs Docker commands instead of relying on deploy script
   */
  async deploy(dockerImage) {
    // Create deployment commands
    const commands = [
      // Stop and remove existing container if running
      `docker stop bfb-app 2>/dev/null || true`,
      `docker rm bfb-app 2>/dev/null || true`,
      // Run new container
      `docker run -d --name bfb-app -p 8080:8080 --restart unless-stopped ${dockerImage}`,
      // Show container status
      `docker ps --filter name=bfb-app --format "Container: {{.Names}} Status: {{.Status}}"`
    ]
    
    const command = commands.join(' && ')
    return this.executeCommand(command)
  }

  /**
   * Deploy with image transfer - loads image from tar file and runs container
   */
  async deployWithImage(dockerImage, imageTarPath) {
    const remoteTarPath = `/tmp/${imageTarPath.split('/').pop()}`
    
    const commands = [
      // Load the docker image from tar
      `docker load -i ${remoteTarPath}`,
      // Stop and remove existing container
      `docker stop bfb-app 2>/dev/null || true`,
      `docker rm bfb-app 2>/dev/null || true`,
      // Run new container
      `docker run -d --name bfb-app -p 8080:8080 --restart unless-stopped ${dockerImage}`,
      // Cleanup tar file
      `rm -f ${remoteTarPath}`,
      // Show status
      `echo "Deployed ${dockerImage} successfully"`,
      `docker ps --filter name=bfb-app --format "Container: {{.Names}} Status: {{.Status}}"`
    ]
    
    const command = commands.join(' && ')
    return this.executeCommand(command)
  }

  /**
   * Rollback to the previous version
   * Stops current container and restarts with specified image
   * @param {string} targetImage - Docker image to rollback to (from database)
   */
  async rollback(targetImage) {
    if (!targetImage) {
      throw new Error('Target image is required for rollback')
    }
    
    // Validate image format to prevent command injection
    // Expected format: repo:tag or repo@sha256:hash
    const imagePattern = /^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/
    if (!imagePattern.test(targetImage)) {
      throw new Error(`Invalid image format: ${targetImage}. Expected format: repository:tag`)
    }
    
    // Verify image exists on VM before rollback
    const verifyCommand = `docker images --format "{{.Repository}}:{{.Tag}}" | grep -Fx "${targetImage.replace(/["\\$`]/g, '\\$&')}" || echo "NOT_FOUND"`
    const verifyResult = await this.executeCommand(verifyCommand)
    
    if (verifyResult.output.includes('NOT_FOUND')) {
      throw new Error(`Image ${targetImage} not found on VM. Cannot rollback.`)
    }
    
    // Stop current container and start with target image from database
    // Using escaped image name to prevent injection
    const escapedImage = targetImage.replace(/["\\$`]/g, '\\$&')
    const command = `
      docker stop bfb-app 2>/dev/null || true && \
      docker rm -f bfb-app 2>/dev/null || true && \
      sleep 3 && \
      docker ps -a | grep bfb-app && exit 1 || true && \
      echo "Rolling back to: ${escapedImage}" && \
      docker run -d --name bfb-app -p 8080:8080 --restart unless-stopped "${escapedImage}" && \
      docker ps --filter name=bfb-app
    `.replace(/\n\s+/g, ' ').trim()
    
    return this.executeCommand(command)
  }

  /**
   * Check application health on the VM
   */
  async healthCheck() {
    const command = 'curl -sf http://localhost:8080/actuator/health || echo "unhealthy"'
    try {
      const result = await this.executeCommand(command)
      return result.output.includes('"status":"UP"')
    } catch (err) {
      return false
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus() {
    const command = 'docker ps --filter name=bfb-app --format "{{.Status}}"'
    try {
      const result = await this.executeCommand(command)
      return result.output.trim() || 'not running'
    } catch (err) {
      return 'error'
    }
  }

  /**
   * Get container logs
   */
  async getLogs(lines = 50) {
    const command = `docker logs bfb-app --tail ${lines} 2>&1`
    try {
      const result = await this.executeCommand(command)
      return result.output
    } catch (err) {
      return `Error getting logs: ${err.message}`
    }
  }

  /**
   * Test SSH connection
   */
  async testConnection() {
    try {
      const result = await this.executeCommand('echo "OK"')
      return result.output.trim() === 'OK'
    } catch (err) {
      console.error('SSH test failed:', err.message)
      return false
    }
  }
}

module.exports = new SSHService()
