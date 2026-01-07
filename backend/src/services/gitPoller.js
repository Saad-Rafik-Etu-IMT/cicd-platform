/**
 * Git Polling Service
 * Vérifie périodiquement les nouveaux commits sur GitHub
 * Alternative aux webhooks quand ngrok/tunneling n'est pas disponible
 */

const axios = require('axios')
const pool = require('../config/database')

class GitPollerService {
  constructor(io) {
    this.io = io
    this.isRunning = false
    this.pollInterval = parseInt(process.env.GIT_POLL_INTERVAL) || 60000 // 1 minute par défaut
    this.repos = []
    this.lastCommits = new Map() // Stocke le dernier commit connu par repo/branch
    this.intervalId = null
  }

  /**
   * Démarre le polling
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Git Poller already running')
      return
    }

    console.log(`🔄 Starting Git Poller (interval: ${this.pollInterval / 1000}s)`)
    this.isRunning = true

    // Charger les repos à surveiller
    await this.loadRepos()

    // Premier check immédiat
    await this.checkForNewCommits()

    // Puis polling périodique
    this.intervalId = setInterval(async () => {
      await this.checkForNewCommits()
    }, this.pollInterval)

    console.log('✅ Git Poller started successfully')
  }

  /**
   * Arrête le polling
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('🛑 Git Poller stopped')
  }

  /**
   * Charge la liste des repos à surveiller depuis la config ou la BDD
   */
  async loadRepos() {
    // Repos à surveiller (peut être étendu pour charger depuis la BDD)
    const repoUrl = process.env.APP_REPO_URL || 'https://github.com/Saad-Rafik-Etu-IMT/demo.git'
    const branches = (process.env.GIT_POLL_BRANCHES || 'master').split(',')
    
    // Extraire owner/repo de l'URL
    const match = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/)
    if (match) {
      this.repos = [{
        owner: match[1],
        repo: match[2].replace('.git', ''),
        branches: branches, // Branches à surveiller (depuis config)
        url: repoUrl
      }]
      console.log(`📋 Watching repos: ${this.repos.map(r => `${r.owner}/${r.repo}`).join(', ')}`)
      console.log(`📋 Branches: ${branches.join(', ')}`)
    } else {
      console.error('❌ Invalid APP_REPO_URL format')
      this.repos = []
    }
  }

  /**
   * Vérifie les nouveaux commits pour tous les repos
   */
  async checkForNewCommits() {
    if (this.repos.length === 0) {
      return
    }

    console.log(`🔍 Checking for new commits... (${new Date().toLocaleTimeString()})`)

    for (const repo of this.repos) {
      for (const branch of repo.branches) {
        try {
          await this.checkBranch(repo, branch)
        } catch (error) {
          // Silently ignore branch not found errors
          if (error.response?.status !== 404) {
            console.error(`❌ Error checking ${repo.owner}/${repo.repo}@${branch}:`, error.message)
          }
        }
      }
    }
  }

  /**
   * Vérifie une branche spécifique pour les nouveaux commits
   */
  async checkBranch(repo, branch) {
    const key = `${repo.owner}/${repo.repo}@${branch}`
    
    // Récupérer le dernier commit via l'API GitHub
    const response = await axios.get(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${branch}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CICD-Platform-Poller'
        },
        timeout: 10000
      }
    )

    const latestCommit = response.data
    const commitSha = latestCommit.sha
    const lastKnownCommit = this.lastCommits.get(key)

    // Premier check - juste enregistrer le commit actuel
    if (!lastKnownCommit) {
      this.lastCommits.set(key, commitSha)
      console.log(`📌 Registered current commit for ${key}: ${commitSha.substring(0, 7)}`)
      return
    }

    // Nouveau commit détecté !
    if (commitSha !== lastKnownCommit) {
      console.log(`🚀 NEW COMMIT DETECTED on ${key}!`)
      console.log(`   Previous: ${lastKnownCommit.substring(0, 7)}`)
      console.log(`   New:      ${commitSha.substring(0, 7)}`)
      console.log(`   Message:  ${latestCommit.commit.message.split('\n')[0]}`)
      console.log(`   Author:   ${latestCommit.commit.author.name}`)

      // Mettre à jour le dernier commit connu
      this.lastCommits.set(key, commitSha)

      // Déclencher un pipeline
      await this.triggerPipeline(repo, branch, latestCommit)
    }
  }

  /**
   * Déclenche un nouveau pipeline
   */
  async triggerPipeline(repo, branch, commit) {
    try {
      const repoUrl = repo.url
      const commitHash = commit.sha
      const commitMessage = commit.commit.message
      const author = commit.commit.author.name

      console.log(`🔧 Triggering pipeline for ${repo.owner}/${repo.repo}@${branch}`)

      // Créer le pipeline en BDD
      const result = await pool.query(
        `INSERT INTO pipelines (repo_url, branch, commit_hash, status, trigger_type)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING *`,
        [repoUrl, branch, commitHash, `poll:${author}`]
      )

      const pipeline = result.rows[0]

      // Notifier via WebSocket
      if (this.io) {
        this.io.emit('pipeline:started', {
          id: pipeline.id,
          repoUrl,
          branch,
          commitHash: commitHash.substring(0, 7),
          commitMessage: commitMessage.split('\n')[0],
          author,
          status: 'pending',
          triggerType: 'polling'
        })
      }

      console.log(`✅ Pipeline #${pipeline.id} created for commit ${commitHash.substring(0, 7)}`)

      // Démarrer l'exécution du pipeline (async)
      this.executePipeline(pipeline)

    } catch (error) {
      console.error('❌ Error triggering pipeline:', error.message)
    }
  }

  /**
   * Exécute le pipeline (délègue au service de pipeline existant)
   */
  async executePipeline(pipeline) {
    try {
      // Utiliser le pipelineExecutor existant
      const { executePipeline } = require('./pipelineExecutor')
      await executePipeline(pipeline, this.io)
    } catch (error) {
      console.error(`❌ Pipeline #${pipeline.id} execution failed:`, error.message)
      // Le pipelineExecutor gère déjà les erreurs et les mises à jour de statut
    }
  }

  /**
   * Force un check immédiat (pour API)
   */
  async forceCheck() {
    console.log('🔄 Force checking for new commits...')
    await this.checkForNewCommits()
    return { checked: true, repos: this.repos.map(r => `${r.owner}/${r.repo}`) }
  }

  /**
   * Retourne le statut du poller
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pollInterval: this.pollInterval,
      repos: this.repos.map(r => ({
        name: `${r.owner}/${r.repo}`,
        branches: r.branches
      })),
      lastCommits: Object.fromEntries(this.lastCommits)
    }
  }
}

module.exports = GitPollerService
