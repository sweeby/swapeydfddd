/** Stripe Checkout voor Friends → Discover+; API draait via Vite proxy of VITE_STRIPE_API_URL. */

function apiBase(): string {
  const base = import.meta.env.VITE_STRIPE_API_URL
  if (base && typeof base === 'string') return base.replace(/\/$/, '')
  return ''
}

function apiUrl(path: string): string {
  const b = apiBase()
  if (!b) return path
  if (path.startsWith('/')) return b + path
  return `${b}/${path}`
}

/**
 * Start Stripe hosted Checkout; zet de browser op checkout.stripe.com of redirect terug.
 */
export async function startStripeDiscoverCheckout(): Promise<void> {
  const r = await fetch(apiUrl('/api/create-checkout-session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: window.location.origin }),
  })
  const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok) {
    throw new Error(
      j.error || `Checkout starten mislukt (${r.status})`,
    )
  }
  if (!j.url) {
    throw new Error('Geen betalingslink ontvangen')
  }
  window.location.assign(j.url)
}

/**
 * Controleer na redirect of Stripe bevestigt dat de sessie betaald is.
 */
export async function verifyDiscoverCheckoutSession(
  sessionId: string,
): Promise<boolean> {
  const q = new URLSearchParams({ session_id: sessionId })
  const r = await fetch(
    apiUrl('/api/verify-checkout-session?') + q.toString(),
  )
  if (!r.ok) return false
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
  return j.ok === true
}
