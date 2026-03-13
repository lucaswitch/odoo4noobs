import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Session
  checkSession: () => ipcRenderer.invoke('session:check'),
  login: (url: string, login: string, password: string) =>
    ipcRenderer.invoke('session:login', url, login, password),
  logout: () => ipcRenderer.invoke('session:logout'),

  // Odoo data
  getProjects: () => ipcRenderer.invoke('odoo:projects'),
  getTasks: (projectId?: number) => ipcRenderer.invoke('odoo:tasks', projectId),
  getUserNames: (userIds: number[]) => ipcRenderer.invoke('odoo:usernames', userIds),
  getStages: (projectId?: number) => ipcRenderer.invoke('odoo:stages', projectId),
  changeTaskStage: (taskId: number, stageId: number) =>
    ipcRenderer.invoke('odoo:changeStage', taskId, stageId),

  // Activity tracking
  getCurrentActivity: () => ipcRenderer.invoke('activity:current'),
  getPausedActivities: () => ipcRenderer.invoke('activity:paused-list'),
  openActivity: (taskId: number, taskName: string, projectId: number, projectName: string) =>
    ipcRenderer.invoke('activity:open', taskId, taskName, projectId, projectName),
  pauseActivity: (activityId: string) => ipcRenderer.invoke('activity:pause', activityId),
  resumeActivity: (activityId: string) => ipcRenderer.invoke('activity:resume', activityId),
  closeActivity: (activityId: string, description: string) =>
    ipcRenderer.invoke('activity:close', activityId, description),
  getHistory: () => ipcRenderer.invoke('activity:history'),

  // Admin
  getInternalUsers: () => ipcRenderer.invoke('odoo:internal-users'),
  getUserAvatars: (userIds: number[]) => ipcRenderer.invoke('odoo:user-avatars', userIds),
  getUsersActivity: () => ipcRenderer.invoke('odoo:users-activity'),
  getTimesheets: (dateFrom: string, dateTo: string) =>
    ipcRenderer.invoke('odoo:timesheets', dateFrom, dateTo),

  // Notification-triggered pause
  onPausePrompt: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('activity:pause-prompt', handler)
    return () => ipcRenderer.removeListener('activity:pause-prompt', handler)
  },
})
