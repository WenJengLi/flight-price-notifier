import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../hooks/useAuth'
import '../App.css'

export function ForgotPasswordPage() {
  const { sendPasswordResetEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const resetError = await sendPasswordResetEmail(email.trim())
    if (resetError) {
      setError(resetError)
    } else {
      setSent(true)
    }
    setSubmitting(false)
  }

  return <div className="site-shell">
    <AppHeader />
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="forgot-password-heading">
        <p className="eyebrow">Account recovery</p>
        <h1 id="forgot-password-heading">忘記密碼</h1>
        <p className="panel-intro">輸入註冊信箱，我們會寄送安全的密碼重設連結。</p>
        {sent ? <div className="auth-form">
          <p className="auth-status" role="status">如果這個信箱已註冊，密碼重設郵件很快就會寄達。請檢查收件匣與垃圾郵件匣。</p>
          <Link className="button" to="/sign-in">返回登入</Link>
        </div> : <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-field">
            <label htmlFor="reset-email">Email</label>
            <input autoComplete="email" id="reset-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </div>
          {error && <p className="auth-status auth-error" role="alert">{error}</p>}
          <button className="button" disabled={submitting} type="submit">{submitting ? '寄送中...' : '寄送重設連結'}</button>
          <p className="form-footnote"><Link className="text-link" to="/sign-in">返回登入</Link></p>
        </form>}
      </section>
    </main>
  </div>
}