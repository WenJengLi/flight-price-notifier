import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type AuthFormProps = {
  actionLabel: string
  alternateLabel: string
  alternatePath: string
  alternatePrompt: string
  mode: 'sign-in' | 'sign-up'
}

export function AuthForm({ actionLabel, alternateLabel, alternatePath, alternatePrompt, mode }: AuthFormProps) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)

    if (mode === 'sign-in') {
      const signInError = await signIn(email, password)
      if (signInError) {
        setError(signInError)
      } else {
        navigate('/app', { replace: true })
      }
    } else {
      const result = await signUp(email, password)
      if (result.error) {
        setError(result.error)
      } else if (result.requiresEmailConfirmation) {
        setMessage('Check your email to confirm your account, then sign in.')
      } else {
        navigate('/app', { replace: true })
      }
    }

    setSubmitting(false)
  }

  return <form className="auth-form" onSubmit={handleSubmit}><div className="form-field"><label htmlFor="email">Email</label><input autoComplete="email" id="email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} /></div><div className="form-field"><label htmlFor="password">Password</label><input autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} id="password" minLength={8} name="password" onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={password} /></div>{error && <p className="auth-status auth-error" role="alert">{error}</p>}{message && <p className="auth-status" role="status">{message}</p>}<button className="button" disabled={submitting} type="submit">{submitting ? 'Please wait...' : actionLabel}</button><p className="form-footnote">{alternatePrompt} <Link className="text-link" to={alternatePath}>{alternateLabel}</Link></p></form>
}