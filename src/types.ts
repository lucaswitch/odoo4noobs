export interface Session {
  url: string
  db: string
  login: string
  password: string
  uid: number
  userName: string
  isAdmin: boolean
}

export interface TimesheetEntry {
  id: number
  name: string
  date: string
  unit_amount: number
  project_id: [number, string] | false
  task_id: [number, string] | false
  user_id: [number, string] | false
}

export interface OdooProject {
  id: number
  name: string
  task_count: number
  user_id: [number, string] | false
}

export interface OdooTask {
  id: number
  name: string
  project_id: [number, string] | false
  stage_id: [number, string] | false
  date_deadline: string | false
  priority: string
  kanban_state: string
  user_ids: number[]
}

export interface TrackedActivity {
  id: string
  taskId: number
  taskName: string
  projectId: number
  projectName: string
  startedAt: string
  pausedAt?: string
  accumulatedMs: number
  closedAt?: string
  description?: string
  durationHours?: number
  synced: boolean
}
