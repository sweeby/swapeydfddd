/** Muntenpakket via Stripe (zelfde proxy / VITE_STRIPE_API_URL als Discover). */

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_STRIPE_API_URL
  if (base && typeof base === 'string') return base.replace(/\/$/, '') + path
  return path
}

export async function startCoinPackCheckout(): Promise<void> {
  const r = await fetch(apiUrl('/api/create-coin-checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: window.location.origin }),
  })
  const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok) {
    throw new Error(j.error || `Kopen mislukt (${r.status})`)
  }
  if (!j.url) {
    throw new Error('Geen betalingslink ontvangen')
  }
  window.location.assign(j.url)
}

export async function verifyCoinPackSession(sessionId: string): Promise<number> {
  const r = await fetch(
    apiUrl(
      '/api/verify-coin-purchase?session_id=' + encodeURIComponent(sessionId),
    ),
  )
  if (!r.ok) {
    return 0
  }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; coins?: number }
  if (j.ok && typeof j.coins === 'number' && j.coins > 0) {
    return j.coins
  }
  return 0
}
