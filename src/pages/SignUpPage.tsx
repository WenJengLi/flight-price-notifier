import { AppHeader } from '../components/AppHeader'
import { AuthForm } from '../components/AuthForm'
import '../App.css'

export function SignUpPage() {
  return <div className="site-shell"><AppHeader /><main className="auth-page"><section className="auth-panel" aria-labelledby="sign-up-heading"><p className="eyebrow">Flight Price Notifier</p><h1 id="sign-up-heading">Create your account</h1><p className="panel-intro">Set up your account now. Secure email authentication arrives in the next phase.</p><AuthForm actionLabel="Create account" alternateLabel="Sign in" alternatePath="/sign-in" alternatePrompt="Already have an account?" /></section></main></div>
}