import { createCheckout } from './stripe-shared.mjs'

export function handler(event) {
  return createCheckout(event, {
    mode: 'subscription',
    priceId: process.env.STRIPE_PRICE_ID,
    envName: 'STRIPE_PRICE_ID',
    successParam: 'stripe_discover',
  })
}
