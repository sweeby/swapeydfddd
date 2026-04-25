import { normalizePlan, type PremiumPlanId } from './premium'

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_STRIPE_API_URL
  if (base && typeof base === 'string') {
    return base.replace(/\/$/, '') + path
  }
  return path
}

export async function startPremiumCheckout(plan: PremiumPlanId = 'monthly'): Promise<void> {
  const r = await fetch(apiUrl('/api/create-premium-checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: window.location.origin, plan }),
  })
  const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok) {
    throw new Error(j.error || `Premium checkout mislukt (${r.status})`)
  }
  if (!j.url) {
    throw new Error('Geen betalingslink ontvangen')
  }
  window.location.assign(j.url)
}

export async function verifyPremiumSession(
  sessionId: string,
): Promise<{ ok: boolean; plan: PremiumPlanId }> {
  const r = await fetch(
    apiUrl(
      '/api/verify-premium-checkout?session_id=' + encodeURIComponent(sessionId),
    ),
  )
  if (!r.ok) {
    return { ok: false, plan: 'monthly' }
  }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; plan?: string }
  return { ok: j.ok === true, plan: normalizePlan(j.plan) }
}
