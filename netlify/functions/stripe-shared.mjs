import Stripe from 'stripe'

export const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json',
}

export function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) }
}

export function options(event) {
  return event.httpMethod === 'OPTIONS' ? { statusCode: 204, headers, body: '' } : null
}

export function parseBody(event) {
  if (!event.body) return {}
  try {
    return JSON.parse(event.body)
  } catch {
    return {}
  }
}

export function stripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return { error: 'STRIPE_SECRET_KEY ontbreekt in Netlify environment variables' }
  if (!/^sk_(test|live)_/.test(secret)) {
    return { error: 'STRIPE_SECRET_KEY moet met sk_test_ of sk_live_ beginnen' }
  }
  return { stripe: new Stripe(secret) }
}

export function originFrom(event) {
  const body = parseBody(event)
  return (
    (typeof body.origin === 'string' && body.origin) ||
    process.env.CLIENT_ORIGIN ||
    event.headers.origin ||
    'https://polite-unicorn-98dfdc.netlify.app'
  ).replace(/\/$/, '')
}

export function checkoutUnlocked(session) {
  if (session.status !== 'complete') return false
  return (
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required'
  )
}

export async function createCheckout(event, args) {
  const opt = options(event)
  if (opt) return opt
  const { stripe, error } = stripeClient()
  if (error) return json(500, { error })
  if (!args.priceId) {
    return json(500, { error: `${args.envName} ontbreekt in Netlify environment variables` })
  }
  try {
    const origin = originFrom(event)
    const session = await stripe.checkout.sessions.create({
      mode: args.mode,
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: `${origin}/?${args.successParam}=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?${args.successParam}=cancel`,
      metadata: args.metadata,
    })
    if (!session.url) return json(500, { error: 'Geen checkout-URL' })
    return json(200, { url: session.url })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) })
  }
}

export async function verifyCheckout(event, args) {
  const opt = options(event)
  if (opt) return opt
  const { stripe, error } = stripeClient()
  if (error) return json(500, { ok: false, error })
  const sessionId = event.queryStringParameters?.session_id
  if (!sessionId) return json(400, { ok: false, error: 'session_id ontbreekt' })
  try {
    const session = await stripe.checkout.sessions.retrieve(String(sessionId))
    if (args.product && session.metadata?.product !== args.product) {
      return json(400, { ok: false, error: args.productError })
    }
    if (args.coins && session.payment_status === 'paid') {
      return json(200, { ok: true, coins: args.coins })
    }
    if (!args.coins && checkoutUnlocked(session)) {
      return json(200, {
        ok: true,
        plan: session.metadata?.plan,
      })
    }
    return json(400, { ok: false, error: 'Nog niet betaald' })
  } catch (e) {
    return json(400, { ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
