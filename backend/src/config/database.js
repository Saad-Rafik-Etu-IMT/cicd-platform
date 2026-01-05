const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'cicd_platform',
  user: process.env.POSTGRES_USER || 'cicd',
  password: process.env.POSTGRES_PASSWORD || 'cicd_secret'
})

pool.on('connect', () => {
  console.log('📦 Connected to PostgreSQL')
})

pool.on('error', (err) => {
  console.error('PostgreSQL error:', err)
})

module.exports = pool
