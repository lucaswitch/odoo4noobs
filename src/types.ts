export interface Session {
  url: string
  db: string
  login: string
  password: string
  uid: number
  userName: string
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
  closedAt?: string
  description?: string
  durationHours?: number
  synced: boolean
}
