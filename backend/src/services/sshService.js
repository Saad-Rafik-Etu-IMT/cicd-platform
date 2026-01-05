const { Client } = require('ssh2')

class SSHService {
  constructor() {
    this.config = {
      host: process.env.VM_HOST,
      port: parseInt(process.env.VM_SSH_PORT) || 22,
      username: process.env.VM_USER || 'deploy',
      privateKey: process.env.VM_SSH_PRIVATE_KEY || null
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
   */
  async deploy(dockerImage) {
    const command = `/opt/bfb-management/deploy.sh ${dockerImage}`
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
