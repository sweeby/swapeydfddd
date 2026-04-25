const LS_COINS = 'swipey-coins-v1'
const LS_OWNED = 'swipey-shop-owned-v1'
const LS_ACTIVE_THEME = 'swipey-active-theme'
const LS_DISCOVER_BOOST_UNTIL = 'swipey-discover-boost-until'

const START_BALANCE = 280

export type ThemeKey = 'sunset' | 'ocean' | 'midnight'
export type ShopItem = {
  id: string
  name: string
  desc: string
  price: number
  icon: string
  /**
   * permanent: eenmalig in collectie, zichtbaar in bezit
   * consumable: o.a. boost, altijd weer te kopen
   * theme: permanent + te activeren; je kunt wisselen tussen bezitte thema’s
   */
  type: 'permanent' | 'consumable' | 'theme'
  /** Voor `boost_*` */
  boostMs?: number
  /** Voor `theme_*` (type theme) */
  themeKey?: ThemeKey
  /** Hulp voor applyShopToDocument: frame|glow|sticker|crown|heart */
  feature?:
    | 'frame_gold'
    | 'frame_silver'
    | 'sticker'
    | 'glow'
    | 'crown'
    | 'chat_heart'
}

const BOOST_IDS: Record<string, number> = {
  boost_15m: 15 * 60_000,
  boost_1h: 60 * 60_000,
}

function notifyShopUpdate() {
  try {
    window.dispatchEvent(new Event('swipey-shop-updated'))
  } catch {
    /* */
  }
}

function readOwned(): Set<string> {
  try {
    const s = localStorage.getItem(LS_OWNED)
    if (!s) return new Set()
    const a = JSON.parse(s) as string[]
    return new Set(Array.isArray(a) ? a : [])
  } catch {
    return new Set()
  }
}

function writeOwned(set: Set<string>) {
  try {
    localStorage.setItem(LS_OWNED, JSON.stringify([...set]))
  } catch {
    /* */
  }
  notifyShopUpdate()
}

function ensureInitialBalance(): number {
  try {
    const s = localStorage.getItem(LS_COINS)
    if (s === null) {
      localStorage.setItem(LS_COINS, String(START_BALANCE))
      return START_BALANCE
    }
    const n = Math.floor(Number(s))
    if (Number.isFinite(n) && n >= 0) return n
    localStorage.setItem(LS_COINS, String(START_BALANCE))
    return START_BALANCE
  } catch {
    return START_BALANCE
  }
}

export function getCoinBalance(): number {
  return ensureInitialBalance()
}

export function setCoinBalance(n: number) {
  const v = Math.max(0, Math.floor(n))
  try {
    localStorage.setItem(LS_COINS, String(v))
  } catch {
    /* */
  }
}

export function addCoins(amount: number) {
  if (amount <= 0) return
  setCoinBalance(getCoinBalance() + amount)
  notifyShopUpdate()
}

export function grantShopItems(ids: string[]) {
  const known = new Set(SHOP_ITEMS.map((item) => item.id))
  const owned = readOwned()
  for (const id of ids) {
    if (known.has(id)) owned.add(id)
  }
  writeOwned(owned)
  applyShopToDocument()
}

export function grantAllShopItems() {
  grantShopItems(SHOP_ITEMS.filter((item) => item.type !== 'consumable').map((item) => item.id))
}

export function addDiscoverBoostMs(durationMs: number) {
  if (durationMs <= 0) return
  const now = Date.now()
  const cur = readDiscoverBoostUntilMs()
  setDiscoverBoostUntilMs(Math.max(now, cur) + durationMs)
}

export function isItemOwned(id: string): boolean {
  return readOwned().has(id)
}

export function getOwnedItemIds(): string[] {
  return [...readOwned()]
}

function readDiscoverBoostUntilMs(): number {
  try {
    const s = localStorage.getItem(LS_DISCOVER_BOOST_UNTIL)
    if (s == null) return 0
    const n = Math.floor(Number(s))
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function setDiscoverBoostUntilMs(ts: number) {
  try {
    if (ts <= 0) localStorage.removeItem(LS_DISCOVER_BOOST_UNTIL)
    else localStorage.setItem(LS_DISCOVER_BOOST_UNTIL, String(Math.floor(ts)))
  } catch {
    /* */
  }
  notifyShopUpdate()
}

/** Tijd (ms) waarop de boost eindigt; 0 = geen boost. */
export function getDiscoverBoostUntilMs(): number {
  return readDiscoverBoostUntilMs()
}

/** Actief: Discover+-sortering telt de boost mee. */
export function isDiscoverBoostActive(): boolean {
  return Date.now() < readDiscoverBoostUntilMs()
}

export function getDiscoverBoostRemainingLabel(): string {
  const t = readDiscoverBoostUntilMs()
  if (t <= Date.now()) return ''
  const s = Math.max(0, Math.floor((t - Date.now()) / 1000))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h > 0) {
    return `${h}u ${r}m`
  }
  return `${m} min`
}

const THEME_ID: Record<ThemeKey, string> = {
  sunset: 'theme_sunset',
  ocean: 'theme_ocean',
  midnight: 'theme_midnight',
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'frame_gold',
    name: 'Gouden frame',
    desc: 'Gouden rand rond je avatar in Friends & Discover (cosmetisch).',
    price: 80,
    icon: '✦',
    type: 'permanent',
    feature: 'frame_gold',
  },
  {
    id: 'frame_silver',
    name: 'Zilveren frame',
    desc: 'Strakke zilveren rand; combineert goed met glow.',
    price: 45,
    icon: '◇',
    type: 'permanent',
    feature: 'frame_silver',
  },
  {
    id: 'boost_15m',
    name: 'Zicht-boost 15 min',
    desc: 'Bovenaan in Discover+ tot de tijd op is; stapelt bij herkoop.',
    price: 40,
    icon: '⚡',
    type: 'consumable',
    boostMs: BOOST_IDS.boost_15m,
  },
  {
    id: 'boost_1h',
    name: 'Zicht-boost 1 uur',
    desc: 'Langer bovenaan in Discover+ op dit apparaat.',
    price: 120,
    icon: '🚀',
    type: 'consumable',
    boostMs: BOOST_IDS.boost_1h,
  },
  {
    id: 'sticker_pack',
    name: 'Stickerpakket',
    desc: 'Snelle mood-stickers in de chatbalk boven verzenden.',
    price: 60,
    icon: '✨',
    type: 'permanent',
    feature: 'sticker',
  },
  {
    id: 'theme_sunset',
    name: 'Thema zonsondergang',
    desc: 'Warme, zachte tinten in de hele app.',
    price: 200,
    icon: '🌅',
    type: 'theme',
    themeKey: 'sunset',
  },
  {
    id: 'theme_ocean',
    name: 'Thema oceaan',
    desc: 'Koele blauw-groene accenten (winkelthema).',
    price: 180,
    icon: '🌊',
    type: 'theme',
    themeKey: 'ocean',
  },
  {
    id: 'theme_midnight',
    name: 'Thema middernacht',
    desc: 'Diepe nachttinten met paarse highlights.',
    price: 220,
    icon: '🌙',
    type: 'theme',
    themeKey: 'midnight',
  },
  {
    id: 'name_glow',
    name: 'Naam-glow',
    desc: 'Zachte gloed op belangrijke titels en je naam in het menu.',
    price: 150,
    icon: '🎨',
    type: 'permanent',
    feature: 'glow',
  },
  {
    id: 'crown_badge',
    name: 'Kroon op profiel',
    desc: 'Kleine kroon naast "Your profile" wanneer je in je profiel zit.',
    price: 55,
    icon: '👑',
    type: 'permanent',
    feature: 'crown',
  },
  {
    id: 'chat_heart',
    name: 'Hart-belletjes',
    desc: 'Je eigen chatbubbels: warme hartgradiënt in plaats van effen paars.',
    price: 90,
    icon: '💬',
    type: 'permanent',
    feature: 'chat_heart',
  },
]

function migrateActiveTheme() {
  try {
    if (localStorage.getItem(LS_ACTIVE_THEME) != null) return
    if (isItemOwned('theme_sunset')) {
      localStorage.setItem(LS_ACTIVE_THEME, 'sunset')
    }
  } catch {
    /* */
  }
}

function readActiveThemeKey(): ThemeKey | null {
  try {
    migrateActiveTheme()
    const s = localStorage.getItem(LS_ACTIVE_THEME)
    if (s === 'sunset' || s === 'ocean' || s === 'midnight') {
      if (s === 'sunset' && isItemOwned('theme_sunset')) return s
      if (s === 'ocean' && isItemOwned('theme_ocean')) return s
      if (s === 'midnight' && isItemOwned('theme_midnight')) return s
    }
    for (const k of ['ocean', 'midnight', 'sunset'] as const) {
      if (isItemOwned(THEME_ID[k])) return k
    }
  } catch {
    /* */
  }
  return null
}

function writeActiveThemeKey(k: ThemeKey) {
  try {
    localStorage.setItem(LS_ACTIVE_THEME, k)
  } catch {
    /* */
  }
  notifyShopUpdate()
}

export function getActiveThemeKey(): ThemeKey | null {
  return readActiveThemeKey()
}

export function isThemeItemActive(id: string): boolean {
  const it = SHOP_ITEMS.find((x) => x.id === id)
  if (!it || it.type !== 'theme' || !it.themeKey) return false
  return readActiveThemeKey() === it.themeKey
}

/**
 * Wissel het actieve thema (geen kosten) — je moet het thema in bezit hebben.
 */
export function setActiveThemeByKey(k: ThemeKey): boolean {
  const id = THEME_ID[k]
  if (!isItemOwned(id)) return false
  writeActiveThemeKey(k)
  applyShopToDocument()
  return true
}

function resolveBoostDurationMs(id: string): number {
  const item = SHOP_ITEMS.find((x) => x.id === id)
  if (item?.boostMs) return item.boostMs
  return BOOST_IDS[id] ?? 0
}

export function tryBuyItem(
  id: string,
):
  | { ok: true; balance: number }
  | { ok: false; reason: 'insufficient' | 'owned' | 'unknown' } {
  const item = SHOP_ITEMS.find((x) => x.id === id)
  if (!item) {
    return { ok: false, reason: 'unknown' }
  }
  const owned = readOwned()
  const b = getCoinBalance()

  if (item.type === 'consumable') {
    if (b < item.price) return { ok: false, reason: 'insufficient' }
    const d = resolveBoostDurationMs(id)
    if (d <= 0) return { ok: false, reason: 'unknown' }
    setCoinBalance(b - item.price)
    const now = Date.now()
    const cur = readDiscoverBoostUntilMs()
    const base = Math.max(now, cur)
    setDiscoverBoostUntilMs(base + d)
    return { ok: true, balance: getCoinBalance() }
  }

  if (item.type === 'theme') {
    if (owned.has(id)) return { ok: false, reason: 'owned' }
    if (b < item.price) return { ok: false, reason: 'insufficient' }
    setCoinBalance(b - item.price)
    owned.add(id)
    writeOwned(owned)
    return { ok: true, balance: getCoinBalance() }
  }

  if (item.type === 'permanent') {
    if (owned.has(id)) return { ok: false, reason: 'owned' }
    if (b < item.price) return { ok: false, reason: 'insufficient' }
    setCoinBalance(b - item.price)
    owned.add(id)
    writeOwned(owned)
    return { ok: true, balance: getCoinBalance() }
  }

  return { ok: false, reason: 'unknown' }
}

/**
 * Thema, frames, glow, kroon, chat-hart: zet `data-*` op `<html>`.
 * Roep aan na opstart en na aankopen (ook vanuit onbalans-update).
 */
export function applyShopToDocument() {
  const root = document.documentElement
  if (!root) return
  try {
    const theme = readActiveThemeKey()
    if (theme) root.setAttribute('data-shop-theme', theme)
    else root.removeAttribute('data-shop-theme')

    if (isItemOwned('frame_gold')) {
      root.setAttribute('data-shop-frame', 'gold')
    } else if (isItemOwned('frame_silver')) {
      root.setAttribute('data-shop-frame', 'silver')
    } else {
      root.removeAttribute('data-shop-frame')
    }

    root.setAttribute('data-shop-name-glow', isItemOwned('name_glow') ? '1' : '0')
    root.setAttribute('data-shop-crown', isItemOwned('crown_badge') ? '1' : '0')
    root.setAttribute('data-shop-heart-bubble', isItemOwned('chat_heart') ? '1' : '0')
  } catch {
    /* */
  }
}

/** @deprecated — gebruik `applyShopToDocument` */
export function applySavedShopTheme() {
  applyShopToDocument()
}
