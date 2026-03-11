import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { login } from '../store/sessionSlice'
import type { Session } from '../types'
import logoImg from '../assets/logo.png'

declare global {
  interface Window {
    api: {
      checkSession: () => Promise<Session | null>
      login: (url: string, login: string, password: string) => Promise<Session>
      logout: () => Promise<boolean>
      getProjects: () => Promise<any[]>
      getTasks: (projectId?: number) => Promise<any[]>
      getUserNames: (ids: number[]) => Promise<Record<number, string>>
      getStages: (projectId?: number) => Promise<any[]>
      changeTaskStage: (taskId: number, stageId: number) => Promise<boolean>
      getCurrentActivity: () => Promise<any>
      openActivity: (taskId: number, taskName: string, projectId: number, projectName: string) => Promise<any>
      closeActivity: (activityId: string, description: string) => Promise<any>
      getHistory: () => Promise<any[]>
    }
  }
}

export default function Login() {
  const dispatch = useAppDispatch()
  const { loading, error } = useAppSelector((s) => s.session)
  const [url, setUrl] = useState('')
  const [loginVal, setLoginVal] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    dispatch(login({ url: url.replace(/\/+$/, ''), login: loginVal, password }))
  }

  return (
    <div className="login-container">
      <div className="titlebar-drag" />
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={logoImg} alt="odoo4noobs" className="login-logo" />
        <div className="login-tagline">Odoo para noobs — tracker & timesheet</div>

        {error && <div className="login-error">{error}</div>}

        <div className="field">
          <label>Servidor Odoo</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://seu-odoo.com"
            required
          />
        </div>

        <div className="field">
          <label>Email / Login</label>
          <input
            type="text"
            value={loginVal}
            onChange={(e) => setLoginVal(e.target.value)}
            placeholder="usuario@empresa.com"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Conectando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
