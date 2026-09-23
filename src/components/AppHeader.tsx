import { Link } from 'react-router-dom'

export function AppHeader() {
  return (
    <header className="site-header">
      <Link className="brand" to="/">Flight Price Notifier</Link>
      <Link className="nav-link" to="/sign-in">Sign in / 登入</Link>
    </header>
  )
}