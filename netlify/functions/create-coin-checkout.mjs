import { createCheckout } from './stripe-shared.mjs'

export function handler(event) {
  return createCheckout(event, {
    mode: 'payment',
    priceId: process.env.STRIPE_COIN_PACK_PRICE_ID,
    envName: 'STRIPE_COIN_PACK_PRICE_ID',
    successParam: 'shop_coins',
    metadata: { product: 'coin_pack' },
  })
}
