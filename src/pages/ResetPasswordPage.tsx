import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../hooks/useAuth'
import '../App.css'

export function ResetPasswordPage() {
  const { loading, session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致。')
      return
    }

    setSubmitting(true)
    const updateError = await updatePassword(password)
    if (updateError) {
      setError(updateError)
      setSubmitting(false)
      return
    }

    navigate('/app', { replace: true })
  }

  return <div className="site-shell">
    <AppHeader />
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="reset-password-heading">
        <p className="eyebrow">Secure your account</p>
        <h1 id="reset-password-heading">設定新密碼</h1>
        {loading ? <p className="panel-intro">正在確認重設連結...</p> : !session ? <div className="auth-form">
          <p className="auth-status auth-error" role="alert">重設連結無效或已過期，請重新寄送一封密碼重設郵件。</p>
          <Link className="button" to="/forgot-password">重新寄送連結</Link>
        </div> : <>
          <p className="panel-intro">請設定至少 8 個字元的新密碼。</p>
          <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="form-field">
              <label htmlFor="new-password">新密碼</label>
              <input autoComplete="new-password" id="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-password">再次輸入新密碼</label>
              <input autoComplete="new-password" id="confirm-password" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
            </div>
            {error && <p className="auth-status auth-error" role="alert">{error}</p>}
            <button className="button" disabled={submitting} type="submit">{submitting ? '更新中...' : '更新密碼'}</button>
          </form>
        </>}
      </section>
    </main>
  </div>
}