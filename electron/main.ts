import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } from 'electron'
import path from 'node:path'
import * as odoo from './odoo'
import * as store from './store'

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
let tray: Tray | null = null

// ─── Activity reminder ────────────────────────────────────────────────────

const REMINDER_FIRST_MS = 30 * 60 * 1000  // first alert after 30 min
const REMINDER_REPEAT_MS = 60 * 60 * 1000 // then every 1 hour

let reminderTimeout: ReturnType<typeof setTimeout> | null = null
let reminderInterval: ReturnType<typeof setInterval> | null = null

function clearReminders() {
  if (reminderTimeout) { clearTimeout(reminderTimeout); reminderTimeout = null }
  if (reminderInterval) { clearInterval(reminderInterval); reminderInterval = null }
}

function showActivityReminder(taskName: string) {
  const n = new Notification({
    title: 'Ainda trabalhando?',
    body: `Você ainda está na atividade "${taskName}"?`,
    actions: [
      { type: 'button', text: 'Sim, continuar' },
      { type: 'button', text: 'Não, pausar' },
    ],
    closeButtonText: 'Sim, continuar',
  })

  n.on('action', (_e, index) => {
    if (index === 1) {
      // "Não, pausar" — focus the window and trigger pause flow
      if (win) { win.show(); win.focus() }
      win?.webContents.send('activity:pause-prompt')
    }
  })

  n.show()
}

function scheduleReminder() {
  clearReminders()
  const activity = store.getCurrentActivity()
  if (!activity) return

  const elapsed = Date.now() - new Date(activity.startedAt).getTime()
  const firstDelay = Math.max(0, REMINDER_FIRST_MS - elapsed)

  reminderTimeout = setTimeout(() => {
    const current = store.getCurrentActivity()
    if (current) showActivityReminder(current.taskName)

    reminderInterval = setInterval(() => {
      const current = store.getCurrentActivity()
      if (current) showActivityReminder(current.taskName)
      else clearReminders()
    }, REMINDER_REPEAT_MS)
  }, firstDelay)
}

function createTray() {
  // Use tray-icon.png (non-template) for color icon in status bar
  const iconPath = path.join(__dirname, '../build/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 18, height: 18 }))

  tray.setToolTip('odoo4noobs')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir odoo4noobs',
      click: () => {
        if (win) {
          win.show()
          win.focus()
        }
      },
    },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (win) {
      win.isVisible() ? win.focus() : win.show()
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#080b12',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  // Resume reminder if there's already an active activity (app restarted mid-task)
  scheduleReminder()
})

app.on('window-all-closed', () => app.quit())

// --- IPC Handlers ---

// Session
ipcMain.handle('session:check', async () => {
  const session = store.loadSession()
  if (!session) return null
  try {
    const uid = await odoo.authenticate(session.url, session.db, session.login, session.password)
    if (!uid) return null
    // Backfill isAdmin for sessions stored before this feature
    if (session.isAdmin === undefined) {
      session.isAdmin = await odoo.checkIsAdmin(session.url, session.db, session.uid, session.password)
      store.saveSession(session)
    }
    return session
  } catch {}
  return null
})

ipcMain.handle('session:login', async (_e, url: string, login: string, password: string) => {
  const dbs = await odoo.listDatabases(url)
  const db = dbs[0] || 'odoo'

  const uid = await odoo.authenticate(url, db, login, password)
  if (!uid) throw new Error('Credenciais inválidas')

  const [users, isAdmin] = await Promise.all([
    odoo.executeKw(url, db, uid as number, password, 'res.users', 'read', [[uid as number]], { fields: ['name'] }),
    odoo.checkIsAdmin(url, db, uid as number, password),
  ])
  const userName = users[0]?.name || login

  const session = { url, db, login, password, uid: uid as number, userName, isAdmin }
  store.saveSession(session)
  return session
})

ipcMain.handle('session:logout', () => {
  clearReminders()
  store.clearSession()
  return true
})

// Odoo data
ipcMain.handle('odoo:projects', async () => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.getProjects(s.url, s.db, s.uid, s.password)
})

ipcMain.handle('odoo:tasks', async (_e, projectId?: number) => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.getTasks(s.url, s.db, s.uid, s.password, projectId, s.uid)
})

ipcMain.handle('odoo:usernames', async (_e, userIds: number[]) => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.getUserNames(s.url, s.db, s.uid, s.password, userIds)
})

ipcMain.handle('odoo:stages', async (_e, projectId?: number) => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.getStages(s.url, s.db, s.uid, s.password, projectId)
})

ipcMain.handle('odoo:changeStage', async (_e, taskId: number, stageId: number) => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.changeTaskStage(s.url, s.db, s.uid, s.password, taskId, stageId)
})

ipcMain.handle('odoo:tags', async () => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.getTags(s.url, s.db, s.uid, s.password)
})

ipcMain.handle('odoo:createTask', async (_e, name: string, projectId: number, stageId: number, tagIds: number[]) => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.createTask(s.url, s.db, s.uid, s.password, name, projectId, stageId, tagIds)
})

ipcMain.handle('odoo:updateTask', async (_e, taskId: number, name: string, projectId: number, stageId: number, tagIds: number[]) => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.updateTask(s.url, s.db, s.uid, s.password, taskId, name, projectId, stageId, tagIds)
})

// Activity tracking
ipcMain.handle('activity:current', () => store.getCurrentActivity())

ipcMain.handle('activity:open', (_e, taskId: number, taskName: string, projectId: number, projectName: string) => {
  const activity = store.openActivity(taskId, taskName, projectId, projectName)
  scheduleReminder()
  return activity
})

ipcMain.handle('activity:pause', (_e, activityId: string) => {
  clearReminders()
  return store.pauseActivity(activityId)
})

ipcMain.handle('activity:resume', (_e, activityId: string) => {
  const activity = store.resumeActivity(activityId)
  scheduleReminder()
  return activity
})

ipcMain.handle('activity:paused-list', () => store.getPausedActivities())

// Internal users list (for analytics)
ipcMain.handle('odoo:internal-users', async () => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.getInternalUsers(s.url, s.db, s.uid, s.password)
})

// User avatars for task cards
ipcMain.handle('odoo:user-avatars', async (_e, userIds: number[]) => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.getUsersWithAvatars(s.url, s.db, s.uid, s.password, userIds)
})

// Who is doing what (all users, no filter)
ipcMain.handle('odoo:users-activity', async () => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  const tasks = await odoo.getTasks(s.url, s.db, s.uid, s.password)
  const userIds: number[] = [...new Set<number>(tasks.flatMap((t: any) => t.user_ids as number[]))]
  const users = await odoo.getUsersWithAvatars(s.url, s.db, s.uid, s.password, userIds)
  return { tasks, users }
})

// Timesheets (admin)
ipcMain.handle('odoo:timesheets', async (_e, dateFrom: string, dateTo: string) => {
  const s = store.loadSession()
  if (!s) throw new Error('Sem sessão')
  return odoo.getTimesheets(s.url, s.db, s.uid, s.password, dateFrom, dateTo)
})

ipcMain.handle('activity:close', async (_e, activityId: string, description: string) => {
  clearReminders()
  const activity = store.closeActivity(activityId, description)
  if (!activity) throw new Error('Atividade não encontrada')

  const s = store.loadSession()
  if (s && activity.durationHours) {
    try {
      const date = activity.closedAt!.split('T')[0]
      await odoo.createTimesheet(
        s.url,
        s.db,
        s.uid,
        s.password,
        activity.taskId,
        activity.projectId,
        description,
        Math.round(activity.durationHours * 100) / 100,
        date
      )
      store.markActivitySynced(activityId)
      activity.synced = true
    } catch (err) {
      console.error('Falha ao enviar timesheet:', err)
    }
  }

  return activity
})

ipcMain.handle('activity:history', () => store.getActivityHistory())
