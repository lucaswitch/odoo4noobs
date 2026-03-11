import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { loadCurrentActivity, loadHistory, openActivity, closeActivity } from '../store/activitySlice'
import type { Session, OdooProject, OdooTask } from '../types'
import CloseModal from './CloseModal'
import logoImg from '../assets/logo.png'

interface Props {
  session: Session
  onLogout: () => void
}

interface Stage {
  id: number
  name: string
  sequence: number
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function classifyStage(name: string): string {
  const lower = name.toLowerCase()
  if (isStageDone(lower)) return 'stage-done'
  if (isStageDoing(lower)) return 'stage-doing'
  if (isStageTodo(lower)) return 'stage-todo'
  return 'stage-default'
}

function isStageTodo(name: string): boolean {
  const l = name.toLowerCase()
  return l.includes('fazer') || l.includes('todo') || l.includes('novo') || l.includes('new')
}

function isStageDoing(name: string): boolean {
  const l = name.toLowerCase()
  return l.includes('fazendo') || l.includes('doing') || l.includes('progress') || l.includes('andamento')
}

function isStageDone(name: string): boolean {
  const l = name.toLowerCase()
  return l.includes('feit') || l.includes('done') || l.includes('conclu')
}

function findStageByType(stages: Stage[], type: 'todo' | 'doing' | 'done'): Stage | undefined {
  const check = type === 'todo' ? isStageTodo : type === 'doing' ? isStageDoing : isStageDone
  return stages.find((s) => check(s.name))
}

export default function Dashboard({ session, onLogout }: Props) {
  const dispatch = useAppDispatch()
  const { current: currentActivity, history } = useAppSelector((s) => s.activity)

  const [projects, setProjects] = useState<OdooProject[]>([])
  const [tasks, setTasks] = useState<OdooTask[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState('00:00:00')
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'tasks' | 'history'>('tasks')
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null)

  // Stage change dropdown
  const [stageDropdownTaskId, setStageDropdownTaskId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchProjects = useCallback(async () => {
    try {
      const data = await window.api.getProjects()
      setProjects(data)
    } catch (err) {
      console.error(err)
    }
  }, [])

  const fetchStages = useCallback(async (projectId?: number) => {
    try {
      const data = await window.api.getStages(projectId)
      setStages(data)
    } catch (err) {
      console.error(err)
    }
  }, [])

  const fetchTasks = useCallback(async (projectId?: number) => {
    setLoading(true)
    try {
      const data = await window.api.getTasks(projectId)
      setTasks(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
    fetchTasks()
    fetchStages()
    dispatch(loadCurrentActivity())
    dispatch(loadHistory())
  }, [fetchProjects, fetchTasks, fetchStages, dispatch])

  // Timer
  useEffect(() => {
    if (currentActivity && !currentActivity.closedAt) {
      const update = () => {
        const ms = Date.now() - new Date(currentActivity.startedAt).getTime()
        setElapsed(formatDuration(ms))
      }
      update()
      timerRef.current = setInterval(update, 1000)
      return () => clearInterval(timerRef.current)
    } else {
      setElapsed('00:00:00')
    }
  }, [currentActivity])

  // Close stage dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStageDropdownTaskId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectProject = (id: number | null) => {
    setSelectedProject(id)
    setSelectedStageId(null)
    setSearchQuery('')
    fetchTasks(id ?? undefined)
    fetchStages(id ?? undefined)
  }

  const handleStart = async (task: OdooTask) => {
    const projId = task.project_id ? task.project_id[0] : 0
    const projName = task.project_id ? task.project_id[1] : 'Sem projeto'

    // Move task to "Fazendo"
    const doingStage = findStageByType(stages, 'doing')
    if (doingStage && task.stage_id && task.stage_id[0] !== doingStage.id) {
      await handleChangeStage(task.id, doingStage.id)
    }

    dispatch(openActivity({ taskId: task.id, taskName: task.name, projectId: projId, projectName: projName }))
  }

  const handleConfirmClose = async (description: string) => {
    if (!currentActivity) return

    // Move task back to "A fazer"
    const todoStage = findStageByType(stages, 'todo')
    if (todoStage) {
      await handleChangeStage(currentActivity.taskId, todoStage.id)
    }

    dispatch(closeActivity({ activityId: currentActivity.id, description }))
    setShowCloseModal(false)
  }

  const handleMarkDone = async (task: OdooTask) => {
    const doneStage = findStageByType(stages, 'done')
    if (doneStage) {
      await handleChangeStage(task.id, doneStage.id)
    }
  }

  const handleChangeStage = async (taskId: number, stageId: number) => {
    try {
      await window.api.changeTaskStage(taskId, stageId)
      // Update task locally
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, stage_id: [stageId, stages.find((s) => s.id === stageId)?.name || ''] as [number, string] }
            : t
        )
      )
    } catch (err) {
      console.error('Erro ao mudar estágio:', err)
    }
    setStageDropdownTaskId(null)
  }

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let result = tasks
    if (selectedStageId !== null) {
      result = result.filter((t) => t.stage_id && t.stage_id[0] === selectedStageId)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((t) => t.name.toLowerCase().includes(q))
    }
    return result
  }, [tasks, selectedStageId, searchQuery])

  // Unique stages from loaded tasks (for filter pills)
  const taskStages = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>()
    for (const t of tasks) {
      if (t.stage_id) {
        const [id, name] = t.stage_id
        const existing = map.get(id)
        if (existing) {
          existing.count++
        } else {
          map.set(id, { id, name, count: 1 })
        }
      }
    }
    // Sort by stages order
    const stageOrder = new Map(stages.map((s, i) => [s.id, i]))
    return Array.from(map.values()).sort(
      (a, b) => (stageOrder.get(a.id) ?? 999) - (stageOrder.get(b.id) ?? 999)
    )
  }, [tasks, stages])

  const selectedProjectName = selectedProject
    ? projects.find((p) => p.id === selectedProject)?.name
    : 'Todos os projetos'

  return (
    <div className="app-layout">
      <div className="titlebar-drag" />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src={logoImg} alt="logo" className="sidebar-logo-img" />
            odoo<span>4noobs</span>
          </div>
          <div className="sidebar-user">
            <span className="dot" />
            {session.userName}
          </div>
        </div>

        <div className="sidebar-section">Projetos</div>
        <div className="sidebar-list">
          <div
            className={`sidebar-item ${selectedProject === null ? 'active' : ''}`}
            onClick={() => selectProject(null)}
          >
            Todos
            <span className="count">{projects.reduce((s, p) => s + p.task_count, 0)}</span>
          </div>
          {projects.map((p, idx) => (
            <div
              key={p.id}
              className={`sidebar-item fade-in ${selectedProject === p.id ? 'active' : ''}`}
              onClick={() => selectProject(p.id)}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              {p.name}
              <span className="count">{p.task_count}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn-logout" onClick={onLogout}>
            ← sair ({session.login})
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="main-header">
          <div>
            <div className="main-title">{selectedProjectName}</div>
            <div className="main-subtitle">
              {filteredTasks.length}
              {filteredTasks.length !== tasks.length ? ` / ${tasks.length}` : ''} tarefa
              {tasks.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar tarefa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>
                ×
              </button>
            )}
          </div>
        </div>

        {/* Active tracker */}
        {currentActivity && !currentActivity.closedAt && (
          <div className="active-tracker">
            <div className="pulse" />
            <div className="info">
              <div className="task-name">{currentActivity.taskName}</div>
              <div className="project-name">{currentActivity.projectName}</div>
            </div>
            <div className="timer">{elapsed}</div>
            <button className="btn-stop" onClick={() => setShowCloseModal(true)}>
              PARAR
            </button>
          </div>
        )}

        {/* Stage filter pills */}
        {taskStages.length > 0 && tab === 'tasks' && (
          <div className="stage-filters">
            <button
              className={`stage-pill ${selectedStageId === null ? 'active' : ''}`}
              onClick={() => setSelectedStageId(null)}
            >
              Todos
              <span className="pill-count">{tasks.length}</span>
            </button>
            {taskStages.map((s) => (
              <button
                key={s.id}
                className={`stage-pill ${selectedStageId === s.id ? 'active' : ''} ${classifyStage(s.name)}`}
                onClick={() => setSelectedStageId(selectedStageId === s.id ? null : s.id)}
              >
                {s.name}
                <span className="pill-count">{s.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="tab-bar">
          <div className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>
            Tarefas
          </div>
          <div
            className={`tab ${tab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setTab('history')
              dispatch(loadHistory())
            }}
          >
            Histórico
          </div>
        </div>

        {tab === 'tasks' && (
          <div className="task-list">
            {loading ? (
              <div className="loading">
                <div className="spinner" />
                Carregando...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◇</div>
                {searchQuery || selectedStageId !== null
                  ? 'Nenhuma tarefa encontrada com esses filtros'
                  : 'Nenhuma tarefa encontrada'}
              </div>
            ) : (
              filteredTasks.map((t, i) => {
                const stageName = t.stage_id ? t.stage_id[1] : '-'
                const stageClass = classifyStage(stageName)
                const isActive = currentActivity?.taskId === t.id && !currentActivity.closedAt
                const isDropdownOpen = stageDropdownTaskId === t.id

                return (
                  <div
                    key={t.id}
                    className={`task-card ${isActive ? 'is-active' : ''}`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {/* Stage badge — clickable to change */}
                    <div className="stage-wrapper" ref={isDropdownOpen ? dropdownRef : undefined}>
                      <button
                        className={`task-stage clickable ${stageClass}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setStageDropdownTaskId(isDropdownOpen ? null : t.id)
                        }}
                        title="Clique para mudar o status"
                      >
                        {stageName}
                        <span className="stage-chevron">▾</span>
                      </button>

                      {isDropdownOpen && (
                        <div className="stage-dropdown">
                          {stages.map((s) => (
                            <button
                              key={s.id}
                              className={`stage-dropdown-item ${
                                t.stage_id && t.stage_id[0] === s.id ? 'current' : ''
                              } ${classifyStage(s.name)}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!t.stage_id || t.stage_id[0] !== s.id) {
                                  handleChangeStage(t.id, s.id)
                                }
                              }}
                            >
                              {s.name}
                              {t.stage_id && t.stage_id[0] === s.id && (
                                <span className="check-mark">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="task-info">
                      <div className="task-name">{t.name}</div>
                      <div className="task-meta">
                        {t.project_id ? t.project_id[1] : '—'}
                        {t.date_deadline ? ` · ${t.date_deadline}` : ''}
                      </div>
                    </div>
                    <div className="task-actions">
                      {!isActive && stageClass !== 'stage-done' && (
                        <button
                          className="task-play"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStart(t)
                          }}
                          title="Iniciar atividade"
                        >
                          ▶
                        </button>
                      )}
                      {stageClass !== 'stage-done' && (
                        <button
                          className="task-done-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkDone(t)
                          }}
                          title="Marcar como feito"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="task-list">
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◇</div>
                Nenhum registro ainda
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="history-item fade-in">
                  <span className="h-time">
                    {h.durationHours ? `${h.durationHours.toFixed(2)}h` : '--'}
                  </span>
                  <span className="h-name" title={h.description}>
                    {h.taskName} — {h.description || 'sem descrição'}
                  </span>
                  <span className="h-date">
                    {new Date(h.startedAt).toLocaleDateString('pt-BR')}
                  </span>
                  {h.synced ? (
                    <span className="h-synced" title="Sincronizado com Odoo">✓</span>
                  ) : (
                    <span className="h-not-synced" title="Não sincronizado">✗</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Close modal */}
      {showCloseModal && currentActivity && (
        <CloseModal
          activity={currentActivity}
          elapsed={elapsed}
          onConfirm={handleConfirmClose}
          onCancel={() => setShowCloseModal(false)}
        />
      )}
    </div>
  )
}
