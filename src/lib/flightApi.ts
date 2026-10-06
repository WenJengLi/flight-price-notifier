export type FlightPlan = 'tokyo' | 'seoul' | 'london'

export type Subscription = {
  email: string
  route: string
  plan_name: FlightPlan
  origin: string
  destination: string
  target_price: number
  currency: 'TWD'
  created_at: string
  updated_at: string
}

const apiUrl = import.meta.env.VITE_FLIGHT_API_URL

function requireApiUrl() {
  if (!apiUrl) {
    throw new Error('Flight API configuration is missing.')
  }
  return apiUrl
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? 'The flight service is unavailable. Please try again.')
  }
  return payload
}

export async function getSubscriptions(email: string) {
  const response = await fetch(`${requireApiUrl()}/subscriptions?email=${encodeURIComponent(email)}`)
  const payload = await readResponse(response) as { subscriptions: Subscription[] }
  return payload.subscriptions
}

export async function saveSubscription(email: string, planName: FlightPlan, targetPrice: number) {
  const response = await fetch(`${requireApiUrl()}/subscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, plan_name: planName, target_price: targetPrice }),
  })

  return readResponse(response) as Promise<Subscription>
}