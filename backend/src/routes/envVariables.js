const express = require('express')
const router = express.Router()
const pool = require('../config/database')
const { authenticateToken, requireRole } = require('../middleware/auth')

// All routes require authentication and admin role
router.use(authenticateToken)
router.use(requireRole('admin'))

// GET all environment variables
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, is_secret, description, created_at, updated_at FROM env_variables ORDER BY name'
    )
    
    // Don't return actual values for secrets in list
    const variables = result.rows.map(v => ({
      ...v,
      value: v.is_secret ? '********' : null // Value only visible when editing
    }))
    
    res.json({ variables })
  } catch (err) {
    console.error('Error fetching env variables:', err)
    res.status(500).json({ error: 'Failed to fetch environment variables' })
  }
})

// GET single environment variable (with value for editing)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      'SELECT * FROM env_variables WHERE id = $1',
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Variable not found' })
    }
    
    const variable = result.rows[0]
    // Mask the value for secrets
    if (variable.is_secret) {
      variable.value = '********'
    }
    
    res.json({ variable })
  } catch (err) {
    console.error('Error fetching env variable:', err)
    res.status(500).json({ error: 'Failed to fetch environment variable' })
  }
})

// POST create new environment variable
router.post('/', async (req, res) => {
  try {
    const { name, value, is_secret = true, description = '' } = req.body
    
    if (!name || !value) {
      return res.status(400).json({ error: 'Name and value are required' })
    }
    
    // Validate name format (uppercase, underscores, no spaces)
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      return res.status(400).json({ 
        error: 'Name must be uppercase, start with a letter, and contain only letters, numbers, and underscores' 
      })
    }
    
    const result = await pool.query(
      `INSERT INTO env_variables (name, value, is_secret, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, is_secret, description, created_at`,
      [name, value, is_secret, description]
    )
    
    res.status(201).json({ 
      variable: {
        ...result.rows[0],
        value: is_secret ? '********' : value
      }
    })
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Variable with this name already exists' })
    }
    console.error('Error creating env variable:', err)
    res.status(500).json({ error: 'Failed to create environment variable' })
  }
})

// PUT update environment variable
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, value, is_secret, description } = req.body
    
    // Build update query dynamically
    const updates = []
    const values = []
    let paramCount = 1
    
    if (name !== undefined) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
        return res.status(400).json({ 
          error: 'Name must be uppercase, start with a letter, and contain only letters, numbers, and underscores' 
        })
      }
      updates.push(`name = $${paramCount++}`)
      values.push(name)
    }
    if (value !== undefined && value !== '********') {
      updates.push(`value = $${paramCount++}`)
      values.push(value)
    }
    if (is_secret !== undefined) {
      updates.push(`is_secret = $${paramCount++}`)
      values.push(is_secret)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`)
      values.push(description)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }
    
    updates.push(`updated_at = NOW()`)
    values.push(id)
    
    const result = await pool.query(
      `UPDATE env_variables SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, is_secret, description, updated_at`,
      values
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Variable not found' })
    }
    
    res.json({ 
      variable: {
        ...result.rows[0],
        value: '********'
      }
    })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Variable with this name already exists' })
    }
    console.error('Error updating env variable:', err)
    res.status(500).json({ error: 'Failed to update environment variable' })
  }
})

// DELETE environment variable
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await pool.query(
      'DELETE FROM env_variables WHERE id = $1 RETURNING id, name',
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Variable not found' })
    }
    
    res.json({ message: 'Variable deleted', variable: result.rows[0] })
  } catch (err) {
    console.error('Error deleting env variable:', err)
    res.status(500).json({ error: 'Failed to delete environment variable' })
  }
})

// GET all variables for pipeline execution (internal use)
router.get('/internal/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, value FROM env_variables'
    )
    
    // Convert to key-value object
    const envVars = {}
    result.rows.forEach(row => {
      envVars[row.name] = row.value
    })
    
    res.json({ envVars })
  } catch (err) {
    console.error('Error fetching env variables for pipeline:', err)
    res.status(500).json({ error: 'Failed to fetch environment variables' })
  }
})

module.exports = router
