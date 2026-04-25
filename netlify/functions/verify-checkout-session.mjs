import { verifyCheckout } from './stripe-shared.mjs'

export function handler(event) {
  return verifyCheckout(event, {})
}
