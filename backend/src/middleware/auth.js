const jwt = require('jsonwebtoken')
const pool = require('../config/database')

const JWT_SECRET = process.env.JWT_SECRET || 'cicd-platform-secret-key-2024'

/**
 * Middleware to verify JWT token
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // Get user from database
    const result = await pool.query(
      'SELECT id, username, email, role, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    )
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' })
    }
    
    req.user = result.rows[0]
    next()
  } catch (err) {
    console.error('Auth error:', err.message)
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Middleware to check user role
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      })
    }
    
    next()
  }
}

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
}

/**
 * Roles hierarchy
 */
const ROLES = {
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer'
}

/**
 * Role permissions
 */
const PERMISSIONS = {
  admin: ['read', 'write', 'trigger', 'rollback', 'manage_users', 'manage_env'],
  developer: ['read', 'write', 'trigger', 'rollback'],
  viewer: ['read']
}

const hasPermission = (role, permission) => {
  return PERMISSIONS[role]?.includes(permission) || false
}

module.exports = {
  authenticateToken,
  requireRole,
  generateToken,
  ROLES,
  PERMISSIONS,
  hasPermission,
  JWT_SECRET
}
