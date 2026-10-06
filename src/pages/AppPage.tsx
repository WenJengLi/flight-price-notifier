import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../hooks/useAuth'
import { getSubscriptions, saveSubscription, type FlightPlan, type Subscription } from '../lib/flightApi'
import '../App.css'

const plans: Array<{ name: FlightPlan; route: string; title: string; hint: string; suggestedPrice: number }> = [
  { name: 'tokyo', route: 'TPE-TYO', title: '台北 to 東京', hint: 'Tokyo fares often start around NT$9,325.', suggestedPrice: 10000 },
  { name: 'seoul', route: 'TPE-SEL', title: '台北 to 首爾', hint: 'Seoul fares often start around NT$5,989.', suggestedPrice: 7000 },
  { name: 'london', route: 'TPE-LON', title: '台北 to 倫敦', hint: 'Set your ideal TWD fare for London.', suggestedPrice: 30000 },
]

export function AppPage() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [targetPrices, setTargetPrices] = useState<Record<FlightPlan, string>>({ tokyo: '10000', seoul: '7000', london: '30000' })
  const [loading, setLoading] = useState(true)
  const [savingPlan, setSavingPlan] = useState<FlightPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadSubscriptions() {
      if (!user?.email) {
        return
      }

      try {
        const nextSubscriptions = await getSubscriptions(user.email)
        if (active) {
          setSubscriptions(nextSubscriptions)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load your subscriptions.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadSubscriptions()
    return () => { active = false }
  }, [user?.email])

  async function handleSignOut() {
    const error = await signOut()
    if (!error) {
      navigate('/', { replace: true })
    }
  }

  async function handleSubscribe(planName: FlightPlan) {
    const targetPrice = Number(targetPrices[planName])
    if (!user?.email || !Number.isFinite(targetPrice) || targetPrice <= 0) {
      setError('Enter a positive target price in TWD.')
      return
    }

    setError(null)
    setSavingPlan(planName)

    try {
      const subscription = await saveSubscription(user.email, planName, targetPrice)
      setSubscriptions((current) => [...current.filter((item) => item.plan_name !== planName), subscription])
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your subscription.')
    } finally {
      setSavingPlan(null)
    }
  }

  return <div className="site-shell"><AppHeader /><main className="app-page"><section className="app-panel dashboard-panel" aria-labelledby="app-heading"><p className="phase-note">SIGNED IN AS {user?.email}</p><div className="dashboard-heading"><div><h1 id="app-heading">Your flight watch dashboard</h1><p>設定目標價格，票價達標時我們會寄信通知你。</p></div><button className="button button-secondary" onClick={handleSignOut} type="button">Sign out</button></div>{error && <p className="auth-status auth-error" role="alert">{error}</p>}<div className="watch-grid">{plans.map((plan) => { const subscription = subscriptions.find((item) => item.plan_name === plan.name); return <article className="watch-card" key={plan.name}><div className="watch-card-heading"><div><p className="phase-note">{plan.route}</p><h2>{plan.title}</h2></div>{subscription && <span className="subscription-badge">已訂閱</span>}</div><p>{plan.hint}</p><label className="price-field" htmlFor={`${plan.name}-price`}>Target price (TWD)<input id={`${plan.name}-price`} inputMode="numeric" min="1" onChange={(event) => setTargetPrices((current) => ({ ...current, [plan.name]: event.target.value }))} type="number" value={targetPrices[plan.name]} /></label>{subscription && <p className="subscription-detail">目前目標：NT${subscription.target_price.toLocaleString()}</p>}<button className="button" disabled={loading || savingPlan === plan.name} onClick={() => void handleSubscribe(plan.name)} type="button">{savingPlan === plan.name ? 'Saving...' : subscription ? '更新目標價' : '開始追蹤'}</button></article> })}</div>{loading && <p className="auth-status" role="status">Loading your subscriptions...</p>}</section></main></div>
}