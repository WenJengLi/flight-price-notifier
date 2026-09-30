import { useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../hooks/useAuth'
import '../App.css'

export function AppPage() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    const error = await signOut()
    if (!error) {
      navigate('/', { replace: true })
    }
  }

  return <div className="site-shell"><AppHeader /><main className="app-page"><section className="app-panel" aria-labelledby="app-heading"><p className="phase-note">SIGNED IN AS {user?.email}</p><h1 id="app-heading">Your flight watch dashboard</h1><p>你的航線追蹤儀表板即將上線 - 下一個里程碑會加上訂閱航線的功能。</p><button className="button button-secondary" onClick={handleSignOut} type="button">Sign out</button></section></main></div>
}