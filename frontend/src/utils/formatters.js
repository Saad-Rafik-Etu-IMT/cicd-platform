/**
 * Utility functions for formatting data
 */

/**
 * Format a date to French locale string
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('fr-FR')
}

/**
 * Format a date to short French format
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDateShort = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format duration between two dates
 * @param {string|Date} start - Start date
 * @param {string|Date} end - End date
 * @returns {string} Formatted duration string
 */
export const formatDuration = (start, end) => {
  if (!start || !end) return '-'
  const duration = new Date(end) - new Date(start)
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/**
 * Format a number with locale formatting
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '-'
  return num.toLocaleString('fr-FR')
}
