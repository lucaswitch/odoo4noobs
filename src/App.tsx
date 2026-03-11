import { useEffect } from 'react'
import { useAppSelector, useAppDispatch } from './store/hooks'
import { checkSession, logout } from './store/sessionSlice'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

export default function App() {
  const dispatch = useAppDispatch()
  const { session, loading } = useAppSelector((s) => s.session)

  useEffect(() => {
    if (session) {
      dispatch(checkSession())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    window.api.logout()
    dispatch(logout())
  }

  if (loading && !session) {
    return (
      <>
        <div className="titlebar-drag" />
        <div className="loading" style={{ height: '100vh' }}>
          <div className="spinner" />
          Verificando sessão...
        </div>
      </>
    )
  }

  if (!session) {
    return <Login />
  }

  return <Dashboard session={session} onLogout={handleLogout} />
}
