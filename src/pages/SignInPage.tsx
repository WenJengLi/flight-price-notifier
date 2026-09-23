import { AppHeader } from '../components/AppHeader'
import { AuthForm } from '../components/AuthForm'
import '../App.css'

export function SignInPage() {
  return <div className="site-shell"><AppHeader /><main className="auth-page"><section className="auth-panel" aria-labelledby="sign-in-heading"><p className="eyebrow">Welcome back</p><h1 id="sign-in-heading">Sign in</h1><p className="panel-intro">Your fare watchlist will be ready when authentication is connected.</p><AuthForm actionLabel="Sign in" alternateLabel="Create an account" alternatePath="/sign-up" alternatePrompt="New to Flight Price Notifier?" /></section></main></div>
}