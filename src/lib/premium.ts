import {
  addCoins,
  addDiscoverBoostMs,
  applyShopToDocument,
  grantAllShopItems,
  grantShopItems,
} from './coinsAndShop'

const LS = 'swipey-premium-v1'
const LS_PLAN = 'swipey-premium-plan-v1'
const LS_BONUS = 'swipey-premium-bonus-coins-v1'
const LS_BENEFIT_RANK = 'swipey-premium-benefit-rank-v1'
const WELCOME_COINS = 500

export type PremiumPlanId = 'monthly' | 'three_months' | 'yearly'

export const PREMIUM_PLAN_BENEFITS: Record<
  PremiumPlanId,
  {
    rank: number
    label: string
    coins: number
    summary: string
    perks: string[]
  }
> = {
  monthly: {
    rank: 1,
    label: '1 maand',
    coins: 500,
    summary: 'Basis Premium',
    perks: ['Discover+', 'Likes+', '+500 coins'],
  },
  three_months: {
    rank: 2,
    label: '3 maanden',
    coins: 1500,
    summary: 'Meer bereik, chatstijl en profielboost',
    perks: [
      'Discover+',
      'Likes+',
      '+1500 coins',
      '24 uur zicht-boost',
      'Stickerpakket',
      'Kroon op profiel',
      'Naam-glow',
      'Hart-belletjes',
      'Zilveren frame',
    ],
  },
  yearly: {
    rank: 3,
    label: '12 maanden',
    coins: 5000,
    summary: 'Alles ontgrendeld',
    perks: [
      'Discover+',
      'Likes+',
      '+5000 coins',
      '7 dagen zicht-boost',
      'Alle shop-items',
      'Alle thema’s',
      'Alle frames',
      'Alle chat-extra’s',
      'Alle profielstijlen',
    ],
  },
}

function normalizePlan(plan: unknown): PremiumPlanId {
  return plan === 'three_months' || plan === 'yearly' ? plan : 'monthly'
}

export function isPremiumUnlocked(): boolean {
  try {
    return localStorage.getItem(LS) === '1'
  } catch {
    return false
  }
}

export function getPremiumPlan(): PremiumPlanId {
  try {
    if (localStorage.getItem(LS) !== '1') return 'monthly'
    return normalizePlan(localStorage.getItem(LS_PLAN))
  } catch {
    return 'monthly'
  }
}

export function getPremiumBenefitRank(): number {
  return PREMIUM_PLAN_BENEFITS[getPremiumPlan()].rank
}

export function setPremiumUnlocked(unlocked: boolean, plan: PremiumPlanId = 'monthly') {
  try {
    if (unlocked) {
      localStorage.setItem(LS, '1')
      localStorage.setItem(LS_PLAN, normalizePlan(plan))
    } else {
      localStorage.removeItem(LS)
      localStorage.removeItem(LS_PLAN)
    }
  } catch {
    /* */
  }
}

/** Eenmalig: bonus coins na eerste Premium-activatie (lokale app). */
export function applyPremiumWelcomeBonus(): void {
  try {
    if (!isPremiumUnlocked()) {
      return
    }
    const plan = getPremiumPlan()
    const benefit = PREMIUM_PLAN_BENEFITS[plan]
    const previousRank = Number(localStorage.getItem(LS_BENEFIT_RANK) || '0')
    if (previousRank >= benefit.rank) {
      return
    }
    addCoins(benefit.coins)
    if (plan === 'three_months') {
      addDiscoverBoostMs(24 * 60 * 60_000)
      grantShopItems([
        'sticker_pack',
        'crown_badge',
        'name_glow',
        'chat_heart',
        'frame_silver',
      ])
    }
    if (plan === 'yearly') {
      addDiscoverBoostMs(7 * 24 * 60 * 60_000)
      grantAllShopItems()
    }
    applyShopToDocument()
    localStorage.setItem(LS_BONUS, '1')
    localStorage.setItem(LS_BENEFIT_RANK, String(benefit.rank))
  } catch {
    /* */
  }
}

export { WELCOME_COINS, normalizePlan }
