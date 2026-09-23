import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { FeatureCard } from '../components/FeatureCard'
import '../App.css'

const features = [
  ['01', '盯緊熱門航線', 'Always-on route watching', '持續監控台北出發的熱門航線（東京、首爾），自動抓最低票價。'],
  ['02', '達標自動通知', 'Target-price email alerts', '低於你設定的目標價，就寄 email 提醒你，附上立即訂購連結。'],
  ['03', '隨時取消', 'Cancel anytime', '月訂閱制，不想用隨時停，沒有綁約。'],
]

export function LandingPage() {
  return <div className="site-shell"><AppHeader /><main className="landing-main"><section className="hero-section"><div className="hero-copy"><p className="eyebrow">Travel smarter from Taipei</p><h1 className="hero-title">設定航線與目標價，機票降價就通知你</h1><p className="hero-subtitle">Set a route and a target price - we email you when the fare drops.</p><div className="hero-actions"><Link className="button" to="/sign-up">Start watching fares</Link><Link className="text-link" to="/sign-in">Already a member? Sign in</Link></div></div></section><section className="feature-section"><h2 className="feature-heading">A calmer way to catch a better fare.</h2><div className="feature-grid">{features.map(([number, title, subtitle, description]) => <FeatureCard key={number} number={number} title={title} subtitle={subtitle} description={description} />)}</div></section></main><footer className="site-footer">© 2026 Flight Price Notifier</footer></div>
}