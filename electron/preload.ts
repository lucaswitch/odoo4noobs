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
  openActivity: (taskId: number, taskName: string, projectId: number, projectName: string) =>
    ipcRenderer.invoke('activity:open', taskId, taskName, projectId, projectName),
  closeActivity: (activityId: string, description: string) =>
    ipcRenderer.invoke('activity:close', activityId, description),
  getHistory: () => ipcRenderer.invoke('activity:history'),
})
