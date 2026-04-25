import { useState } from 'react'
import {
  PREMIUM_PLAN_BENEFITS,
  type PremiumPlanId,
} from '../lib/premium'
import { formatStripeUserError } from '../lib/stripeUserError'
import { startPremiumCheckout } from '../lib/stripePremiumClient'

type Props = {
  onBack: () => void
  alreadyPremium: boolean
  activePlanLabel?: string
  activePlan?: PremiumPlanId
}

const PREMIUM_PLANS: Array<{
  id: PremiumPlanId
  label: string
  price: string
  sub: string
  badge?: string
}> = [
  {
    id: 'monthly',
    label: '1 maand',
    price: '€6,99',
    sub: PREMIUM_PLAN_BENEFITS.monthly.summary,
  },
  {
    id: 'three_months',
    label: '3 maanden',
    price: '€17,99',
    sub: PREMIUM_PLAN_BENEFITS.three_months.summary,
    badge: 'Meest gekozen',
  },
  {
    id: 'yearly',
    label: '12 maanden',
    price: '€59,99',
    sub: PREMIUM_PLAN_BENEFITS.yearly.summary,
    badge: 'Bespaar meer',
  },
]

export function PremiumScreen({
  onBack,
  alreadyPremium,
  activePlanLabel = 'Premium',
  activePlan = 'monthly',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [termsOk, setTermsOk] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlanId>('three_months')
  const plan = PREMIUM_PLANS.find((p) => p.id === selectedPlan) ?? PREMIUM_PLANS[0]

  if (alreadyPremium) {
    return (
      <div className="yubo-screen-chat yubo-premium-screen">
        <header className="yubo-top compact" style={{ flexShrink: 0 }}>
          <button
            className="yubo-back yubo-back--with-label"
            type="button"
            onClick={onBack}
            aria-label="Terug"
          >
            <span className="yubo-back__chev" aria-hidden>‹</span>
            Terug
          </button>
          <h1 className="yubo-title" style={{ fontSize: '1.02rem' }}>
            Premium
          </h1>
          <span className="yubo-premium-badge" aria-label="Actief">
            actief
          </span>
        </header>
        <div
          className="yubo-main with-tabbar"
          style={{ padding: '0.5rem 0.9rem' }}
        >
          <p className="yubo-premium-on">
            Je hebt <strong>Swipey Premium {activePlanLabel}</strong> — je pakketvoordelen
            zitten in je account.
          </p>
          <ul className="yubo-premium-bul yubo-premium-bul--active">
            {PREMIUM_PLAN_BENEFITS[activePlan].perks.map((perk) => (
              <li key={perk}>
                <strong>{perk}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="yubo-screen-chat yubo-premium-screen">
      <header className="yubo-top compact" style={{ flexShrink: 0 }}>
        <button
          className="yubo-back yubo-back--with-label"
          type="button"
          onClick={onBack}
          aria-label="Terug"
        >
          <span className="yubo-back__chev" aria-hidden>‹</span>
          Terug
        </button>
        <h1 className="yubo-title" style={{ fontSize: '1.02rem' }}>
          Swipey Premium
        </h1>
        <span className="yubo-premium-badge yubo-premium-badge--pro" aria-hidden>
          +++
        </span>
      </header>
      <div
        className="yubo-main with-tabbar yubo-premium-body"
        style={{ padding: '0.4rem 0' }}
      >
        <div className="yubo-premium-hero" aria-hidden>
          ✦
        </div>
        <h2 className="yubo-premium-h2">Alles in één</h2>
        <p className="yubo-premium-lead">
          Minder betalen los dan apart voor Discover+ en Likes+, met extra coins
          erbij in de Shop.
        </p>
        <ul className="yubo-premium-bul">
          {PREMIUM_PLAN_BENEFITS[selectedPlan].perks.map((perk) => (
            <li key={perk}>
              <strong>{perk}</strong>
            </li>
          ))}
        </ul>
        <div className="yubo-premium-plans" role="radiogroup" aria-label="Premium pakket kiezen">
          {PREMIUM_PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                'yubo-premium-plan' +
                (selectedPlan === p.id ? ' yubo-premium-plan--selected' : '')
              }
              onClick={() => setSelectedPlan(p.id)}
              role="radio"
              aria-checked={selectedPlan === p.id}
            >
              {p.badge ? <span className="yubo-premium-plan__badge">{p.badge}</span> : null}
              <span className="yubo-premium-plan__label">{p.label}</span>
              <strong>{p.price}</strong>
              <span>{p.sub}</span>
            </button>
          ))}
        </div>
        <p className="yubo-premium-price">
          {plan.price} <span>{plan.label}</span>
        </p>
        {err ? (
          <p className="yubo-premium-err" role="alert">
            {err}
          </p>
        ) : null}
        <label className="yubo-premium-accept">
          <input
            type="checkbox"
            checked={termsOk}
            onChange={(e) => setTermsOk(e.target.checked)}
          />
          <span>
            Ik accepteer de voorwaarden en Swipey Premium ({plan.label}; bonus coins
            eenmalig).
          </span>
        </label>
        <button
          type="button"
          className="yubo-premium-cta"
          disabled={loading || !termsOk}
          onClick={() => {
            setErr(null)
            setLoading(true)
            void (async () => {
              try {
                await startPremiumCheckout(selectedPlan)
              } catch (e) {
                setErr(formatStripeUserError(e))
                setLoading(false)
              }
            })()
          }}
        >
          {loading ? 'Laden…' : `Met Stripe afrekenen — ${plan.label}`}
        </button>
      </div>
    </div>
  )
}
