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

      conn.on('ready', () => {
        console.log(`SSH connected to ${this.config.host}`)
        
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end()
            return reject(err)
          }

          let stdout = ''
          let stderr = ''

          stream.on('close', (code) => {
            conn.end()
            if (code === 0) {
              resolve({ success: true, output: stdout, code })
            } else {
              reject(new Error(`Command failed with code ${code}: ${stderr}`))
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
        reject(new Error(`SSH connection failed: ${err.message}`))
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
   */
  async rollback() {
    const command = '/opt/bfb-management/rollback.sh'
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
