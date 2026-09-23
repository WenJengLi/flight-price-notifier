import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import '../App.css'

export function AppPage() {
  return <div className="site-shell"><AppHeader /><main className="app-page"><section className="app-panel" aria-labelledby="app-heading"><p className="phase-note">PHASE A PLACEHOLDER</p><h1 id="app-heading">Your flight watch dashboard</h1><p>你的航線追蹤儀表板即將上線 - 下一個里程碑會加上訂閱航線的功能。</p><Link className="button button-secondary" to="/">Back to home</Link></section></main></div>
}