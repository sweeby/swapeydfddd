/** Mensen-vriendelijke fout rond verkeerde Stripe-sleutel in .env. */
export function formatStripeUserError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/publishable/i.test(m) && /secret/i.test(m)) {
    return 'STRIPE_SECRET_KEY moet de geheime sleutel zijn (sk_test_… of sk_live_…), niet de publishable key (pk_…). Zet de juiste key in .env en herstart de stripe-server (npm run dev:stripe).'
  }
  if (typeof m === 'string' && m.length > 0) return m
  return 'Betalen starten mislukt'
}
