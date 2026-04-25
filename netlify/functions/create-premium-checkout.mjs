import { createCheckout, parseBody } from './stripe-shared.mjs'

function premiumPlan(body) {
  const plan = String(body.plan || 'monthly')
  if (plan === 'three_months') {
    return {
      key: 'three_months',
      priceId: process.env.STRIPE_PREMIUM_3_MONTH_PRICE_ID,
      envName: 'STRIPE_PREMIUM_3_MONTH_PRICE_ID',
    }
  }
  if (plan === 'yearly') {
    return {
      key: 'yearly',
      priceId: process.env.STRIPE_PREMIUM_YEAR_PRICE_ID,
      envName: 'STRIPE_PREMIUM_YEAR_PRICE_ID',
    }
  }
  return {
    key: 'monthly',
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    envName: 'STRIPE_PREMIUM_PRICE_ID',
  }
}

export function handler(event) {
  const plan = premiumPlan(parseBody(event))
  return createCheckout(event, {
    mode: 'subscription',
    priceId: plan.priceId,
    envName: plan.envName,
    successParam: 'swipey_premium',
    metadata: { product: 'swipey_premium', plan: plan.key },
  })
}
