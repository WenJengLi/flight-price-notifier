import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { FeatureCard } from '../components/FeatureCard'
import '../App.css'

const features = [
  ['01', '選好想去的地方', 'Choose your destination', '從台北出發，選擇想追蹤的航線，不必一張張機票自己找。'],
  ['02', '設定你的理想價格', 'Set your price', '輸入你願意付的目標價，讓我們持續留意符合預算的票價。'],
  ['03', '降價時收到通知', 'Get an email alert', '找到符合目標的票價時寄信提醒你，再由你決定要不要訂票。'],
]

export function LandingPage() {
  return (
    <div className="site-shell landing-shell">
      <AppHeader />
      <main className="landing-main">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" /> 從台北出發，聰明等好價</p>
            <h1 className="hero-title" id="hero-title">設定航線與目標價，<span>機票降價就通知你。</span></h1>
            <p className="hero-subtitle">不用每天打開訂票網站。告訴我們你想去哪裡、預算是多少；找到符合目標的票價，就寄一封信提醒你。</p>
            <div className="hero-actions">
              <Link className="button hero-primary" to="/sign-up">開始追蹤航線 <span aria-hidden="true">↗</span></Link>
              <Link className="hero-signin" to="/sign-in">已有帳號？登入 <span aria-hidden="true">→</span></Link>
            </div>
            <p className="hero-footnote">選航線 · 設目標價 · 收降價通知</p>
          </div>
          <div className="hero-visual" aria-label="台北到首爾的機票降價通知介面示意，非即時票價">
            <div className="visual-orbit visual-orbit-one" aria-hidden="true" />
            <div className="visual-orbit visual-orbit-two" aria-hidden="true" />
            <div className="fare-preview">
              <div className="preview-topline"><span className="preview-icon" aria-hidden="true">✳</span><span>YOUR FLIGHT WATCH</span><span className="preview-live">追蹤中</span></div>
              <div className="preview-route">
                <div><strong>TPE</strong><span>台北</span></div>
                <div className="preview-flightpath" aria-hidden="true"><span>✈</span></div>
                <div><strong>SEL</strong><span>首爾</span></div>
              </div>
              <div className="preview-divider" />
              <div className="preview-price"><span>你設定的目標價格</span><strong>NT$ 5,500</strong></div>
              <div className="preview-alert"><span className="preview-alert-icon" aria-hidden="true">↘</span><div><strong>找到符合預算的票價</strong><span>降價通知將寄到你的信箱</span></div><span aria-hidden="true">↗</span></div>
              <p className="preview-disclaimer">畫面示意 · 非即時票價</p>
            </div>
          </div>
        </section>

        <section className="feature-section" aria-labelledby="feature-heading">
          <div className="feature-inner">
            <div className="section-intro">
              <p className="section-kicker">HOW IT WORKS / 使用方式</p>
              <h2 className="feature-heading" id="feature-heading">把找票的時間，<br />留給更值得的事。</h2>
              <p>三個簡單步驟，讓旅程從剛好的價格開始。</p>
            </div>
            <div className="feature-grid">
              {features.map(([number, title, subtitle, description]) => (
                <FeatureCard key={number} number={number} title={title} subtitle={subtitle} description={description} />
              ))}
            </div>
          </div>
        </section>

        <section className="landing-cta" aria-labelledby="cta-heading">
          <div>
            <p className="section-kicker">YOUR NEXT TRIP STARTS HERE</p>
            <h2 id="cta-heading">下次出發，不必靠運氣等好價。</h2>
            <p>挑一條想去的航線，設定屬於你的理想價格。</p>
          </div>
          <Link className="button cta-button" to="/sign-up">開始追蹤航線 <span aria-hidden="true">↗</span></Link>
        </section>
      </main>
      <footer className="site-footer">© 2026 Flight Price Notifier <span>從台北出發，去想去的地方。</span></footer>
    </div>
  )
}