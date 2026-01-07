import { Icons } from './Icons'
import './ConfirmModal.css'

export default function ConfirmModal({ 
  isOpen, 
  title = 'Confirmer', 
  message, 
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'danger', // 'danger' | 'warning' | 'info'
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <div className={`confirm-modal-header ${variant}`}>
          <span className="confirm-modal-icon">
            {variant === 'danger' && Icons.warning}
            {variant === 'warning' && Icons.warning}
            {variant === 'info' && Icons.info}
          </span>
          <h3>{title}</h3>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`btn-${variant}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
