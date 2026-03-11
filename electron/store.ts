import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { Session, TrackedActivity } from '../src/types'

const STORE_DIR = path.join(os.homedir(), '.odoogugu')
const SESSION_FILE = path.join(STORE_DIR, 'session.json')
const ACTIVITIES_FILE = path.join(STORE_DIR, 'activities.json')

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true })
  }
}

// --- Session ---

export function loadSession(): Session | null {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
    }
  } catch {}
  return null
}

export function saveSession(session: Session): void {
  ensureDir()
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2))
}

export function clearSession(): void {
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE)
  } catch {}
}

// --- Activities ---

function loadActivities(): TrackedActivity[] {
  try {
    if (fs.existsSync(ACTIVITIES_FILE)) {
      return JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf-8'))
    }
  } catch {}
  return []
}

function saveActivities(activities: TrackedActivity[]): void {
  ensureDir()
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activities, null, 2))
}

export function getCurrentActivity(): TrackedActivity | null {
  const activities = loadActivities()
  return activities.find((a) => !a.closedAt) || null
}

export function openActivity(
  taskId: number,
  taskName: string,
  projectId: number,
  projectName: string
): TrackedActivity {
  const activities = loadActivities()

  // Close any currently open activity first
  const openIdx = activities.findIndex((a) => !a.closedAt)
  if (openIdx !== -1) {
    activities[openIdx].closedAt = new Date().toISOString()
    const start = new Date(activities[openIdx].startedAt).getTime()
    const end = new Date(activities[openIdx].closedAt!).getTime()
    activities[openIdx].durationHours = (end - start) / 3600000
  }

  const activity: TrackedActivity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    taskName,
    projectId,
    projectName,
    startedAt: new Date().toISOString(),
    synced: false,
  }

  activities.push(activity)
  saveActivities(activities)
  return activity
}

export function closeActivity(
  activityId: string,
  description: string
): TrackedActivity | null {
  const activities = loadActivities()
  const idx = activities.findIndex((a) => a.id === activityId)
  if (idx === -1) return null

  const now = new Date()
  activities[idx].closedAt = now.toISOString()
  activities[idx].description = description
  const start = new Date(activities[idx].startedAt).getTime()
  activities[idx].durationHours = (now.getTime() - start) / 3600000

  saveActivities(activities)
  return activities[idx]
}

export function markActivitySynced(activityId: string): void {
  const activities = loadActivities()
  const idx = activities.findIndex((a) => a.id === activityId)
  if (idx !== -1) {
    activities[idx].synced = true
    saveActivities(activities)
  }
}

export function getActivityHistory(): TrackedActivity[] {
  return loadActivities().filter((a) => !!a.closedAt).reverse()
}
