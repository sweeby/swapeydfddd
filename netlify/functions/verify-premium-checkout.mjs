import { verifyCheckout } from './stripe-shared.mjs'

export function handler(event) {
  return verifyCheckout(event, {
    product: 'swipey_premium',
    productError: 'Geen Swipey Premium-aankoop',
  })
}
