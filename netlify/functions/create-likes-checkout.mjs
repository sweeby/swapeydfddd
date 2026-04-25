import { createCheckout } from './stripe-shared.mjs'

export function handler(event) {
  return createCheckout(event, {
    mode: 'subscription',
    priceId: process.env.STRIPE_LIKES_PRICE_ID,
    envName: 'STRIPE_LIKES_PRICE_ID',
    successParam: 'likes_paid',
    metadata: { product: 'likes_inbox' },
  })
}
