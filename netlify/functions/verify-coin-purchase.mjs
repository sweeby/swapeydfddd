import { verifyCheckout } from './stripe-shared.mjs'

export function handler(event) {
  const coins = Number.parseInt(String(process.env.COIN_PACK_GRANT || '500'), 10) || 500
  return verifyCheckout(event, {
    product: 'coin_pack',
    productError: 'Geen muntenaankoop',
    coins,
  })
}
