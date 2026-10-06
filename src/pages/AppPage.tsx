import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../hooks/useAuth'
import { cancelSubscription, getSubscriptions, saveSubscription, type FlightPlan, type Subscription } from '../lib/flightApi'
import '../App.css'

const plans: Array<{ name: FlightPlan; route: string; title: string; hint: string; suggestedPrice: number }> = [
  { name: 'tokyo', route: 'TPE-TYO', title: '台北 to 東京', hint: 'Tokyo fares often start around NT$9,325.', suggestedPrice: 10000 },
  { name: 'seoul', route: 'TPE-SEL', title: '台北 to 首爾', hint: 'Seoul fares often start around NT$5,989.', suggestedPrice: 7000 },
  { name: 'london', route: 'TPE-LON', title: '台北 to 倫敦', hint: 'Set your ideal TWD fare for London.', suggestedPrice: 30000 },
]

const statusLabels = {
  pending_payment: '未完成付款',
  active: '已訂閱',
  cancelled: '已取消',
  expired: '已結束',
} as const

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
      const result = await saveSubscription(user.email, planName, targetPrice)
      if (result.kind === 'checkout') {
        document.open()
        document.write(result.html)
        document.close()
        return
      }

      setSubscriptions((current) => [...current.filter((item) => item.plan_name !== planName), result.subscription])
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your subscription.')
    } finally {
      setSavingPlan(null)
    }
  }

  async function handleCancel(subscription: Subscription) {
    if (!user?.email) {
      return
    }

    setError(null)
    setSavingPlan(subscription.plan_name)

    try {
      const updatedSubscription = await cancelSubscription(user.email, subscription.route)
      setSubscriptions((current) => current.map((item) => item.plan_name === subscription.plan_name ? updatedSubscription : item))
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel your subscription.')
    } finally {
      setSavingPlan(null)
    }
  }

  return <div className="site-shell">
    <AppHeader />
    <main className="app-page">
      <section className="app-panel dashboard-panel" aria-labelledby="app-heading">
        <p className="phase-note">SIGNED IN AS {user?.email}</p>
        <div className="dashboard-heading">
          <div>
            <h1 id="app-heading">Your flight watch dashboard</h1>
            <p>設定目標價格，完成付款後，票價達標時我們會寄信通知你。</p>
          </div>
          <button className="button button-secondary" onClick={handleSignOut} type="button">Sign out</button>
        </div>
        {error && <p className="auth-status auth-error" role="alert">{error}</p>}
        <div className="watch-grid">
          {plans.map((plan) => {
            const subscription = subscriptions.find((item) => item.plan_name === plan.name)
            const status = subscription?.subscription_status ?? (subscription ? 'pending_payment' : undefined)
            const isBusy = loading || savingPlan === plan.name
            const actionLabel = !subscription || status === 'expired'
              ? '開始追蹤並付款'
              : status === 'pending_payment'
                ? '完成付款'
                : '更新目標價'

            return <article className="watch-card" key={plan.name}>
              <div className="watch-card-heading">
                <div>
                  <p className="phase-note">{plan.route}</p>
                  <h2>{plan.title}</h2>
                </div>
                {status && <span className="subscription-badge">{statusLabels[status]}</span>}
              </div>
              <p>{plan.hint}</p>
              <label className="price-field" htmlFor={`${plan.name}-price`}>
                Target price (TWD)
                <input id={`${plan.name}-price`} inputMode="numeric" min="1" onChange={(event) => setTargetPrices((current) => ({ ...current, [plan.name]: event.target.value }))} type="number" value={targetPrices[plan.name]} />
              </label>
              {subscription && <p className="subscription-detail">目前目標：NT${subscription.target_price.toLocaleString()}</p>}
              {status === 'cancelled' && subscription && <p className="subscription-detail">有效至：{subscription.current_period_end_date ?? subscription.current_period_end ?? '本期結束'}</p>}
              <div className="watch-card-actions">
                <button className="button" disabled={isBusy} onClick={() => void handleSubscribe(plan.name)} type="button">{isBusy ? 'Saving...' : actionLabel}</button>
                {status === 'active' && subscription && <button className="button button-secondary" disabled={isBusy} onClick={() => void handleCancel(subscription)} type="button">取消訂閱</button>}
              </div>
            </article>
          })}
        </div>
        {loading && <p className="auth-status" role="status">Loading your subscriptions...</p>}
      </section>
    </main>
  </div>
}