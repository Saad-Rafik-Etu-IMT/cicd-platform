const express = require('express')
const router = express.Router()
const axios = require('axios')
const pool = require('../config/database')
const { generateToken, authenticateToken } = require('../middleware/auth')

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

/**
 * GET /api/auth/github
 * Redirect to GitHub OAuth
 */
router.get('/github', (req, res) => {
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3002'}/api/auth/github/callback`
  const scope = 'user:email read:user'
  
  // Add random state to prevent caching issues
  const state = Math.random().toString(36).substring(7)
  
  // Use login parameter to force GitHub to prompt for re-authorization
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&allow_signup=true`
  
  res.redirect(githubAuthUrl)
})

/**
 * GET /api/auth/github/callback
 * Handle GitHub OAuth callback
 */
router.get('/github/callback', async (req, res) => {
  const { code } = req.query

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=no_code`)
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    )

    const { access_token, error } = tokenResponse.data

    if (error || !access_token) {
      console.error('GitHub OAuth error:', tokenResponse.data)
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)
    }

    // Get user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    })

    const githubUser = userResponse.data

    // Get user email (might be private)
    let email = githubUser.email
    if (!email) {
      try {
        const emailResponse = await axios.get('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        })
        const primaryEmail = emailResponse.data.find(e => e.primary)
        email = primaryEmail?.email || `${githubUser.login}@github.local`
      } catch (e) {
        email = `${githubUser.login}@github.local`
      }
    }

    // Find or create user in database
    let user = await findOrCreateUser({
      github_id: githubUser.id,
      username: githubUser.login,
      email: email,
      avatar_url: githubUser.avatar_url,
      github_access_token: access_token
    })

    // Generate JWT token
    const token = generateToken(user)

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`)

  } catch (err) {
    console.error('GitHub OAuth callback error:', err)
    res.redirect(`${FRONTEND_URL}/login?error=server_error`)
  }
})

/**
 * Find or create user from GitHub data
 */
async function findOrCreateUser(githubData) {
  const { github_id, username, email, avatar_url, github_access_token } = githubData

  // Check if user exists
  let result = await pool.query(
    'SELECT * FROM users WHERE github_id = $1',
    [github_id]
  )

  if (result.rows.length > 0) {
    // Update existing user
    await pool.query(
      `UPDATE users 
       SET username = $1, email = $2, avatar_url = $3, github_access_token = $4, updated_at = NOW()
       WHERE github_id = $5`,
      [username, email, avatar_url, github_access_token, github_id]
    )
    return result.rows[0]
  }

  // Create new user (first user is admin, others are developers)
  const countResult = await pool.query('SELECT COUNT(*) FROM users WHERE github_id IS NOT NULL')
  const isFirstUser = parseInt(countResult.rows[0].count) === 0
  const role = isFirstUser ? 'admin' : 'developer'

  result = await pool.query(
    `INSERT INTO users (github_id, username, email, avatar_url, github_access_token, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [github_id, username, email, avatar_url, github_access_token, role]
  )

  console.log(`Created new user: ${username} with role: ${role}`)
  return result.rows[0]
}

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        avatar_url: req.user.avatar_url
      }
    })
  } catch (err) {
    console.error('Error getting user:', err)
    res.status(500).json({ error: 'Failed to get user info' })
  }
})

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' })
})

/**
 * GET /api/auth/users
 * Get all users (admin only)
 */
router.get('/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, role, avatar_url, created_at FROM users ORDER BY created_at DESC'
    )
    res.json({ users: result.rows })
  } catch (err) {
    console.error('Error getting users:', err)
    res.status(500).json({ error: 'Failed to get users' })
  }
})

/**
 * PATCH /api/auth/users/:id/role
 * Update user role (admin only)
 */
router.patch('/users/:id/role', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const { id } = req.params
  const { role } = req.body

  if (!['admin', 'developer', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  try {
    await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      [role, id]
    )
    res.json({ message: 'Role updated successfully' })
  } catch (err) {
    console.error('Error updating role:', err)
    res.status(500).json({ error: 'Failed to update role' })
  }
})

module.exports = router
