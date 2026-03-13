import { useState, useEffect } from 'react'
import type { OdooProject, OdooTag, OdooTask } from '../types'

interface Stage {
  id: number
  name: string
  sequence: number
}

interface Props {
  projects: OdooProject[]
  defaultProjectId?: number
  task?: OdooTask
  onConfirm: (name: string, projectId: number, stageId: number, tagIds: number[]) => Promise<void>
  onCancel: () => void
}

export default function NewTaskModal({ projects, defaultProjectId, task, onConfirm, onCancel }: Props) {
  const isEdit = !!task

  const [name, setName] = useState(task?.name ?? '')
  const [projectId, setProjectId] = useState<number>(
    task?.project_id ? task.project_id[0] : (defaultProjectId ?? projects[0]?.id ?? 0)
  )
  const [stages, setStages] = useState<Stage[]>([])
  const [stageId, setStageId] = useState<number>(task?.stage_id ? task.stage_id[0] : 0)
  const [tags, setTags] = useState<OdooTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(task?.tag_ids ?? [])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!projectId) return
    window.api.getStages(projectId).then((result: Stage[]) => {
      setStages(result)
      if (!isEdit) setStageId(result[0]?.id ?? 0)
    })
  }, [projectId])

  useEffect(() => {
    window.api.getTags().then((result: OdooTag[]) => setTags(result))
  }, [])

  function addTag(id: number) {
    if (id && !selectedTagIds.includes(id)) {
      setSelectedTagIds((prev) => [...prev, id])
    }
  }

  function removeTag(id: number) {
    setSelectedTagIds((prev) => prev.filter((t) => t !== id))
  }

  async function handleConfirm() {
    if (!name.trim() || !projectId || !stageId) return
    setSubmitting(true)
    try {
      await onConfirm(name.trim(), projectId, stageId, selectedTagIds)
    } finally {
      setSubmitting(false)
    }
  }

  const availableTags = tags.filter((t) => !selectedTagIds.includes(t.id))
  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar tarefa' : 'Nova tarefa'}</h2>

        <div className="field">
          <label>Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da tarefa..."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          />
        </div>

        <div className="field">
          <label>Projeto</label>
          <select value={projectId} onChange={(e) => setProjectId(Number(e.target.value))}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Estágio</label>
          <select value={stageId} onChange={(e) => setStageId(Number(e.target.value))}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {tags.length > 0 && (
          <div className="field">
            <label>Tags</label>
            <select
              value=""
              onChange={(e) => { addTag(Number(e.target.value)); e.target.value = '' }}
            >
              <option value="" disabled>Selecionar tag...</option>
              {availableTags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTags.length > 0 && (
              <div className="tag-chips">
                {selectedTags.map((t) => (
                  <span key={t.id} className="tag-chip">
                    {t.name}
                    <button type="button" onClick={() => removeTag(t.id)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={!name.trim() || !stageId || submitting}
          >
            {submitting ? (isEdit ? 'Salvando...' : 'Criando...') : (isEdit ? 'Salvar' : 'Criar tarefa')}
          </button>
        </div>
      </div>
    </div>
  )
}
