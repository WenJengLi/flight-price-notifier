import { Route, Routes } from 'react-router-dom'
import { AppPage } from './pages/AppPage'
import { LandingPage } from './pages/LandingPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/app" element={<AppPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  )
}
