import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'node:path'
import * as odoo from './odoo'
import * as store from './store'

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
let tray: Tray | null = null

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
})

app.on('window-all-closed', () => app.quit())

// --- IPC Handlers ---

// Session
ipcMain.handle('session:check', async () => {
  const session = store.loadSession()
  if (!session) return null
  try {
    const uid = await odoo.authenticate(session.url, session.db, session.login, session.password)
    if (uid) return session
  } catch {}
  return null
})

ipcMain.handle('session:login', async (_e, url: string, login: string, password: string) => {
  const dbs = await odoo.listDatabases(url)
  const db = dbs[0] || 'odoo'

  const uid = await odoo.authenticate(url, db, login, password)
  if (!uid) throw new Error('Credenciais inválidas')

  const users = await odoo.executeKw(url, db, uid as number, password, 'res.users', 'read', [[uid as number]], {
    fields: ['name'],
  })
  const userName = users[0]?.name || login

  const session = { url, db, login, password, uid: uid as number, userName }
  store.saveSession(session)
  return session
})

ipcMain.handle('session:logout', () => {
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
  return odoo.getTasks(s.url, s.db, s.uid, s.password, projectId)
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

// Activity tracking
ipcMain.handle('activity:current', () => store.getCurrentActivity())

ipcMain.handle('activity:open', (_e, taskId: number, taskName: string, projectId: number, projectName: string) => {
  return store.openActivity(taskId, taskName, projectId, projectName)
})

ipcMain.handle('activity:close', async (_e, activityId: string, description: string) => {
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
