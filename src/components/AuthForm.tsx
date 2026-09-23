import { Link } from 'react-router-dom'

type AuthFormProps = { actionLabel: string; alternateLabel: string; alternatePath: string; alternatePrompt: string }

export function AuthForm({ actionLabel, alternateLabel, alternatePath, alternatePrompt }: AuthFormProps) {
  return <form className="auth-form" onSubmit={(event) => event.preventDefault()}><div className="form-field"><label htmlFor="email">Email</label><input autoComplete="email" id="email" name="email" placeholder="you@example.com" type="email" /></div><div className="form-field"><label htmlFor="password">Password</label><input autoComplete="current-password" id="password" name="password" placeholder="At least 8 characters" type="password" /></div><button className="button" type="submit">{actionLabel}</button><p className="form-footnote">{alternatePrompt} <Link className="text-link" to={alternatePath}>{alternateLabel}</Link></p></form>
}