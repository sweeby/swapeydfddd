function apiUrl(path: string): string {
  const base = import.meta.env.VITE_STRIPE_API_URL
  if (base && typeof base === 'string') {
    return base.replace(/\/$/, '') + path
  }
  return path
}

export async function startLikesInboxCheckout(): Promise<void> {
  const r = await fetch(apiUrl('/api/create-likes-checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: window.location.origin }),
  })
  const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok) {
    throw new Error(j.error || `Checkout starten mislukt (${r.status})`)
  }
  if (!j.url) {
    throw new Error('Geen betalingslink ontvangen')
  }
  window.location.assign(j.url)
}

export async function verifyLikesInboxSession(sessionId: string): Promise<boolean> {
  const r = await fetch(
    apiUrl(
      '/api/verify-likes-checkout?session_id=' + encodeURIComponent(sessionId),
    ),
  )
  if (!r.ok) {
    return false
  }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
  return j.ok === true
}
