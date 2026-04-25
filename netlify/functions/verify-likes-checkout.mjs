import { verifyCheckout } from './stripe-shared.mjs'

export function handler(event) {
  return verifyCheckout(event, {
    product: 'likes_inbox',
    productError: 'Geen Likes-aankoop',
  })
}
