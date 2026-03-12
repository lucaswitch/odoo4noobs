import { useState, useEffect, useCallback } from 'react'
import type { Session, TimesheetEntry } from '../types'

interface Props {
  session: Session
}

interface UserGroup {
  userId: number
  userName: string
  avatar: string | false
  totalHours: number
  todayHours: number
  entries: TimesheetEntry[]
}

interface UserStatus {
  userId: number
  userName: string
  avatar: string | false
  doingTasks: { id: number; name: string; projectName: string }[]
}

interface InternalUser {
  id: number
  name: string
  image_128: string | false
}

type Period = 'today' | 'week' | 'month'
type Tab    = 'lancamentos' | 'analytics'

// ─── helpers ───────────────────────────────────────────────────────────────

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
  const to   = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { from: toDateStr(from), to: toDateStr(to) }
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit',
  })
}

function isStageDoing(name: string): boolean {
  const l = name.toLowerCase()
  return l.includes('fazendo') || l.includes('doing') || l.includes('progress') || l.includes('andamento')
}

const H_DAY = 44 / 5 // 8.8h

/** Expected hours UP TO TODAY for the chosen period — right for in-progress monitoring */
function expectedHoursToDate(period: Period): number {
  const today = new Date()
  if (period === 'today') return H_DAY
  if (period === 'week') {
    const day = today.getDay() // 0=Sun
    const worked = day === 0 ? 5 : Math.min(day, 5)
    return worked * H_DAY
  }
  // month: count working days from 1st to today
  const y = today.getFullYear(), m = today.getMonth()
  let wd = 0
  for (let d = 1; d <= today.getDate(); d++) {
    const dow = new Date(y, m, d).getDay()
    if (dow !== 0 && dow !== 6) wd++
  }
  return wd * H_DAY
}

function periodLabel(period: Period): string {
  return period === 'today' ? 'hoje' : period === 'week' ? 'esta semana' : 'este mês'
}

function pctColor(pct: number): string {
  if (pct >= 90) return 'var(--success)'
  if (pct >= 60) return 'var(--accent-amber)'
  return 'var(--danger)'
}

// ─── component ─────────────────────────────────────────────────────────────

export default function Control({ session: _session }: Props) {
  const [period, setPeriod]           = useState<Period>('week')
  const [tab, setTab]                 = useState<Tab>('analytics')
  const [groups, setGroups]           = useState<UserGroup[]>([])
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState<Set<number>>(new Set())
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>([])
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([])
  const [filterUserId, setFilterUserId] = useState<number | null>(null)

  const today = toDateStr(new Date())

  // ── fetch internal users once ───────────────────────────────────────────
  useEffect(() => {
    window.api.getInternalUsers().then((users: InternalUser[]) => setInternalUsers(users)).catch(console.error)
  }, [])

  // ── fetch who is doing what ─────────────────────────────────────────────
  const fetchUsersActivity = useCallback(async () => {
    try {
      const { tasks, users } = await window.api.getUsersActivity()
      const userMap = new Map<number, { name: string; avatar: string | false }>()
      for (const u of users) userMap.set(u.id, { name: u.name, avatar: u.image_128 || false })

      const statusMap = new Map<number, UserStatus>()
      for (const t of tasks) {
        if (!t.user_ids?.length || !t.stage_id || !isStageDoing(t.stage_id[1])) continue
        const projectName = t.project_id ? t.project_id[1] : '—'
        for (const uid of t.user_ids as number[]) {
          const info = userMap.get(uid)
          if (!info) continue
          if (!statusMap.has(uid))
            statusMap.set(uid, { userId: uid, userName: info.name, avatar: info.avatar, doingTasks: [] })
          statusMap.get(uid)!.doingTasks.push({ id: t.id, name: t.name, projectName })
        }
      }
      setUserStatuses(Array.from(statusMap.values()))
    } catch (err) { console.error(err) }
  }, [])

  // ── fetch timesheets ────────────────────────────────────────────────────
  const fetchTimesheets = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const { from, to } = getPeriodRange(p)
      const entries: TimesheetEntry[] = await window.api.getTimesheets(from, to)

      const map = new Map<number, UserGroup>()
      for (const e of entries) {
        if (!e.user_id) continue
        const [userId, userName] = e.user_id
        if (!map.has(userId))
          map.set(userId, { userId, userName, avatar: false, totalHours: 0, todayHours: 0, entries: [] })
        const g = map.get(userId)!
        g.totalHours += e.unit_amount
        g.entries.push(e)
        if (e.date === today) g.todayHours += e.unit_amount
      }

      // Attach avatars from internalUsers if available
      setGroups(Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [today])

  useEffect(() => { fetchUsersActivity(); fetchTimesheets(period) }, [])
  useEffect(() => { fetchTimesheets(period) }, [period, fetchTimesheets])

  const toggleExpand = (userId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  const handleCardClick = (userId: number) => {
    setFilterUserId((prev) => (prev === userId ? null : userId))
    setTab('lancamentos')
    setExpanded((prev) => { const next = new Set(prev); next.add(userId); return next })
  }

  const displayGroups = filterUserId !== null ? groups.filter((g) => g.userId === filterUserId) : groups
  const totalLogged   = groups.reduce((s, g) => s + g.totalHours, 0)
  const todayTotal    = groups.reduce((s, g) => s + g.todayHours, 0)

  // ── analytics data ──────────────────────────────────────────────────────
  const expectedPerPerson = expectedHoursToDate(period)
  const totalEmployees    = internalUsers.length || groups.length
  const totalExpected     = expectedPerPerson * totalEmployees
  const completionPct     = totalExpected > 0 ? Math.min((totalLogged / totalExpected) * 100, 100) : 0
  const activeEmployees   = groups.length

  // Build per-person analytics merging internalUsers + groups
  const NON_COMPLIANT_THRESHOLD = 7

  const analyticsRows = (internalUsers.length > 0
    ? internalUsers.map((u) => {
        const g = groups.find((g) => g.userId === u.id)
        const logged = g?.totalHours ?? 0
        return {
          userId:        u.id,
          userName:      u.name,
          avatar:        u.image_128 || false,
          logged,
          expected:      expectedPerPerson,
          pct:           Math.min((logged / expectedPerPerson) * 100, 100),
          nonCompliant:  logged < NON_COMPLIANT_THRESHOLD,
        }
      })
    : groups.map((g) => ({
        userId:       g.userId,
        userName:     g.userName,
        avatar:       g.avatar,
        logged:       g.totalHours,
        expected:     expectedPerPerson,
        pct:          Math.min((g.totalHours / expectedPerPerson) * 100, 100),
        nonCompliant: g.totalHours < NON_COMPLIANT_THRESHOLD,
      }))
  ).sort((a, b) => b.logged - a.logged)

  return (
    <main className="main-content">
      {/* ── Header ── */}
      <div className="main-header">
        <div>
          <div className="main-title">Escritório</div>
          <div className="main-subtitle">
            {activeEmployees} ativo{activeEmployees !== 1 ? 's' : ''} · {totalLogged.toFixed(1)}h lançadas
            {period !== 'today' && todayTotal > 0 && ` · ${todayTotal.toFixed(1)}h hoje`}
          </div>
        </div>
        <div className="period-filter">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button key={p} className={`period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tab-bar">
        <div className={`tab ${tab === 'analytics'    ? 'active' : ''}`} onClick={() => setTab('analytics')}>
          Analytics
        </div>
        <div className={`tab ${tab === 'lancamentos'  ? 'active' : ''}`} onClick={() => setTab('lancamentos')}>
          Lançamentos
        </div>
      </div>

      <div className="task-list">

        {/* ════════════════ ANALYTICS TAB ════════════════ */}
        {tab === 'analytics' && (
          <>
            {/* KPI cards */}
            <div className="an-kpi-row">
              <div className="an-kpi-card">
                <div className="an-kpi-value">{totalLogged.toFixed(1)}h</div>
                <div className="an-kpi-label">Horas lançadas</div>
                <div className="an-kpi-sub">{periodLabel(period)}</div>
              </div>
              <div className="an-kpi-card">
                <div className="an-kpi-value">{totalExpected.toFixed(0)}h</div>
                <div className="an-kpi-label">Horas esperadas</div>
                <div className="an-kpi-sub">{totalEmployees} pessoa{totalEmployees !== 1 ? 's' : ''} × {expectedPerPerson.toFixed(1)}h</div>
              </div>
              <div className="an-kpi-card an-kpi-highlight" style={{ '--kpi-color': pctColor(completionPct) } as any}>
                <div className="an-kpi-value" style={{ color: pctColor(completionPct) }}>
                  {completionPct.toFixed(0)}%
                </div>
                <div className="an-kpi-label">Cumprimento</div>
                <div className="an-kpi-sub">da meta {periodLabel(period)}</div>
              </div>
              <div className="an-kpi-card">
                <div className="an-kpi-value">{activeEmployees}<span className="an-kpi-denom"> / {totalEmployees}</span></div>
                <div className="an-kpi-label">Funcionários ativos</div>
                <div className="an-kpi-sub">com lançamento {periodLabel(period)}</div>
              </div>
            </div>

            {/* Company progress bar */}
            <div className="an-company-bar-wrap">
              <div className="an-company-bar-header">
                <span>Progresso geral da empresa</span>
                <span style={{ color: pctColor(completionPct) }}>{totalLogged.toFixed(1)}h / {totalExpected.toFixed(0)}h</span>
              </div>
              <div className="an-bar-track">
                <div
                  className="an-bar-fill"
                  style={{ width: `${completionPct}%`, background: pctColor(completionPct) }}
                />
              </div>
            </div>

            {/* Per-person breakdown */}
            <div className="an-section-label">Desempenho por pessoa</div>
            {loading ? (
              <div className="loading"><div className="spinner" />Carregando...</div>
            ) : (
              <div className="an-people-table">
                {analyticsRows.map((r) => (
                  <div key={r.userId} className={`an-person-row ${r.nonCompliant ? 'an-person-row-nc' : ''}`}>
                    <div className="an-person-id">
                      {r.avatar
                        ? <img className="an-avatar" src={`data:image/png;base64,${r.avatar}`} alt={r.userName} />
                        : <span className="an-avatar an-avatar-initials">{r.userName.slice(0, 2).toUpperCase()}</span>
                      }
                      <div className="an-person-name-col">
                        <span className="an-person-name">{r.userName}</span>
                        {r.nonCompliant && (
                          <span className="an-nc-badge">Não conforme</span>
                        )}
                      </div>
                    </div>
                    <div className="an-bar-col">
                      <div className="an-bar-track">
                        <div
                          className="an-bar-fill"
                          style={{ width: `${r.pct}%`, background: pctColor(r.pct) }}
                        />
                      </div>
                    </div>
                    <div className="an-hours-col">
                      <span style={{ color: pctColor(r.pct), fontWeight: 600 }}>{r.logged.toFixed(1)}h</span>
                      <span className="an-hours-expected"> / {r.expected.toFixed(0)}h</span>
                    </div>
                    <div className="an-pct-col" style={{ color: pctColor(r.pct) }}>
                      {r.pct.toFixed(0)}%
                      {r.pct >= 100 && <span className="an-badge-ok"> ✓</span>}
                      {r.pct < 50 && r.logged > 0 && <span className="an-badge-warn"> ⚠</span>}
                      {r.logged === 0 && <span className="an-badge-zero"> —</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════ LANÇAMENTOS TAB ════════════════ */}
        {tab === 'lancamentos' && (
          <>
            {/* Em andamento agora */}
            {userStatuses.length > 0 && (
              <div className="ctrl-doing-section">
                <div className="ctrl-section-label">Em andamento agora</div>
                <div className="ctrl-doing-grid">
                  {userStatuses.map((u) => (
                    <div
                      key={u.userId}
                      className={`ctrl-doing-card ${filterUserId === u.userId ? 'ctrl-doing-card-active' : ''}`}
                      onClick={() => handleCardClick(u.userId)}
                      title="Clique para ver planilha de horas"
                    >
                      <div className="ctrl-avatar">
                        {u.avatar
                          ? <img src={`data:image/png;base64,${u.avatar}`} alt={u.userName} />
                          : <span className="ctrl-avatar-initials">{u.userName.slice(0, 2).toUpperCase()}</span>
                        }
                        <span className="ctrl-avatar-dot" />
                      </div>
                      <div className="ctrl-doing-info">
                        <div className="ctrl-doing-name">{u.userName}</div>
                        <div className="ctrl-doing-task" title={u.doingTasks[0]?.name}>{u.doingTasks[0]?.name || '—'}</div>
                        <div className="ctrl-doing-project">{u.doingTasks[0]?.projectName || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter bar */}
            {filterUserId !== null && (
              <div className="ctrl-filter-bar">
                <span>Filtrando por: <strong>{groups.find((g) => g.userId === filterUserId)?.userName}</strong></span>
                <button className="ctrl-filter-clear" onClick={() => setFilterUserId(null)}>✕ limpar</button>
              </div>
            )}

            {/* Timesheet table */}
            {loading ? (
              <div className="loading"><div className="spinner" />Carregando...</div>
            ) : displayGroups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◇</div>
                Nenhum lançamento encontrado
              </div>
            ) : (
              displayGroups.map((g) => {
                const isOpen = expanded.has(g.userId)
                return (
                  <div key={g.userId} className="ctrl-user-block fade-in">
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
                    {isOpen && (
                      <div className="ctrl-entries">
                        {g.entries.map((e) => (
                          <div key={e.id} className={`ctrl-entry ${e.date === today ? 'ctrl-entry-today' : ''}`}>
                            <span className="ctrl-entry-date">{fmtDate(e.date)}</span>
                            <div className="ctrl-entry-info">
                              <span className="ctrl-entry-task">{e.task_id ? e.task_id[1] : '—'}</span>
                              <span className="ctrl-entry-project">{e.project_id ? e.project_id[1] : '—'}</span>
                            </div>
                            <span className="ctrl-entry-desc" title={e.name}>{e.name || '—'}</span>
                            <span className="ctrl-entry-hours">{e.unit_amount.toFixed(2)}h</span>
                          </div>
                        ))}
                        <div className="ctrl-entries-footer">
                          Total: <strong>{g.totalHours.toFixed(2)}h</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </main>
  )
}
