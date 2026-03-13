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

// Active = running (not paused, not closed)
export function getCurrentActivity(): TrackedActivity | null {
  return loadActivities().find((a) => !a.closedAt && !a.pausedAt) || null
}

// Paused = stopped temporarily (not closed)
export function getPausedActivities(): TrackedActivity[] {
  return loadActivities().filter((a) => !a.closedAt && !!a.pausedAt)
}

export function openActivity(
  taskId: number,
  taskName: string,
  projectId: number,
  projectName: string
): TrackedActivity {
  const activities = loadActivities()

  // Auto-pause any currently running activity
  const runningIdx = activities.findIndex((a) => !a.closedAt && !a.pausedAt)
  if (runningIdx !== -1) {
    const now = new Date()
    const elapsed = now.getTime() - new Date(activities[runningIdx].startedAt).getTime()
    activities[runningIdx].accumulatedMs = (activities[runningIdx].accumulatedMs || 0) + elapsed
    activities[runningIdx].pausedAt = now.toISOString()
  }

  const activity: TrackedActivity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    taskName,
    projectId,
    projectName,
    startedAt: new Date().toISOString(),
    accumulatedMs: 0,
    synced: false,
  }

  activities.push(activity)
  saveActivities(activities)
  return activity
}

export function pauseActivity(activityId: string): TrackedActivity | null {
  const activities = loadActivities()
  const idx = activities.findIndex((a) => a.id === activityId)
  if (idx === -1) return null

  const now = new Date()
  const elapsed = now.getTime() - new Date(activities[idx].startedAt).getTime()
  activities[idx].accumulatedMs = (activities[idx].accumulatedMs || 0) + elapsed
  activities[idx].pausedAt = now.toISOString()

  saveActivities(activities)
  return activities[idx]
}

export function resumeActivity(activityId: string): TrackedActivity | null {
  const activities = loadActivities()

  // Auto-pause any currently running activity
  const runningIdx = activities.findIndex((a) => !a.closedAt && !a.pausedAt)
  if (runningIdx !== -1) {
    const now = new Date()
    const elapsed = now.getTime() - new Date(activities[runningIdx].startedAt).getTime()
    activities[runningIdx].accumulatedMs = (activities[runningIdx].accumulatedMs || 0) + elapsed
    activities[runningIdx].pausedAt = now.toISOString()
  }

  const idx = activities.findIndex((a) => a.id === activityId)
  if (idx === -1) { saveActivities(activities); return null }

  activities[idx].pausedAt = undefined
  activities[idx].startedAt = new Date().toISOString()

  saveActivities(activities)
  return activities[idx]
}

export function closeActivity(
  activityId: string,
  description: string
): TrackedActivity | null {
  const activities = loadActivities()
  const idx = activities.findIndex((a) => a.id === activityId)
  if (idx === -1) return null

  const now = new Date()
  const sessionMs = now.getTime() - new Date(activities[idx].startedAt).getTime()
  const totalMs = (activities[idx].accumulatedMs || 0) + sessionMs

  activities[idx].closedAt = now.toISOString()
  activities[idx].pausedAt = undefined
  activities[idx].description = description
  activities[idx].durationHours = totalMs / 3600000

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
