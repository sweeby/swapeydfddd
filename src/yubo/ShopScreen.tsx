import { useEffect, useState } from 'react'
import {
  addCoins,
  getDiscoverBoostRemainingLabel,
  getCoinBalance,
  isDiscoverBoostActive,
  isItemOwned,
  isThemeItemActive,
  SHOP_ITEMS,
  setActiveThemeByKey,
  tryBuyItem,
  type ShopItem,
} from '../lib/coinsAndShop'
import { formatStripeUserError } from '../lib/stripeUserError'
import { startCoinPackCheckout } from '../lib/stripeShopClient'

type Props = {
  onBack: () => void
  onBalanceChange: (next: number) => void
  initialBalance: number
  showCoinTopUp: boolean
}

const COIN_PACK_LABEL = '500'
const COIN_PACK_AMOUNT = 500

function shopTypeLabel(t: ShopItem['type']): 'thema' | 'cosmetisch' | 'boost' {
  if (t === 'theme') return 'thema'
  if (t === 'consumable') return 'boost'
  return 'cosmetisch'
}

export function ShopScreen({
  onBack,
  onBalanceChange,
  initialBalance,
  showCoinTopUp,
}: Props) {
  const [balance, setBalance] = useState(initialBalance)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [coinLoading, setCoinLoading] = useState(false)
  const [boostLabel, setBoostLabel] = useState(() => getDiscoverBoostRemainingLabel())
  const [, setShopRev] = useState(0)

  useEffect(() => {
    setBalance(initialBalance)
  }, [initialBalance])

  useEffect(() => {
    const b = () => {
      setBoostLabel(getDiscoverBoostRemainingLabel())
      setShopRev((n) => n + 1)
    }
    window.addEventListener('swipey-shop-updated', b)
    return () => window.removeEventListener('swipey-shop-updated', b)
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => {
      if (isDiscoverBoostActive()) {
        setBoostLabel(getDiscoverBoostRemainingLabel())
      }
    }, 15_000)
    return () => clearInterval(t)
  }, [])

  const sync = (b: number) => {
    setBalance(b)
    onBalanceChange(b)
  }

  const buy = (id: string) => {
    setErr(null)
    setMsg(null)
    const r = tryBuyItem(id)
    if (r.ok === false) {
      switch (r.reason) {
        case 'insufficient':
          setErr('Niet genoeg coins. Vul aan of kies iets goedkoper.')
          return
        case 'owned':
          setMsg('Heb je al in bezit.')
          return
        default:
          setErr('Kon niet kopen.')
          return
      }
    }
    sync(r.balance)
    setMsg('Aankoop gelukt — staat nu in bezit.')
    setBoostLabel(getDiscoverBoostRemainingLabel())
  }

  const activateTheme = (item: ShopItem) => {
    if (item.type !== 'theme' || !item.themeKey) return
    if (setActiveThemeByKey(item.themeKey)) {
      setMsg('Thema geactiveerd.')
    }
  }

  const onTopUp = async () => {
    setErr(null)
    setMsg(null)
    setCoinLoading(true)
    try {
      await startCoinPackCheckout()
    } catch (e) {
      const m = formatStripeUserError(e)
      if (
        /STRIPE_COIN_PACK_PRICE_ID|Betalen starten mislukt|Checkout starten mislukt|502/i.test(m)
      ) {
        addCoins(COIN_PACK_AMOUNT)
        sync(getCoinBalance())
        setMsg(`+${COIN_PACK_AMOUNT} coins toegevoegd.`)
        return
      }
      setErr(m)
    } finally {
      setCoinLoading(false)
    }
  }

  return (
    <div className="yubo-screen-chat yubo-shop-screen">
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
          Shop
        </h1>
        <div className="yubo-shop-balance-pill" title="Huidig saldo">
          🪙 {balance}
        </div>
      </header>

      <div
        className="yubo-main with-tabbar"
        style={{ padding: '0.35rem 0 0.5rem' }}
      >
        <p className="shop-balance-hero" aria-hidden>
          <span className="shop-balance-hero__n">{balance}</span> coins
        </p>
        {isDiscoverBoostActive() ? (
          <p className="shop-boost-pill" role="status">
            <strong>Discover+-boost</strong> actief: nog {boostLabel} — sortering telt
            <strong> actieve</strong> spelers eerst.
          </p>
        ) : null}
        {showCoinTopUp ? (
          <div className="shop-coinpack">
            <h2 className="shop-coinpack__h">Munten bijvullen</h2>
            <p className="shop-coinpack__p">
              Betaal met Stripe. Als Stripe nog niet is ingesteld, worden de coins lokaal toegevoegd.
            </p>
            <button
              type="button"
              className="shop-coinpack__btn"
              onClick={() => {
                void onTopUp()
              }}
              disabled={coinLoading}
            >
              {coinLoading ? 'Bezig…' : `+${COIN_PACK_LABEL} coins (Stripe)`}
            </button>
          </div>
        ) : null}

        <h2 className="shop-sec__h">Kopen met coins</h2>
        {msg ? (
          <p className="shop-toast" role="status">
            {msg}
          </p>
        ) : null}
        {err ? (
          <p className="shop-err" role="alert">
            {err}
          </p>
        ) : null}

        <ul className="shop-items" role="list">
          {SHOP_ITEMS.map((item) => {
            const owned = isItemOwned(item.id)
            const isTheme = item.type === 'theme'
            const isBoost = item.type === 'consumable'
            return (
              <li key={item.id} className="shop-item">
                <div className="shop-item__ic" aria-hidden>
                  {item.icon}
                </div>
                <div className="shop-item__mid">
                  <div className="shop-item__name">
                    {item.name}
                    <span className="shop-item__tag" title="Type">
                      {shopTypeLabel(item.type)}
                    </span>
                    {isTheme && owned && isThemeItemActive(item.id) ? (
                      <span className="shop-item__own">actief</span>
                    ) : null}
                    {isTheme && owned && !isThemeItemActive(item.id) ? (
                      <span className="shop-item__own">in bezit</span>
                    ) : null}
                    {!isTheme && !isBoost && owned ? (
                      <span className="shop-item__own">in bezit</span>
                    ) : null}
                  </div>
                  <p className="shop-item__desc">{item.desc}</p>
                </div>
                {isTheme && owned && !isThemeItemActive(item.id) ? (
                  <button
                    type="button"
                    className="shop-item__price shop-item__price--gold"
                    onClick={() => activateTheme(item)}
                  >
                    Activeren
                  </button>
                ) : isTheme && owned && isThemeItemActive(item.id) ? (
                  <button
                    type="button"
                    className="shop-item__price"
                    disabled
                    aria-label="Dit thema is actief"
                  >
                    ✓
                  </button>
                ) : isBoost ? (
                  <button
                    type="button"
                    className="shop-item__price"
                    onClick={() => buy(item.id)}
                  >
                    {isDiscoverBoostActive() ? '＋' : ''}
                    {item.price} 🪙
                  </button>
                ) : !owned ? (
                  <button
                    type="button"
                    className="shop-item__price"
                    onClick={() => buy(item.id)}
                  >
                    {item.price} 🪙
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shop-item__price"
                    disabled
                    aria-label="In bezit"
                  >
                    ✓
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
