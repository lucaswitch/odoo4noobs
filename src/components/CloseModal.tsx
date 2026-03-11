import { useState } from 'react'
import type { TrackedActivity } from '../types'

interface Props {
  activity: TrackedActivity
  elapsed: string
  onConfirm: (description: string) => void
  onCancel: () => void
}

export default function CloseModal({ activity, elapsed, onConfirm, onCancel }: Props) {
  const [description, setDescription] = useState('')

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Finalizar atividade</h2>
        <div className="modal-sub">{activity.taskName}</div>

        <div className="duration-display">{elapsed}</div>

        <div className="field">
          <label>O que foi feito?</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o trabalho realizado..."
            autoFocus
          />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn-confirm"
            onClick={() => onConfirm(description || activity.taskName)}
          >
            Confirmar & Registrar
          </button>
        </div>
      </div>
    </div>
  )
}
