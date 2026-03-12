import { useState, useEffect, useCallback } from 'react'
import type { Session, TimesheetEntry } from '../types'

interface Props {
  session: Session
}

interface UserGroup {
  userId: number
  userName: string
  totalHours: number
  todayHours: number
  entries: TimesheetEntry[]
}

type Period = 'today' | 'week' | 'month'

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getPeriodRange(period: Period): { from: string; to: string } {
  const today = new Date()
  if (period === 'today') {
    const s = toDateStr(today)
    return { from: s, to: s }
  }
  if (period === 'week') {
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + diff)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { from: toDateStr(monday), to: toDateStr(sunday) }
  }
  const from = new Date(today.getFullYear(), today.getMonth(), 1)
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { from: toDateStr(from), to: toDateStr(to) }
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export default function Control({ session: _session }: Props) {
  const [period, setPeriod] = useState<Period>('today')
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const today = toDateStr(new Date())

  const fetchTimesheets = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const { from, to } = getPeriodRange(p)
      const entries: TimesheetEntry[] = await window.api.getTimesheets(from, to)

      const map = new Map<number, UserGroup>()
      for (const e of entries) {
        if (!e.user_id) continue
        const [userId, userName] = e.user_id
        if (!map.has(userId)) {
          map.set(userId, { userId, userName, totalHours: 0, todayHours: 0, entries: [] })
        }
        const g = map.get(userId)!
        g.totalHours += e.unit_amount
        g.entries.push(e)
        if (e.date === today) g.todayHours += e.unit_amount
      }

      setGroups(Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    fetchTimesheets(period)
  }, [period, fetchTimesheets])

  const toggleExpand = (userId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  const totalHours = groups.reduce((s, g) => s + g.totalHours, 0)
  const todayTotal = groups.reduce((s, g) => s + g.todayHours, 0)

  return (
    <main className="main-content">
      <div className="main-header">
        <div>
          <div className="main-title">Controle de Horas</div>
          <div className="main-subtitle">
            {groups.length} usuário{groups.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h total
            {period !== 'today' && todayTotal > 0 && ` · ${todayTotal.toFixed(1)}h hoje`}
          </div>
        </div>
        <div className="period-filter">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              className={`period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      <div className="task-list">
        {loading ? (
          <div className="loading">
            <div className="spinner" />
            Carregando...
          </div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            Nenhum lançamento encontrado
          </div>
        ) : (
          groups.map((g) => {
            const isOpen = expanded.has(g.userId)
            return (
              <div key={g.userId} className="ctrl-user-block fade-in">
                {/* User row */}
                <div className="ctrl-user-row" onClick={() => toggleExpand(g.userId)}>
                  <span className="ctrl-chevron">{isOpen ? '▾' : '▸'}</span>
                  <span className="ctrl-user-name">{g.userName}</span>
                  <div className="ctrl-user-stats">
                    {period !== 'today' && g.todayHours > 0 && (
                      <span className="ctrl-today-badge">{g.todayHours.toFixed(1)}h hoje</span>
                    )}
                    <span className="ctrl-total-hours">{g.totalHours.toFixed(1)}h</span>
                  </div>
                </div>

                {/* Expanded entries */}
                {isOpen && (
                  <div className="ctrl-entries">
                    {g.entries.length === 0 ? (
                      <div className="ctrl-empty">Nenhum lançamento neste período</div>
                    ) : (
                      g.entries.map((e) => (
                        <div
                          key={e.id}
                          className={`ctrl-entry ${e.date === today ? 'ctrl-entry-today' : ''}`}
                        >
                          <span className="ctrl-entry-date">{fmtDate(e.date)}</span>
                          <div className="ctrl-entry-info">
                            <span className="ctrl-entry-task">
                              {e.task_id ? e.task_id[1] : '—'}
                            </span>
                            <span className="ctrl-entry-project">
                              {e.project_id ? e.project_id[1] : '—'}
                            </span>
                          </div>
                          <span className="ctrl-entry-desc" title={e.name}>
                            {e.name || '—'}
                          </span>
                          <span className="ctrl-entry-hours">{e.unit_amount.toFixed(2)}h</span>
                        </div>
                      ))
                    )}
                    <div className="ctrl-entries-footer">
                      Total: <strong>{g.totalHours.toFixed(2)}h</strong>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
