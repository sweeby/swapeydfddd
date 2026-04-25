/**
 * Kleine API voor Stripe Checkout; vereist .env in projectroot.
 * Nooit de secret key in de frontend zetten.
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Stripe from 'stripe'

const PORT = Number(process.env.STRIPE_SERVER_PORT) || 3001
const secret = process.env.STRIPE_SECRET_KEY
const priceId = process.env.STRIPE_PRICE_ID
const coinPriceId = process.env.STRIPE_COIN_PACK_PRICE_ID
const likesPriceId = process.env.STRIPE_LIKES_PRICE_ID
const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID
const premiumThreeMonthPriceId = process.env.STRIPE_PREMIUM_3_MONTH_PRICE_ID
const premiumYearPriceId = process.env.STRIPE_PREMIUM_YEAR_PRICE_ID
const coinPackGrant = Number.parseInt(
  String(process.env.COIN_PACK_GRANT || '500'),
  10,
) || 500

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

/** Eerste betaling of trial zonder betaling: checkout is afgerond. */
function checkoutUnlocked(s) {
  if (s.status !== 'complete') return false
  return (
    s.payment_status === 'paid' || s.payment_status === 'no_payment_required'
  )
}

function premiumPriceForPlan(plan) {
  const key = String(plan || 'monthly')
  if (key === 'three_months') {
    return {
      id: premiumThreeMonthPriceId,
      label: '3 maanden',
      env: 'STRIPE_PREMIUM_3_MONTH_PRICE_ID',
      key,
    }
  }
  if (key === 'yearly') {
    return {
      id: premiumYearPriceId,
      label: '12 maanden',
      env: 'STRIPE_PREMIUM_YEAR_PRICE_ID',
      key,
    }
  }
  return {
    id: premiumPriceId,
    label: '1 maand',
    env: 'STRIPE_PREMIUM_PRICE_ID',
    key: 'monthly',
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, stripe: Boolean(secret && priceId) })
})

app.post('/api/create-checkout-session', async (req, res) => {
  if (!secret || !priceId) {
    return res.status(500).json({
      error: 'STRIPE_SECRET_KEY of STRIPE_PRICE_ID ontbreekt in .env',
    })
  }
  const origin =
    (typeof req.body?.origin === 'string' && req.body.origin) ||
    process.env.CLIENT_ORIGIN ||
    'http://localhost:5173'
  const stripe = new Stripe(secret)
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin.replace(/\/$/, '')}/?stripe_discover=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.replace(/\/$/, '')}/?stripe_discover=cancel`,
    })
    if (!session.url) {
      return res.status(500).json({ error: 'Geen checkout-URL' })
    }
    return res.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg })
  }
})

app.post('/api/create-coin-checkout', async (req, res) => {
  if (!secret || !coinPriceId) {
    return res.status(500).json({
      error:
        'Voor munten: zet STRIPE_COIN_PACK_PRICE_ID (en STRIPE_SECRET_KEY) in .env',
    })
  }
  const origin =
    (typeof req.body?.origin === 'string' && req.body.origin) ||
    process.env.CLIENT_ORIGIN ||
    'http://localhost:5173'
  const stripe = new Stripe(secret)
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: coinPriceId, quantity: 1 }],
      success_url: `${origin.replace(/\/$/, '')}/?shop_coins=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.replace(/\/$/, '')}/?shop_coins=cancel`,
      metadata: { product: 'coin_pack' },
    })
    if (!session.url) {
      return res.status(500).json({ error: 'Geen checkout-URL' })
    }
    return res.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg })
  }
})

app.get('/api/verify-coin-purchase', async (req, res) => {
  const sessionId = req.query.session_id
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ ok: false, error: 'session_id ontbreekt' })
  }
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'STRIPE_SECRET_KEY ontbreekt' })
  }
  const stripe = new Stripe(secret)
  try {
    const s = await stripe.checkout.sessions.retrieve(String(sessionId))
    if (s.metadata?.product !== 'coin_pack') {
      return res
        .status(400)
        .json({ ok: false, error: 'Geen muntenaankoop' })
    }
    if (s.payment_status === 'paid') {
      return res.json({ ok: true, coins: coinPackGrant })
    }
    return res.status(400).json({ ok: false, error: 'Nog niet betaald' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ ok: false, error: msg })
  }
})

app.post('/api/create-likes-checkout', async (req, res) => {
  if (!secret || !likesPriceId) {
    return res.status(500).json({
      error:
        'Voor Likes: zet STRIPE_LIKES_PRICE_ID (en STRIPE_SECRET_KEY) in .env',
    })
  }
  const origin =
    (typeof req.body?.origin === 'string' && req.body.origin) ||
    process.env.CLIENT_ORIGIN ||
    'http://localhost:5173'
  const stripe = new Stripe(secret)
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: likesPriceId, quantity: 1 }],
      success_url: `${origin.replace(/\/$/, '')}/?likes_paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.replace(/\/$/, '')}/?likes_paid=cancel`,
      metadata: { product: 'likes_inbox' },
    })
    if (!session.url) {
      return res.status(500).json({ error: 'Geen checkout-URL' })
    }
    return res.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg })
  }
})

app.get('/api/verify-likes-checkout', async (req, res) => {
  const sessionId = req.query.session_id
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ ok: false, error: 'session_id ontbreekt' })
  }
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'STRIPE_SECRET_KEY ontbreekt' })
  }
  const stripe = new Stripe(secret)
  try {
    const s = await stripe.checkout.sessions.retrieve(String(sessionId))
    if (s.metadata?.product !== 'likes_inbox') {
      return res
        .status(400)
        .json({ ok: false, error: 'Geen Likes-aankoop' })
    }
    if (checkoutUnlocked(s)) {
      return res.json({ ok: true, plan: s.metadata?.plan })
    }
    return res.status(400).json({ ok: false, error: 'Nog niet betaald' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ ok: false, error: msg })
  }
})

app.post('/api/create-premium-checkout', async (req, res) => {
  const plan = premiumPriceForPlan(req.body?.plan)
  if (!secret || !plan.id) {
    return res.status(500).json({
      error:
        `Voor Swipey Premium (${plan.label}): zet ${plan.env} (en STRIPE_SECRET_KEY) in .env`,
    })
  }
  const origin =
    (typeof req.body?.origin === 'string' && req.body.origin) ||
    process.env.CLIENT_ORIGIN ||
    'http://localhost:5173'
  const stripe = new Stripe(secret)
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.id, quantity: 1 }],
      success_url: `${origin.replace(/\/$/, '')}/?swipey_premium=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.replace(/\/$/, '')}/?swipey_premium=cancel`,
      metadata: { product: 'swipey_premium', plan: plan.key },
    })
    if (!session.url) {
      return res.status(500).json({ error: 'Geen checkout-URL' })
    }
    return res.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg })
  }
})

app.get('/api/verify-premium-checkout', async (req, res) => {
  const sessionId = req.query.session_id
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ ok: false, error: 'session_id ontbreekt' })
  }
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'STRIPE_SECRET_KEY ontbreekt' })
  }
  const stripe = new Stripe(secret)
  try {
    const s = await stripe.checkout.sessions.retrieve(String(sessionId))
    if (s.metadata?.product !== 'swipey_premium') {
      return res
        .status(400)
        .json({ ok: false, error: 'Geen Swipey Premium-aankoop' })
    }
    if (checkoutUnlocked(s)) {
      return res.json({ ok: true })
    }
    return res.status(400).json({ ok: false, error: 'Nog niet betaald' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ ok: false, error: msg })
  }
})

app.get('/api/verify-checkout-session', async (req, res) => {
  const sessionId = req.query.session_id
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ ok: false, error: 'session_id ontbreekt' })
  }
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'STRIPE_SECRET_KEY ontbreekt' })
  }
  const stripe = new Stripe(secret)
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId)
    if (checkoutUnlocked(s)) {
      return res.json({ ok: true })
    }
    return res.status(400).json({ ok: false, error: 'Nog niet betaald' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ ok: false, error: msg })
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[stripe-server] http://127.0.0.1:${PORT}`)
  if (!secret) console.warn('[stripe-server] Zet STRIPE_SECRET_KEY in .env')
  else if (!/^sk_(test|live)_/.test(secret)) {
    console.warn(
      '[stripe-server] STRIPE_SECRET_KEY moet de geheime key zijn (sk_test_… of sk_live_…), niet pk_ (publishable). Kopiëer de Secret key uit je Stripe Dashboard.',
    )
  }
  if (!priceId) {
    console.warn(
      '[stripe-server] Zet STRIPE_PRICE_ID in .env (Discover+, maandelijks).',
    )
  }
  if (!coinPriceId) {
    console.warn('[stripe-server] Optioneel: STRIPE_COIN_PACK_PRICE_ID (muntenpakket).')
  }
  if (!likesPriceId) {
    console.warn(
      '[stripe-server] Optioneel: STRIPE_LIKES_PRICE_ID (Likes+, maandelijks).',
    )
  }
  if (!premiumPriceId) {
    console.warn(
      '[stripe-server] Optioneel: STRIPE_PREMIUM_PRICE_ID (bundel, maandelijks).',
    )
  }
  if (!premiumThreeMonthPriceId) {
    console.warn(
      '[stripe-server] Optioneel: STRIPE_PREMIUM_3_MONTH_PRICE_ID (bundel, 3 maanden).',
    )
  }
  if (!premiumYearPriceId) {
    console.warn(
      '[stripe-server] Optioneel: STRIPE_PREMIUM_YEAR_PRICE_ID (bundel, 12 maanden).',
    )
  }
})
