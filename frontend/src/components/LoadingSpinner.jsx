import './LoadingSpinner.css'

export default function LoadingSpinner({ message = 'Chargement...' }) {
  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  )
}
