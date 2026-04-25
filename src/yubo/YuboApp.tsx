import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import {
  addIncomingForRecipient,
  addOutgoingLikeFor,
  banUser,
  buildLocalSwipeProfileSnapshot,
  clearAdminLocalData,
  getAdminStats,
  getAdminUsers,
  getLiveViewerCount,
  getStreamingLiveProfilesForUserIds,
  getSwipeableLiveProfilesForMe,
  isUserBanned,
  mainPhotoForUserId,
  pingLiveViewer,
  publishMyLiveProfile,
  queueChatAfterAccept,
  readAdminReports,
  readBannedUsers,
  readIncomingFor,
  readLiveJoinRequests,
  readOutgoingLikesFor,
  requestJoinLive,
  removeIncoming,
  saveAdminReport,
  setLiveJoinRequestStatus,
  takeChatsAfterAcceptForMe,
  unbanUser,
  type AdminReport,
  type AdminStats,
  type AdminUserRow,
  type IncomingItem,
  type LiveJoinRequest,
  type LikedItem,
  slugName,
  subscribeLiveSync,
} from '../lib/incomingSwipes'
import { loadAppSession } from '../lib/appSession'
import {
  addCoins,
  applyShopToDocument,
  getCoinBalance,
  isDiscoverBoostActive,
  isItemOwned,
  setCoinBalance,
} from '../lib/coinsAndShop'
import {
  applyPremiumWelcomeBonus,
  getPremiumPlan,
  isPremiumUnlocked,
  PREMIUM_PLAN_BENEFITS,
  setPremiumUnlocked as persistPremium,
} from '../lib/premium'
import { verifyPremiumSession } from '../lib/stripePremiumClient'
import {
  isFriendsDiscoverUnlocked,
  setFriendsDiscoverUnlocked,
} from '../lib/friendsDiscoverPremium'
import {
  isLikesInboxUnlocked,
  setLikesInboxUnlocked as persistLikesInboxUnlocked,
} from '../lib/likesInboxPremium'
import {
  startLikesInboxCheckout,
  verifyLikesInboxSession,
} from '../lib/stripeLikesClient'
import {
  startStripeDiscoverCheckout,
  verifyDiscoverCheckoutSession,
} from '../lib/stripeDiscoverClient'
import { formatStripeUserError } from '../lib/stripeUserError'
import { verifyCoinPackSession } from '../lib/stripeShopClient'
import { CHAT_GIF_PRESETS } from '../lib/chatGifPresets'
import { giphyImgFallbackSources } from '../lib/giphyUrl'
import {
  isMatchFavorite,
  readFavSet,
  toggleMatchFavorite,
} from '../lib/matchFavorites'
import {
  readMutedWords,
  writeMutedWords,
  type MutedEntry,
} from '../lib/mutedWords'
import {
  loadMatchPreferences,
  saveMatchPreferences,
  type MatchGenderPreference,
  type MatchPreferences,
} from '../lib/matchPreferences'
import {
  loadPushPreferences,
  savePushPreferences,
  type PushPreferences,
} from '../lib/pushPreferences'
import {
  BROADCAST,
  THREAD_KEY_PREFIX,
  type BCEnvelope,
  type SwChatMsg,
  appendMessageDedupe,
  getOrCreateUserId,
  postChat,
  randomId,
  readStoredMatches,
  readThread,
  writeStoredMatches,
  writeThread,
} from '../lib/realChatSync'
import {
  loadYuboProfileForUser,
  saveYuboProfileForUser,
} from '../lib/yuboProfileLocal'
import {
  publishSharedUser,
  syncSharedUsers,
  syncSharedUsersDetailed,
} from '../lib/localUserDb'
import {
  fetchSharedSwipeState,
  recordSharedSwipe,
  type SharedSwipeState,
} from '../lib/sharedSwipes'
import { DiscoverPanel, SwipeProfileCard } from './DiscoverPanel'
import { getDiscoverPlusSuggestions, type SwipeProfile } from './discoverData'
import { FaceVerifyScreen } from './FaceVerifyScreen'
import { PremiumScreen } from './PremiumScreen'
import { ShopScreen } from './ShopScreen'
import './yubo.css'

export type YuboTab = 0 | 1 | 2 | 3 | 4
type YuboOverlay =
  | null
  | 'profile'
  | 'muted'
  | 'verify'
  | 'shop'
  | 'premium'
  | 'admin'
  | 'help'
  | 'community'
  | 'legal'
  | 'matchPrefs'
  | 'pushPrefs'

/** Roulatiekleuren voor zelf toegevoegde tags */
const TAG_COLOR_PALETTE: string[] = [
  '#2d7ce8',
  '#22a855',
  '#f5a224',
  '#7c3aed',
  '#3bb6e8',
  '#ec4899',
  '#0ea5e9',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#e11d48',
  '#65a30d',
  '#0d9488',
]

const MAX_USER_TAGS = 20
const MIN_USER_TAGS = 3

type ProfileTag = { id: string; t: string; c: string }

const DEFAULT_PROFILE_PHOTOS: string[] = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80',
]

const MAX_PROFILE_PHOTOS = 5

const LIVE_GIFTS = [
  { id: 'rose', label: 'Roos', icon: '🌹', cost: 5 },
  { id: 'icecream', label: 'IJsje', icon: '🍦', cost: 10 },
  { id: 'heart', label: 'Hart', icon: '💖', cost: 15 },
  { id: 'star', label: 'Ster', icon: '⭐', cost: 25 },
  { id: 'rocket', label: 'Rocket', icon: '🚀', cost: 50 },
  { id: 'crown', label: 'Kroon', icon: '👑', cost: 100 },
  { id: 'diamond', label: 'Diamond', icon: '💎', cost: 250 },
  { id: 'lion', label: 'Leeuw', icon: '🦁', cost: 500 },
] as const

type LiveGift = (typeof LIVE_GIFTS)[number]

function canUseBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function browserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!canUseBrowserNotifications()) return 'unsupported'
  return Notification.permission
}

type Props = {
  displayName: string
  didCompleteAgeFlow: boolean
  onBackToOnboarding: () => void
  /** true na scan van QR op telefoon (?faceVerify=1) */
  faceVerifyOnLaunch?: boolean
  /** Optioneel: na geslaagde gezichtscheck (bijv. bevestig-knop) — zet ID-status in de app-sessie. */
  onIdVerificationSuccess?: () => void
}

function TabIcon({ tab, active }: { tab: YuboTab; active: boolean }) {
  const ac = active ? 'var(--yubo-ink)' : '#a09a90'
  switch (tab) {
    case 0:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="5" width="6" height="6" rx="1.2" fill={ac} stroke="none" />
          <rect x="11" y="5" width="6" height="6" rx="1.2" fill={ac} stroke="none" />
          <rect x="3" y="14" width="6" height="6" rx="1.2" fill={ac} stroke="none" />
          <rect x="11" y="14" width="6" height="6" rx="1.2" fill={ac} stroke="none" />
        </svg>
      )
    case 1:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M5 4h11a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3z"
            fill="none"
            stroke={ac}
            strokeWidth="1.6"
          />
          <path
            d="M8 18v2h9m-1-2v-2.5A2.5 2.5 0 0 0 12.5 13a2.5 2.5 0 0 0-2.5 2.5V18"
            fill="none"
            stroke={ac}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 2:
      return (
        <svg className="heart" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 19s-6.5-4.1-6.5-9.2A4.1 4.1 0 0 1 10 5.2 4.1 4.1 0 0 1 12 6.7a4.1 4.1 0 0 1 2-1.5A4.1 4.1 0 0 1 18.5 9.8C18.5 14.9 12 19 12 19Z"
            fill={ac}
          />
        </svg>
      )
    case 3:
      return (
        <svg className="people" viewBox="0 0 24 24" aria-hidden>
          <circle cx="8" cy="7" r="2.2" fill={ac} />
          <path
            d="M4.5 18.5v-1.5a3.5 3.5 0 0 1 3.5-3.5H9.5A3.5 3.5 0 0 1 13 17v1.5"
            fill="none"
            stroke={ac}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="16" cy="6.5" r="1.6" fill={ac} />
          <path
            d="M14.5 18.5V17a2.5 2.5 0 0 1 2-2.4"
            fill="none"
            stroke={ac}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )
    case 4:
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect
            x="3"
            y="3"
            width="7.5"
            height="7.5"
            rx="1.5"
            fill={ac}
            stroke="none"
          />
          <rect
            x="13.5"
            y="3"
            width="7.5"
            height="7.5"
            rx="1.5"
            fill={ac}
            stroke="none"
          />
          <rect
            x="3"
            y="13.5"
            width="7.5"
            height="7.5"
            rx="1.5"
            fill={ac}
            stroke="none"
          />
          <rect
            x="13.5"
            y="13.5"
            width="7.5"
            height="7.5"
            rx="1.5"
            fill={ac}
            stroke="none"
          />
        </svg>
      )
  }
}

const TAB_LABEL: Record<YuboTab, string> = {
  0: 'Swipes',
  1: 'Chats',
  2: 'Likes',
  3: 'Friends',
  4: 'Menu',
}

function BannedAccountScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="yubo-whole yubo-banned-whole">
      <div className="yubo-banned-card" role="alert">
        <img src="/logo.png" alt="Swipey" width={86} height={34} />
        <h1>Account geblokkeerd</h1>
        <p>
          Je kunt Swipey niet meer gebruiken met dit account. Neem contact op met
          de beheerder als je denkt dat dit een fout is.
        </p>
        <button type="button" onClick={onLogout}>
          Terug naar start
        </button>
      </div>
    </div>
  )
}

export function YuboApp({
  displayName,
  didCompleteAgeFlow,
  onBackToOnboarding,
  faceVerifyOnLaunch = false,
  onIdVerificationSuccess,
}: Props) {
  const [tab, setTab] = useState<YuboTab>(0)
  const [overlay, setOverlay] = useState<YuboOverlay>(null)
  const faceFromUrlRef = useRef(false)
  const [subFriends, setSubFriends] = useState<'live' | 'req' | 'dis'>('live')
  const [discoverUnlocked, setDiscoverUnlocked] = useState(
    isFriendsDiscoverUnlocked,
  )
  const [likesInboxUnlocked, setLikesInboxUnlocked] = useState(
    isLikesInboxUnlocked,
  )
  const [premiumUnlocked, setPremiumState] = useState(isPremiumUnlocked)
  const [premiumPlan, setPremiumPlan] = useState(getPremiumPlan)
  const [userCoins, setUserCoins] = useState(() => getCoinBalance())
  const [matchPreferences, setMatchPreferences] = useState(loadMatchPreferences)
  const [pushPreferences, setPushPreferences] = useState(loadPushPreferences)
  const [sharedSwipeState, setSharedSwipeState] = useState<SharedSwipeState>({
    outgoingTargetIds: [],
    incomingProfiles: [],
    matchProfiles: [],
  })
  const [, setShopUiBust] = useState(0)

  const hasDiscoverAccess = useMemo(
    () => premiumUnlocked || discoverUnlocked,
    [premiumUnlocked, discoverUnlocked],
  )
  const hasLikesAccess = useMemo(
    () => premiumUnlocked || likesInboxUnlocked,
    [premiumUnlocked, likesInboxUnlocked],
  )
  const [myId] = useState(() => getOrCreateUserId())
  const [bio, setBio] = useState(
    () =>
      loadYuboProfileForUser(myId)?.bio ??
      'tat queen from the south, kinda sweet, mostly savage \uD83D\uDC79',
  )
  const [role, setRole] = useState(
    () => loadYuboProfileForUser(myId)?.role ?? 'Tattoo Artist',
  )
  const [workplace, setWorkplace] = useState(
    () => loadYuboProfileForUser(myId)?.workplace ?? 'Inkspire Studio',
  )
  const [discoHero] = useState('Show off your style')
  const [swipeName, setSwipeName] = useState(() => {
    const id = getOrCreateUserId()
    const s0 = loadYuboProfileForUser(id)
    if (s0?.publicName?.trim()) {
      return s0.publicName.trim()
    }
    const app0 = loadAppSession()
    if (app0?.name?.trim()) {
      return app0.name.trim()
    }
    return (displayName || 'Gast').trim() || 'Gast'
  })
  const [profileTags, setProfileTags] = useState<ProfileTag[]>(() => {
    const s = loadYuboProfileForUser(myId)
    if (s?.tags?.length) {
      return s.tags.map((t) => ({ id: t.id, t: t.t, c: t.c }))
    }
    return []
  })
  const [profilePhotos, setProfilePhotos] = useState<string[]>(() => {
    const s = loadYuboProfileForUser(myId)
    if (s?.photos?.length) {
      return s.photos
    }
    return [...DEFAULT_PROFILE_PHOTOS]
  })
  const [matches, setMatches] = useState<SwipeProfile[]>(() =>
    readStoredMatches(myId),
  )
  /** Blijft in parent: ChatPanel demount o.a. bij tab- of overlay-wissel, anders verdwijnt actief gesprek. */
  const [chatOpenThreadId, setChatOpenThreadId] = useState<string | null>(null)
  const [liveDeck, setLiveDeck] = useState<SwipeProfile[]>(() =>
    getSwipeableLiveProfilesForMe(myId),
  )
  const [incomingRows, setIncomingRows] = useState<IncomingItem[]>(() =>
    readIncomingFor(myId),
  )
  const [outgoingLikes, setOutgoingLikes] = useState<LikedItem[]>(() =>
    readOutgoingLikesFor(myId),
  )
  const [discoverSortTick, setDiscoverSortTick] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamTitle, setStreamTitle] = useState('Kom gezellig meepraten')
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null)
  const [liveViewerCount, setLiveViewerCount] = useState(() => getLiveViewerCount(myId))
  const [liveJoinRequests, setLiveJoinRequests] = useState<LiveJoinRequest[]>(() =>
    readLiveJoinRequests(myId),
  )
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(browserNotificationPermission)
  const [appNotice, setAppNotice] = useState('')
  const [isCurrentUserBanned, setIsCurrentUserBanned] = useState(() => isUserBanned(myId))
  const knownIncomingIdsRef = useRef(new Set(incomingRows.map((row) => row.id)))
  const seenChatMsgIdsRef = useRef(new Set<string>())

  /** Sessie- / app-naam: alleen meenemen als we nog geen expliciete weergavenaam in yubo-opslag hebben. */
  useEffect(() => {
    if (loadYuboProfileForUser(myId)?.publicName?.trim()) {
      return
    }
    const s = loadAppSession()
    const from =
      (s?.name && s.name.trim()) ||
      (displayName || 'Gast').trim() ||
      'Gast'
    if (from) {
      setSwipeName(from)
    }
  }, [myId, displayName])
  useEffect(() => {
    const t = window.setInterval(() => setDiscoverSortTick((n) => n + 1), 25_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      const [usersOk, swipeState] = await Promise.all([
        syncSharedUsers(),
        fetchSharedSwipeState(myId),
      ])
      if (cancelled) return
      setSharedSwipeState(swipeState)
      for (const incoming of swipeState.incomingProfiles) {
        addIncomingForRecipient(myId, incoming)
      }
      setIncomingRows(readIncomingFor(myId))
      setMatches((prev) => {
        let next = prev
        for (const match of swipeState.matchProfiles) {
          if (next.some((m) => (match.liveUserId && m.liveUserId === match.liveUserId) || m.id === match.id)) {
            continue
          }
          next = [...next, match]
        }
        return next
      })
      if (!usersOk) return
      setLiveDeck(getSwipeableLiveProfilesForMe(myId))
    }
    void sync()
    const t = window.setInterval(() => {
      void sync()
    }, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [myId])

  const filteredLiveDeck = useMemo(() => {
    const min = matchPreferences.flexibleAge
      ? Math.max(13, matchPreferences.minAge - 3)
      : matchPreferences.minAge
    const max = matchPreferences.flexibleAge
      ? Math.min(99, matchPreferences.maxAge + 3)
      : matchPreferences.maxAge
    const alreadySeen = new Set(sharedSwipeState.outgoingTargetIds)
    return liveDeck.filter((profile) => {
      const peerId = profile.liveUserId || profile.id
      return profile.age >= min && profile.age <= max && !alreadySeen.has(peerId)
    })
  }, [liveDeck, matchPreferences, sharedSwipeState.outgoingTargetIds])

  const updateMatchPreferences = useCallback((next: MatchPreferences) => {
    setMatchPreferences(next)
    saveMatchPreferences(next)
  }, [])

  const updatePushPreferences = useCallback((next: PushPreferences) => {
    setPushPreferences(next)
    savePushPreferences(next)
  }, [])

  const friendsDiscoverSuggestions = useMemo(() => {
    const base = getDiscoverPlusSuggestions(filteredLiveDeck)
    if (!isDiscoverBoostActive()) return base
    return [...base].sort((a, b) => {
      const wa = a.city === 'Actief' ? 0 : 1
      const wb = b.city === 'Actief' ? 0 : 1
      if (wa !== wb) return wa - wb
      return 0
    })
  }, [filteredLiveDeck, discoverSortTick])

  const followedLive = useMemo(
    () =>
      getStreamingLiveProfilesForUserIds(
        matches.map((m) => m.liveUserId ?? '').filter(Boolean),
      ),
    [matches, liveDeck],
  )

  const showAppNotice = useCallback((message: string) => {
    setAppNotice(message)
    window.setTimeout(() => {
      setAppNotice((current) => (current === message ? '' : current))
    }, 4500)
  }, [])

  const notifyUser = useCallback(
    (title: string, body: string) => {
      showAppNotice(`${title}: ${body}`)
      if (browserNotificationPermission() === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/logo.png',
            tag: `swipey-${title}`,
          })
        } catch {
          /* */
        }
      }
    },
    [showAppNotice],
  )

  const enableNotifications = useCallback(async () => {
    if (!canUseBrowserNotifications()) {
      setNotificationPermission('unsupported')
      showAppNotice('Meldingen worden niet ondersteund in deze browser.')
      return
    }
    const next = await Notification.requestPermission()
    setNotificationPermission(next)
    showAppNotice(
      next === 'granted'
        ? 'Meldingen staan aan.'
        : 'Meldingen zijn niet toegestaan door je browser.',
    )
  }, [showAppNotice])

  useEffect(() => {
    return subscribeLiveSync(() => {
      const banned = isUserBanned(myId)
      setIsCurrentUserBanned(banned)
      if (banned) {
        setIsStreaming(false)
        setStreamStartedAt(null)
        setOverlay(null)
        setChatOpenThreadId(null)
        return
      }
      setLiveDeck(getSwipeableLiveProfilesForMe(myId))
      setLiveViewerCount(getLiveViewerCount(myId))
      setLiveJoinRequests(readLiveJoinRequests(myId))
      const nextIncoming = readIncomingFor(myId)
      const newIncoming = nextIncoming.filter(
        (row) => !knownIncomingIdsRef.current.has(row.id),
      )
      for (const row of nextIncoming) knownIncomingIdsRef.current.add(row.id)
      setIncomingRows(nextIncoming)
      setOutgoingLikes(readOutgoingLikesFor(myId))
      if (newIncoming.length > 0) {
        notifyUser(
          'Nieuwe toevoeging',
          `${newIncoming[0].card.name} heeft jou toegevoegd/geliket.`,
        )
      }
      setMatches((prev) => {
        const batch = takeChatsAfterAcceptForMe(myId)
        if (batch.length === 0) return prev
        let n = prev
        for (const peer of batch) {
          if (
            n.some(
              (x) =>
                (peer.liveUserId && x.liveUserId === peer.liveUserId) ||
                x.id === peer.id,
            )
          ) {
            continue
          }
          n = [...n, peer]
        }
        return n
      })
    })
  }, [myId, notifyUser])

  if (isCurrentUserBanned) {
    return (
      <BannedAccountScreen
        onLogout={() => {
          onBackToOnboarding()
        }}
      />
    )
  }

  useEffect(() => {
    if (!isStreaming) return
    setLiveViewerCount(getLiveViewerCount(myId))
    const t = window.setInterval(() => setLiveViewerCount(getLiveViewerCount(myId)), 2000)
    return () => window.clearInterval(t)
  }, [isStreaming, myId])

  useEffect(() => {
    for (const match of matches) {
      for (const msg of readThread(match.id)) {
        seenChatMsgIdsRef.current.add(msg.id)
      }
    }
  }, [matches])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const bc = new BroadcastChannel(BROADCAST)
    const notifyMessage = (matchId: string, msg: SwChatMsg) => {
      if (msg.fromUser === myId || seenChatMsgIdsRef.current.has(msg.id)) return
      seenChatMsgIdsRef.current.add(msg.id)
      const sender = matches.find((m) => m.id === matchId)?.name ?? 'Iemand'
      notifyUser('Nieuw bericht', `${sender}: ${inboxPreviewMsgs([msg], sender, myId)}`)
    }
    const onMsg = (e: MessageEvent) => {
      const d = e.data as BCEnvelope
      if (!d || d.v !== 1 || d.t !== 'msg') return
      notifyMessage(d.matchId, d.msg)
    }
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith(THREAD_KEY_PREFIX) || e.newValue == null) return
      const matchId = e.key.slice(THREAD_KEY_PREFIX.length)
      try {
        const list = JSON.parse(e.newValue) as SwChatMsg[]
        if (!Array.isArray(list)) return
        for (const msg of list) notifyMessage(matchId, msg)
      } catch {
        /* */
      }
    }
    bc.addEventListener('message', onMsg)
    window.addEventListener('storage', onStorage)
    return () => {
      bc.removeEventListener('message', onMsg)
      bc.close()
      window.removeEventListener('storage', onStorage)
    }
  }, [matches, myId, notifyUser])

  /** Op Swipes: altijd laatst bekende profielen in de pool (bijv. iemand anders vult net een profiel). */
  useEffect(() => {
    if (overlay !== null || tab !== 0) return
    setLiveDeck(getSwipeableLiveProfilesForMe(myId))
  }, [tab, overlay, myId])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const st = p.get('stripe_discover')
    if (st === 'cancel') {
      const u = new URL(window.location.href)
      u.searchParams.delete('stripe_discover')
      window.history.replaceState({}, '', u.toString())
      setTimeout(() => {
        setTab(3)
        setSubFriends('dis')
      }, 0)
      return
    }
    if (st !== '1' || !p.get('session_id')) return
    const sessionId = p.get('session_id') as string
    let cancelled = false
    ;(async () => {
      const ok = await verifyDiscoverCheckoutSession(sessionId)
      if (cancelled) return
      if (ok) {
        setFriendsDiscoverUnlocked(true)
        setDiscoverUnlocked(true)
        setTimeout(() => {
          setTab(3)
          setSubFriends('dis')
        }, 0)
      }
      const u = new URL(window.location.href)
      u.searchParams.delete('stripe_discover')
      u.searchParams.delete('session_id')
      window.history.replaceState(
        {},
        '',
        u.pathname + (u.search ? u.search : '') + (u.hash || ''),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const startStripeDiscover = useCallback(async () => {
    await startStripeDiscoverCheckout()
  }, [])

  const startLikesCheckout = useCallback(async () => {
    await startLikesInboxCheckout()
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('likes_paid') === 'cancel') {
      const u = new URL(window.location.href)
      u.searchParams.delete('likes_paid')
      window.history.replaceState({}, '', u.toString())
      setTimeout(() => {
        setTab(2)
      }, 0)
      return
    }
    if (p.get('likes_paid') !== '1' || !p.get('session_id')) {
      return
    }
    const sessionId = p.get('session_id') as string
    let cancelled = false
    ;(async () => {
      const ok = await verifyLikesInboxSession(sessionId)
      if (cancelled) {
        return
      }
      if (ok) {
        persistLikesInboxUnlocked(true)
        setLikesInboxUnlocked(true)
        setTimeout(() => {
          setTab(2)
        }, 0)
      }
      const u = new URL(window.location.href)
      u.searchParams.delete('likes_paid')
      u.searchParams.delete('session_id')
      window.history.replaceState(
        {},
        '',
        u.pathname + (u.search ? u.search : '') + (u.hash || ''),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    applyShopToDocument()
  }, [])

  useEffect(() => {
    const onShop = () => {
      applyShopToDocument()
      setShopUiBust((n) => n + 1)
    }
    window.addEventListener('swipey-shop-updated', onShop)
    return () => window.removeEventListener('swipey-shop-updated', onShop)
  }, [])

  useEffect(() => {
    const onStore = (e: StorageEvent) => {
      if (e.key === 'swipey-coins-v1' && e.newValue != null) {
        setUserCoins(getCoinBalance())
        return
      }
      if (
        e.key === 'swipey-shop-owned-v1' ||
        e.key === 'swipey-active-theme' ||
        e.key === 'swipey-discover-boost-until'
      ) {
        applyShopToDocument()
        setShopUiBust((n) => n + 1)
      }
    }
    window.addEventListener('storage', onStore)
    return () => window.removeEventListener('storage', onStore)
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('shop_coins') === 'cancel') {
      const u = new URL(window.location.href)
      u.searchParams.delete('shop_coins')
      window.history.replaceState({}, '', u.toString())
      setTimeout(() => {
        setTab(3)
        setOverlay('shop')
      }, 0)
      return
    }
    if (p.get('shop_coins') !== '1' || !p.get('session_id')) {
      return
    }
    const sessionId = p.get('session_id') as string
    let cancel = false
    ;(async () => {
      const n = await verifyCoinPackSession(sessionId)
      if (cancel) {
        return
      }
      if (n > 0) {
        addCoins(n)
        setUserCoins(getCoinBalance())
        setTimeout(() => {
          setTab(3)
          setOverlay('shop')
        }, 0)
      }
      const u = new URL(window.location.href)
      u.searchParams.delete('shop_coins')
      u.searchParams.delete('session_id')
      window.history.replaceState(
        {},
        '',
        u.pathname + (u.search ? u.search : '') + (u.hash || ''),
      )
    })()
    return () => {
      cancel = true
    }
  }, [])

  const showShopCoinTopUp = import.meta.env.VITE_SHOP_COIN_STRIPE !== '0'

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('swipey_premium') === 'cancel') {
      const u = new URL(window.location.href)
      u.searchParams.delete('swipey_premium')
      window.history.replaceState({}, '', u.toString())
      setTimeout(() => {
        setTab(4)
        setOverlay('premium')
      }, 0)
      return
    }
    if (p.get('swipey_premium') !== '1' || !p.get('session_id')) {
      return
    }
    const sessionId = p.get('session_id') as string
    let cancel = false
    ;(async () => {
      const result = await verifyPremiumSession(sessionId)
      if (cancel) {
        return
      }
      if (result.ok) {
        persistPremium(true, result.plan)
        setPremiumState(true)
        setPremiumPlan(result.plan)
        applyPremiumWelcomeBonus()
        setUserCoins(getCoinBalance())
        setTimeout(() => {
          setTab(4)
          setOverlay(null)
        }, 0)
      }
      const u = new URL(window.location.href)
      u.searchParams.delete('swipey_premium')
      u.searchParams.delete('session_id')
      window.history.replaceState(
        {},
        '',
        u.pathname + (u.search ? u.search : '') + (u.hash || ''),
      )
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    saveYuboProfileForUser(myId, {
      publicName: swipeName,
      bio,
      role,
      workplace,
      tags: profileTags,
      photos: profilePhotos,
    })
  }, [myId, swipeName, bio, role, workplace, profileTags, profilePhotos])

  useEffect(() => {
    let stopped = false
    const pushToLive = () => {
      const nm = (swipeName || 'Gast').trim() || 'Gast'
      const main = profilePhotos[0] ?? mainPhotoForUserId(myId)
      const extra =
        profilePhotos.length > 1 ? profilePhotos.slice(1) : []
      const userRecord = {
        v: 1 as const,
        userId: myId,
        name: nm,
        username: `${slugName(nm)}._${myId.slice(2, 6)}`,
        mainPhoto: main,
        extraPhotos: extra,
        tags: profileTags.map(({ t, c }) => ({ t, c })),
        bio,
        profession: role,
        company: workplace,
        updatedAt: Date.now(),
      }
      void publishSharedUser(userRecord).then((ok) => {
        if (!stopped && ok) {
          void syncSharedUsers().then(() => {
            if (!stopped) setLiveDeck(getSwipeableLiveProfilesForMe(myId))
          })
        }
      })
      publishMyLiveProfile({
        userId: myId,
        name: nm,
        username: `${slugName(nm)}._${myId.slice(2, 6)}`,
        mainPhoto: main,
        extraPhotos: extra,
        city: 'Online',
        age: 21,
        bio,
        profession: role,
        company: workplace,
        tags: profileTags.map(({ t, c }) => ({ t, c })),
        isStreaming,
        streamTitle: streamTitle.trim() || 'Live op Swipey',
        streamStartedAt: streamStartedAt ?? undefined,
        ts: Date.now(),
      })
    }
    const refreshOtherPlayers = () => {
      setLiveDeck(getSwipeableLiveProfilesForMe(myId))
    }
    const bump = () => {
      pushToLive()
      refreshOtherPlayers()
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      bump()
    }
    pushToLive()
    const t = window.setInterval(() => {
      pushToLive()
    }, 4000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', bump)
    return () => {
      stopped = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', bump)
    }
  }, [
    myId,
    swipeName,
    bio,
    role,
    workplace,
    profileTags,
    profilePhotos,
    isStreaming,
    streamTitle,
    streamStartedAt,
  ])

  const startMyLive = useCallback(() => {
    setStreamStartedAt((at) => at ?? Date.now())
    setIsStreaming(true)
  }, [])

  const stopMyLive = useCallback(() => {
    setIsStreaming(false)
    setStreamStartedAt(null)
  }, [])

  const sendLiveJoinRequest = useCallback(
    (p: SwipeProfile) => {
      if (!p.liveUserId) return
      requestJoinLive({
        streamerUserId: p.liveUserId,
        viewerUserId: myId,
        viewerName: (swipeName || 'Gast').trim() || 'Gast',
        viewerPhoto: profilePhotos[0] ?? mainPhotoForUserId(myId),
      })
      showAppNotice(`Meedoen aangevraagd bij ${p.name}.`)
    },
    [myId, swipeName, profilePhotos, showAppNotice],
  )

  const shareSwipeyForCoins = useCallback(async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?newAccount=1`
    const shareText = `${(swipeName || 'Ik').trim() || 'Ik'} nodigt je uit op Swipey.`
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Swipey',
          text: shareText,
          url: inviteUrl,
        })
      } else {
        await navigator.clipboard.writeText(inviteUrl)
      }
      addCoins(10)
      const nextBalance = getCoinBalance()
      setUserCoins(nextBalance)
      showAppNotice('+10 coins verdiend met delen.')
    } catch {
      showAppNotice('Delen is geannuleerd.')
    }
  }, [swipeName, showAppNotice])

  const updateLiveJoinRequest = useCallback(
    (requestId: string, status: LiveJoinRequest['status']) => {
      setLiveJoinRequestStatus(myId, requestId, status)
      setLiveJoinRequests(readLiveJoinRequests(myId))
    },
    [myId],
  )

  const sendLiveGift = useCallback(
    (p: SwipeProfile, gift: LiveGift): boolean => {
      const match = matches.find((m) => m.liveUserId && m.liveUserId === p.liveUserId)
      if (!match) return false
      const balance = getCoinBalance()
      if (balance < gift.cost) {
        setOverlay('shop')
        return false
      }
      const nextBalance = balance - gift.cost
      setCoinBalance(nextBalance)
      setUserCoins(nextBalance)
      const msg: SwChatMsg = {
        id: randomId(),
        fromUser: myId,
        ts: Date.now(),
        text: `${gift.icon} Gift gestuurd tijdens live: ${gift.label} (${gift.cost} coins)`,
      }
      const current = readThread(match.id)
      writeThread(match.id, appendMessageDedupe(current, msg))
      return true
    },
    [matches, myId],
  )

  const onMatch = useCallback(
    (p: SwipeProfile) => {
      if (!p.liveUserId) return
      addOutgoingLikeFor(myId, p)
      setOutgoingLikes(readOutgoingLikesFor(myId))
      addIncomingForRecipient(
        p.liveUserId,
        buildLocalSwipeProfileSnapshot({
          myUserId: myId,
          displayName: (swipeName || 'Gast').trim() || 'Gast',
          bio,
          profession: role,
          company: workplace,
          mainPhoto: profilePhotos[0] ?? mainPhotoForUserId(myId),
          extraPhotos:
            profilePhotos.length > 1
              ? profilePhotos.slice(1)
              : undefined,
          userTags: profileTags.map(({ t, c }) => ({ t, c })),
        }),
      )
    },
    [myId, swipeName, bio, role, workplace, profileTags, profilePhotos],
  )

  const onSwipeProfile = useCallback(
    (p: SwipeProfile, direction: 'left' | 'right') => {
      const peerId = p.liveUserId
      if (!peerId) return
      setSharedSwipeState((prev) => ({
        ...prev,
        outgoingTargetIds: [...new Set([...prev.outgoingTargetIds, peerId])],
      }))
      void (async () => {
        const nextState = await recordSharedSwipe({
          fromUserId: myId,
          toUserId: peerId,
          direction,
        })
        setSharedSwipeState(nextState)
        for (const incoming of nextState.incomingProfiles) {
          addIncomingForRecipient(myId, incoming)
        }
        setIncomingRows(readIncomingFor(myId))
        if (nextState.matchProfiles.length > 0) {
          setMatches((prev) => {
            let next = prev
            for (const match of nextState.matchProfiles) {
              if (next.some((m) => (match.liveUserId && m.liveUserId === match.liveUserId) || m.id === match.id)) {
                continue
              }
              next = [...next, match]
            }
            return next
          })
        }
      })()
    },
    [myId],
  )

  useEffect(() => {
    writeStoredMatches(myId, matches)
  }, [myId, matches])

  useEffect(() => {
    if (matches.length === 0) setChatOpenThreadId(null)
  }, [matches.length])

  useEffect(() => {
    if (chatOpenThreadId && !matches.some((m) => m.id === chatOpenThreadId)) {
      setChatOpenThreadId(null)
    }
  }, [matches, chatOpenThreadId])

  const closeOverlay = useCallback(() => setOverlay(null), [])

  useEffect(() => {
    if (faceVerifyOnLaunch && !faceFromUrlRef.current) {
      faceFromUrlRef.current = true
      setOverlay('verify')
    }
  }, [faceVerifyOnLaunch])

  const hero =
    overlay === 'profile'
      ? 'Show off your style'
      : overlay === 'shop'
        ? 'Shop & coins'
        : overlay === 'premium'
          ? 'Swipey Premium'
          : overlay === 'admin'
            ? 'Admin'
            : overlay === 'help'
              ? 'Swipey Help'
          : overlay === 'muted'
          ? 'Filter the noise.'
          : overlay === 'verify'
            ? 'Guaranteed legit profiles'
            : tab === 3
              ? 'See them lining up'
              : tab === 1
                ? 'Banter anytime'
                : discoHero

  return (
    <div className="yubo-whole">
      <header className="yubo-masthead" aria-label="Swipey">
        <div className="yubo-brand__mark">
          <img
            className="yubo-brand__img"
            src="/logo.png"
            alt="Swipey"
            width={200}
            height={80}
            decoding="async"
          />
        </div>
        <p className="yubo-hero" aria-hidden>
          {hero}
        </p>
      </header>

      <div className="yubo-layout" role="application" aria-label="Swipey">
        {overlay === 'profile' && (
          <ProfileEditScreen
            onBack={closeOverlay}
            swipeDisplayName={swipeName}
            onSwipeDisplayName={setSwipeName}
            myUserId={myId}
            bio={bio}
            onBio={setBio}
            role={role}
            onRole={setRole}
            workplace={workplace}
            onWorkplace={setWorkplace}
            userTags={profileTags}
            onUserTags={setProfileTags}
            photos={profilePhotos}
            onPhotos={setProfilePhotos}
          />
        )}

        {overlay === 'muted' && (
          <MutedScreen
            onBack={closeOverlay}
            matchPreferences={matchPreferences}
            onMatchPreferences={updateMatchPreferences}
          />
        )}

        {overlay === 'verify' && (
          <FaceVerifyScreen
            onBack={closeOverlay}
            onIdVerificationSuccess={onIdVerificationSuccess}
          />
        )}

        {overlay === 'shop' && (
          <ShopScreen
            onBack={closeOverlay}
            initialBalance={userCoins}
            onBalanceChange={(b) => {
              setUserCoins(b)
            }}
            showCoinTopUp={showShopCoinTopUp}
          />
        )}

        {overlay === 'premium' && (
          <PremiumScreen
            onBack={closeOverlay}
            alreadyPremium={premiumUnlocked}
            activePlanLabel={PREMIUM_PLAN_BENEFITS[premiumPlan].label}
            activePlan={premiumPlan}
          />
        )}

        {overlay === 'admin' && <AdminPanel onBack={closeOverlay} />}

        {overlay === 'help' && <HelpCenterScreen onBack={closeOverlay} />}

        {overlay === 'community' && <CommunityGuidelinesScreen onBack={closeOverlay} />}

        {overlay === 'legal' && <LegalScreen onBack={closeOverlay} />}

        {overlay === 'matchPrefs' && (
          <MatchPreferencesScreen
            value={matchPreferences}
            onChange={updateMatchPreferences}
            onBack={closeOverlay}
            onOpenSwipes={() => {
              setOverlay(null)
              setTab(0)
            }}
          />
        )}

        {overlay === 'pushPrefs' && (
          <PushPreferencesScreen
            value={pushPreferences}
            onChange={updatePushPreferences}
            notificationPermission={notificationPermission}
            onEnableNotifications={enableNotifications}
            onBack={closeOverlay}
          />
        )}

        {overlay === null && (
          <div
            className="yubo-tab-panel"
            style={{ display: tab === 0 ? 'flex' : 'none' }}
            hidden={tab !== 0}
            aria-hidden={tab !== 0}
          >
            <DiscoverPanel extraDeck={filteredLiveDeck} onMatch={onMatch} onSwipe={onSwipeProfile} />
          </div>
        )}

        {overlay === null && tab === 1 && (
          <ChatPanel
            matches={matches}
            liveProfiles={followedLive}
            onOpenSwipes={() => setTab(0)}
            openThreadId={chatOpenThreadId}
            onOpenThreadId={setChatOpenThreadId}
          />
        )}

        {overlay === null && tab === 2 && (
          <LikesInboxColumn
            unlocked
            incoming={incomingRows}
            outgoingLikes={outgoingLikes}
            myUserId={myId}
            notificationPermission={notificationPermission}
            onEnableNotifications={enableNotifications}
            onStartCheckout={startLikesCheckout}
            onOpenFriendsRequests={() => {
              setTab(3)
              setSubFriends('req')
            }}
          />
        )}

        {overlay === null && tab === 3 && (
          <FriendsPanel
            sub={subFriends}
            onSub={setSubFriends}
            onOpenMenuSettings={() => setTab(4)}
            userAvatarUrl={profilePhotos[0] ?? mainPhotoForUserId(myId)}
            userGreetingName={swipeName || 'Jij'}
            userCoins={userCoins}
            onOpenShop={() => {
              setOverlay('shop')
            }}
            discoverUnlocked={hasDiscoverAccess}
            onStripeDiscoverCheckout={startStripeDiscover}
            discoverSuggestions={friendsDiscoverSuggestions}
            onOpenSwipesTab={() => setTab(0)}
            incoming={incomingRows}
            followedLive={followedLive}
            matches={matches}
            myUserId={myId}
            liveJoinRequests={liveJoinRequests}
            isStreaming={isStreaming}
            liveViewerCount={liveViewerCount}
            streamTitle={streamTitle}
            onStreamTitle={setStreamTitle}
            onStartLive={startMyLive}
            onStopLive={stopMyLive}
            onSendGift={sendLiveGift}
            onRequestJoinLive={sendLiveJoinRequest}
            onUpdateJoinRequest={updateLiveJoinRequest}
            onOpenLiveChat={(p) => {
              const match = matches.find((m) => m.liveUserId && m.liveUserId === p.liveUserId)
              if (!match) return
              setChatOpenThreadId(match.id)
              setTab(1)
            }}
            onAcceptRequest={(it) => {
              setMatches((m) =>
                m.some(
                  (x) =>
                    (it.card.liveUserId && x.liveUserId === it.card.liveUserId) ||
                    x.id === it.card.id,
                )
                  ? m
                  : [...m, it.card],
              )
              queueChatAfterAccept(
                it.fromUserId,
                buildLocalSwipeProfileSnapshot({
                  myUserId: myId,
                  displayName: (swipeName || 'Gast').trim() || 'Gast',
                  bio,
                  profession: role,
                  company: workplace,
                  mainPhoto: profilePhotos[0] ?? mainPhotoForUserId(myId),
                  extraPhotos:
                    profilePhotos.length > 1
                      ? profilePhotos.slice(1)
                      : undefined,
                  userTags: profileTags.map(({ t, c }) => ({ t, c })),
                }),
              )
              removeIncoming(myId, it.id)
            }}
            onDismissRequest={(it) => removeIncoming(myId, it.id)}
          />
        )}

        {overlay === null && tab === 4 && (
          <MenuPanel
            displayName={swipeName}
            didCompleteAgeFlow={didCompleteAgeFlow}
            profilePhotoUrl={profilePhotos[0] ?? mainPhotoForUserId(myId)}
            onOpenProfile={() => setOverlay('profile')}
            onOpenMuted={() => setOverlay('muted')}
            onOpenPush={() => setOverlay('pushPrefs')}
            onOpenShop={() => setOverlay('shop')}
            onOpenPremium={() => setOverlay('premium')}
            onOpenAdmin={() => setOverlay('admin')}
            onOpenHelp={() => setOverlay('help')}
            onOpenCommunity={() => setOverlay('community')}
            onOpenLegal={() => setOverlay('legal')}
            onShareInvite={shareSwipeyForCoins}
            premiumUnlocked={premiumUnlocked}
            premiumPlanLabel={PREMIUM_PLAN_BENEFITS[premiumPlan].label}
            userCoins={userCoins}
            onBackFromMenu={() => setTab(0)}
            onGoSwipes={() => setOverlay('matchPrefs')}
            onLogout={onBackToOnboarding}
          />
        )}

        {overlay === null && (
          <TabBar
            tab={tab}
            onTab={setTab}
            hasLikesAccess={hasLikesAccess}
            hasDiscoverAccess={hasDiscoverAccess}
          />
        )}
        {appNotice ? (
          <div className="yubo-app-notice" role="status" aria-live="polite">
            {appNotice}
          </div>
        ) : null}
      </div>

    </div>
  )
}

function TabBar({
  tab,
  onTab,
  hasLikesAccess,
  hasDiscoverAccess,
}: {
  tab: YuboTab
  onTab: (t: YuboTab) => void
  hasLikesAccess: boolean
  hasDiscoverAccess: boolean
}) {
  return (
    <nav className="yubo-tabbar" aria-label="Hoofd">
      {([0, 1, 2, 3, 4] as const).map((t) => (
        <button
          key={t}
          type="button"
          className={
            'yubo-tab' +
            (tab === t ? ' active' : '') +
            ((t === 2 && !hasLikesAccess) || (t === 3 && !hasDiscoverAccess)
              ? ' yubo-tab--paid'
              : '')
          }
          onClick={() => onTab(t)}
          aria-label={TAB_LABEL[t]}
          title={
            t === 2 && !hasLikesAccess
              ? 'Likes+ of Premium'
              : t === 3 && !hasDiscoverAccess
                ? 'Discover+ in Friends of Premium'
                : undefined
          }
          aria-current={tab === t ? 'page' : undefined}
        >
          <TabIcon tab={t} active={tab === t} />
          {TAB_LABEL[t]}
          {t === 2 && !hasLikesAccess ? (
            <span className="yubo-tab__mark" aria-hidden>
              +
            </span>
          ) : null}
          {t === 3 && !hasDiscoverAccess ? (
            <span className="yubo-tab__mark" aria-hidden>
              +
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  )
}

/* ——— Profile ——— */
function ProfileEditScreen({
  onBack,
  swipeDisplayName,
  onSwipeDisplayName,
  myUserId,
  bio,
  onBio,
  role,
  onRole,
  workplace,
  onWorkplace,
  userTags,
  onUserTags,
  photos,
  onPhotos,
}: {
  onBack: () => void
  swipeDisplayName: string
  onSwipeDisplayName: (v: string) => void
  myUserId: string
  bio: string
  onBio: (v: string) => void
  role: string
  onRole: (v: string) => void
  workplace: string
  onWorkplace: (v: string) => void
  userTags: ProfileTag[]
  onUserTags: Dispatch<SetStateAction<ProfileTag[]>>
  photos: string[]
  onPhotos: Dispatch<SetStateAction<string[]>>
}) {
  const [allPhotosOpen, setAllPhotosOpen] = useState(false)
  const [allTagsOpen, setAllTagsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const photoFileRef = useRef<HTMLInputElement>(null)
  const canAddMore = photos.length < MAX_PROFILE_PHOTOS
  const canRemovePhoto = photos.length > 1

  const addPhotosFromFiles = (files: FileList | null) => {
    if (!files?.length) return
    const pool = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!pool.length) return
    const remaining = MAX_PROFILE_PHOTOS - photos.length
    const take = pool.slice(0, remaining)
    if (!take.length) return
    const readers = take.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => {
            if (typeof r.result === 'string') resolve(r.result)
            else reject(new Error('read failed'))
          }
          r.onerror = () => reject(r.error)
          r.readAsDataURL(file)
        }),
    )
    void Promise.all(readers).then((dataUrls) => {
      onPhotos((p) => [...p, ...dataUrls].slice(0, MAX_PROFILE_PHOTOS))
    })
  }

  const removePhotoAt = (i: number) => {
    if (photos.length <= 1) return
    onPhotos((p) => p.filter((_, j) => j !== i))
  }

  const canAddTag = userTags.length < MAX_USER_TAGS
  const canRemoveTag = userTags.length > MIN_USER_TAGS
  const tagsReady = userTags.length >= MIN_USER_TAGS
  const [tagBlockMsg, setTagBlockMsg] = useState('')

  useEffect(() => {
    if (userTags.length >= MIN_USER_TAGS) setTagBlockMsg('')
  }, [userTags.length])

  const addUserTag = () => {
    const raw = tagDraft.trim()
    if (!raw || !canAddTag) return
    const t = raw.length > 24 ? raw.slice(0, 24) : raw
    if (userTags.some((x) => x.t.toLowerCase() === t.toLowerCase())) return
    onUserTags((p) => [
      ...p,
      {
        id: randomId(),
        t,
        c: TAG_COLOR_PALETTE[p.length % TAG_COLOR_PALETTE.length]!,
      },
    ])
    setTagDraft('')
  }

  const removeUserTag = (id: string) => {
    if (userTags.length <= MIN_USER_TAGS) return
    onUserTags((p) => p.filter((x) => x.id !== id))
  }

  const goBack = () => {
    if (!tagsReady) {
      setTagBlockMsg(`Voeg nog ${MIN_USER_TAGS - userTags.length} tag(s) toe (minimaal ${MIN_USER_TAGS} verplicht).`)
      return
    }
    onBack()
  }

  const openPreview = () => {
    if (!tagsReady) {
      setTagBlockMsg(`Eerst ${MIN_USER_TAGS} tags invullen, dan is je kaart klaar voor de preview.`)
      return
    }
    setPreviewOpen(true)
  }

  const previewAsSwipe: SwipeProfile = useMemo(
    () => ({
      id: 'self-preview',
      name: (swipeDisplayName || 'Jij').trim() || 'Jij',
      age: 21,
      city: 'Online',
      username: `${slugName(swipeDisplayName || 'gast')}._${myUserId.slice(2, 6)}`,
      mainPhoto: photos[0] ?? DEFAULT_PROFILE_PHOTOS[0]!,
      extraPhotos: photos.length > 1 ? photos.slice(1) : [],
      tags: userTags.map((x) => ({ t: x.t, c: x.c })),
      bio: (bio || '').trim() || 'Nog geen bio. Vertel iets over jezelf.',
      profession: (role || '').trim() || 'Nog geen functie',
      company: (workplace || '').trim() || 'Nog geen bedrijf',
    }),
    [swipeDisplayName, myUserId, photos, userTags, bio, role, workplace],
  )

  useEffect(() => {
    if (!allPhotosOpen && !allTagsOpen && !previewOpen) return
    const onK = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (previewOpen) {
        setPreviewOpen(false)
        return
      }
      setAllPhotosOpen(false)
      setAllTagsOpen(false)
    }
    window.addEventListener('keydown', onK)
    return () => window.removeEventListener('keydown', onK)
  }, [allPhotosOpen, allTagsOpen, previewOpen])

  return (
    <div className="yubo-screen-chat yubo-profile-editor">
      <input
        ref={photoFileRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          addPhotosFromFiles(e.target.files)
          e.target.value = ''
        }}
        tabIndex={-1}
        aria-hidden
      />
      <h1 className="visually-hidden">
        Your profile
        {isItemOwned('crown_badge') ? ' — winkel: kroon' : ''}
      </h1>
      <header className="yubo-top yubo-top--sheet compact" aria-label="Navigatie">
        <button
          className="yubo-back yubo-back--chevron"
          type="button"
          onClick={goBack}
          aria-label="Back"
        >
          ‹
        </button>
        <span className="yubo-top--sheet__fill" aria-hidden />
        <button
          type="button"
          className="yubo-preview"
          onClick={openPreview}
          aria-label="Voorbeeld: zo zie je profiel in Swipes"
          title={tagsReady ? undefined : 'Minimaal 3 tags verplicht'}
        >
          <span aria-hidden>◉</span> Preview
        </button>
      </header>
      <p className="yubo-profile-pool-hint" role="note">
        Je <strong>profiel</strong> (foto’s, tags, bio) verschijnt in <strong>Swipes</strong> voor
        alle <strong>andere</strong> ingelogde accounts op deze site — niet voor jezelf.
      </p>

      <div className="yubo-main yubo-main--profile-photos with-tabbar" style={{ paddingTop: 0 }}>
        <section className="yubo-section" aria-label="Weergavenaam">
          <h2 className="yubo-h2 yubo-h2--page" style={{ marginBottom: 6 }}>
            Naam op je kaart
          </h2>
          <p
            className="onboard-mute"
            style={{
              margin: '0 0 0.5rem',
              fontSize: '0.75rem',
              lineHeight: 1.4,
            }}
          >
            Zo toont Swipey je in de stack, inclusief de @-regel. Staat in dit account (niet de oude
            knop-tekst van vóór je login).
          </p>
          <label className="visually-hidden" htmlFor="yb-swipe-name">
            Weergavenaam
          </label>
          <input
            id="yb-swipe-name"
            className="yubo-field"
            value={swipeDisplayName}
            onChange={(e) => onSwipeDisplayName(e.target.value.slice(0, 32))}
            maxLength={32}
            autoComplete="nickname"
            placeholder="Bijv. f of je bijnaam"
            style={{ minHeight: 2.75 }}
          />
        </section>
        <section className="yubo-section" aria-label="Your photos">
          <div className="yubo-section-head">
            <h2 className="yubo-h2 yubo-h2--page">
              <span>
                Your photos ({photos.length} of {MAX_PROFILE_PHOTOS})
                {isItemOwned('crown_badge') ? (
                  <span className="yubo-shop-crown" title="Winkel: kroon" aria-hidden>
                    {' '}
                    👑
                  </span>
                ) : null}
              </span>
            </h2>
            <button
              type="button"
              className="yubo-link"
              onClick={() => setAllPhotosOpen(true)}
            >
              See all
            </button>
          </div>
          <div className="yubo-photo-row" role="list">
            {canAddMore && (
              <button
                type="button"
                className="yubo-add-photo"
                aria-label="Add photo (up to 5 total)"
                onClick={() => photoFileRef.current?.click()}
              >
                +
              </button>
            )}
            {photos.map((src, i) => (
              <div
                className="yubo-photo-tile"
                key={`p-${i}-${src.slice(0, 32)}`}
                role="listitem"
              >
                <img
                  className="yubo-photo"
                  alt=""
                  src={src}
                />
                <button
                  type="button"
                  className="yubo-photo-del"
                  onClick={() => removePhotoAt(i)}
                  disabled={!canRemovePhoto}
                  title={
                    canRemovePhoto
                      ? 'Verwijderen'
                      : 'Minstens één foto houden'
                  }
                  aria-label="Foto verwijderen"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="yubo-section" aria-label="Tags">
          <div className="yubo-section-head">
            <h2 className="yubo-h2">Tags (min. {MIN_USER_TAGS})</h2>
            <button
              type="button"
              className="yubo-link"
              onClick={() => setAllTagsOpen(true)}
            >
              See all
            </button>
          </div>
          {tagBlockMsg ? (
            <p className="yubo-tag-err" role="alert">
              {tagBlockMsg}
            </p>
          ) : null}
          {userTags.length < MIN_USER_TAGS && (
            <p className="yubo-tag-hint">
              Minimaal {MIN_USER_TAGS} tags verplicht — nu {userTags.length}/
              {MIN_USER_TAGS}. Typ een tag en druk + (max. {MAX_USER_TAGS} in totaal).
            </p>
          )}
          {userTags.length >= MIN_USER_TAGS && userTags.length < 4 && (
            <p className="yubo-tag-hint yubo-tag-hint--ok">
              Je voldoet aan het minimum. Je kunt eventueel meer tags toevoegen.
            </p>
          )}
          <div className="yubo-tags" role="list">
            {userTags.map((x) => (
              <div
                key={x.id}
                className="yubo-tag yubo-tag--editable"
                style={{ background: x.c }}
                role="listitem"
              >
                <span className="yubo-tag__text">{x.t}</span>
                <button
                  type="button"
                  className="yubo-tag__remove"
                  onClick={() => removeUserTag(x.id)}
                  disabled={!canRemoveTag}
                  title={canRemoveTag ? 'Tag verwijderen' : `Minstens ${MIN_USER_TAGS} tags houden`}
                  aria-label={`Tag ${x.t} verwijderen`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="yubo-tag-add">
            <label className="visually-hidden" htmlFor="yubo-new-tag">
              Nieuwe tag
            </label>
            <input
              id="yubo-new-tag"
              className="yubo-field yubo-field--tag"
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  addUserTag()
                }
              }}
              maxLength={24}
              placeholder="Tag toevoegen…"
              disabled={!canAddTag}
            />
            <button
              type="button"
              className="yubo-tag-add__btn"
              onClick={addUserTag}
              disabled={!tagDraft.trim() || !canAddTag}
              aria-label="Tag toevoegen"
            >
              +
            </button>
          </div>
        </section>

        <section className="yubo-section" aria-label="Bio">
          <h2 className="yubo-h2" style={{ marginBottom: 8 }}>
            Bio <span className="yubo-badge">+20%</span>
          </h2>
          <label className="visually-hidden" htmlFor="yb-bio">
            Bio
          </label>
          <textarea
            id="yb-bio"
            className="yubo-field"
            value={bio}
            onChange={(e) => onBio(e.target.value)}
            rows={3}
            placeholder="Say something about you"
          />
        </section>

        <section className="yubo-section" aria-label="Profession">
          <h2 className="yubo-h2" style={{ marginBottom: 8 }}>
            Profession <span className="yubo-badge">+20%</span>
          </h2>
          <label className="visually-hidden" htmlFor="yb-role">
            Job title
          </label>
          <input
            id="yb-role"
            className="yubo-field"
            value={role}
            onChange={(e) => onRole(e.target.value)}
            style={{ marginBottom: 8 }}
            placeholder="Title"
          />
          <label className="visually-hidden" htmlFor="yb-wp">
            Company or studio
          </label>
          <input
            id="yb-wp"
            className="yubo-field"
            value={workplace}
            onChange={(e) => onWorkplace(e.target.value)}
            placeholder="Workplace"
          />
        </section>
      </div>

      {allPhotosOpen && (
        <div
          className="yubo-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yubo-all-photos-title"
          onClick={() => setAllPhotosOpen(false)}
        >
          <div
            className="yubo-profile-modal__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="yubo-profile-modal__head">
              <h2 id="yubo-all-photos-title" className="yubo-profile-modal__title">
                All photos
              </h2>
              <button
                type="button"
                className="yubo-profile-modal__close"
                onClick={() => setAllPhotosOpen(false)}
                aria-label="Sluiten"
              >
                ×
              </button>
            </div>
            <div className="yubo-profile-modal__grid" role="list">
              {photos.map((src, i) => (
                <div
                  className="yubo-profile-modal__tile"
                  key={`m-${i}-${src.slice(0, 32)}`}
                  role="listitem"
                >
                  <img
                    className="yubo-profile-modal__img"
                    src={src}
                    alt=""
                  />
                  <button
                    type="button"
                    className="yubo-photo-del yubo-photo-del--lg"
                    onClick={() => removePhotoAt(i)}
                    disabled={!canRemovePhoto}
                    title={
                      canRemovePhoto
                        ? 'Verwijderen'
                        : 'Minstens één foto houden'
                    }
                    aria-label="Foto verwijderen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {canAddMore && (
              <div className="yubo-profile-modal__footer">
                <button
                  type="button"
                  className="btn primary"
                  style={{ width: '100%' }}
                  onClick={() => photoFileRef.current?.click()}
                >
                  Foto toevoegen
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {allTagsOpen && (
        <div
          className="yubo-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yubo-all-tags-title"
          onClick={() => setAllTagsOpen(false)}
        >
          <div
            className="yubo-profile-modal__panel yubo-profile-modal__panel--tags"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="yubo-profile-modal__head">
              <h2 id="yubo-all-tags-title" className="yubo-profile-modal__title">
                All tags
              </h2>
              <button
                type="button"
                className="yubo-profile-modal__close"
                onClick={() => setAllTagsOpen(false)}
                aria-label="Sluiten"
              >
                ×
              </button>
            </div>
            <ul className="yubo-profile-modal__taglist">
              {userTags.map((x) => (
                <li key={x.id} className="yubo-profile-modal__tagrow">
                  <div
                    className="yubo-tag yubo-tag--editable"
                    style={{ background: x.c }}
                  >
                    <span className="yubo-tag__text">{x.t}</span>
                    <button
                      type="button"
                      className="yubo-tag__remove"
                      onClick={() => removeUserTag(x.id)}
                      disabled={!canRemoveTag}
                      title={canRemoveTag ? 'Tag verwijderen' : `Minstens ${MIN_USER_TAGS} tags houden`}
                      aria-label={`Tag ${x.t} verwijderen`}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="yubo-profile-modal__footer yubo-profile-modal__footer--tags">
              <div className="yubo-tag-add" style={{ margin: 0 }}>
                <input
                  className="yubo-field yubo-field--tag"
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      addUserTag()
                    }
                  }}
                  maxLength={24}
                  placeholder="Tag toevoegen…"
                  disabled={!canAddTag}
                  aria-label="Nieuwe tag"
                />
                <button
                  type="button"
                  className="yubo-tag-add__btn"
                  onClick={addUserTag}
                  disabled={!tagDraft.trim() || !canAddTag}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div
          className="yubo-profile-preview"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yubo-preview-title"
        >
          <header
            className="yubo-top compact"
            style={{ flexShrink: 0, background: '#f5f0e9' }}
          >
            <button
              type="button"
              className="yubo-back"
              onClick={() => setPreviewOpen(false)}
              aria-label="Terug naar bewerken"
            >
              ‹
            </button>
            <h1 id="yubo-preview-title" className="yubo-title" style={{ fontSize: '0.92rem' }}>
              Jouw Swipe-kaart
            </h1>
            <span style={{ width: 40 }} aria-hidden />
          </header>
          <div className="yubo-profile-preview__body with-tabbar">
            <p className="yubo-profile-preview__hint">
              Zo zien anderen je in <strong>Swipes</strong>.
            </p>
            <div className="yubo-profile-preview__card">
              <div className="swipe-card">
                <SwipeProfileCard
                  p={previewAsSwipe}
                  showExtra
                  layout="full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ——— Chat (lokaal + BroadcastChannel, geen AI) ——— */
const MAX_IMAGE_FILE_BYTES = 800_000
const MAX_IMAGE_DATAURL_CHARS = 2_000_000
const MAX_AUDIO_DATAURL_CHARS = 2_000_000
const MAX_VOICE_RECORD_MS = 90_000

type GiphyImg = { url: string; label: string }

/** Zonder API-key: uitsluitend Giphy-URL’s (catalogus in `../lib/chatGifPresets.ts`). */
const GIPHY_FALLBACK: GiphyImg[] = CHAT_GIF_PRESETS.map(({ url, label }) => ({ url, label }))

function GifPickerThumb({
  g,
  onPick,
}: {
  g: GiphyImg
  onPick: (x: GiphyImg) => void
}) {
  const sources = useMemo(() => giphyImgFallbackSources(g.url), [g.url])
  const [ix, setIx] = useState(0)
  const [dead, setDead] = useState(false)
  const src =
    !dead && sources.length > 0
      ? (sources[Math.min(ix, sources.length - 1)] ?? null)
      : null

  return (
    <button
      type="button"
      className="yubo-gif-modal__cell"
      onClick={() => onPick(g)}
      title={g.label}
      role="listitem"
    >
      {dead || !src ? (
        <div className="yubo-gif-modal__placeholder" aria-hidden>
          {g.label}
        </div>
      ) : (
        <img
          className="yubo-gif-modal__thumb"
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => {
            if (ix < sources.length - 1) {
              setIx((n) => n + 1)
            } else {
              setDead(true)
            }
          }}
        />
      )}
    </button>
  )
}

function ChatGiphyImg({
  url,
  className,
  alt,
}: {
  url: string
  className: string
  alt: string
}) {
  const sources = useMemo(() => giphyImgFallbackSources(url), [url])
  const [ix, setIx] = useState(0)
  const [dead, setDead] = useState(false)
  const src =
    !dead && sources.length > 0
      ? (sources[Math.min(ix, sources.length - 1)] ?? null)
      : null
  if (dead || !src) {
    return <span className="chat-bubble__gif-fallback">🎬 {alt}</span>
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (ix < sources.length - 1) {
          setIx((n) => n + 1)
        } else {
          setDead(true)
        }
      }}
    />
  )
}

function isIOSOrIPad(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      (navigator.maxTouchPoints ?? 0) > 1)
  )
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return undefined
  }
  const preferApple = isIOSOrIPad()
  const order = preferApple
    ? [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'video/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ]
    : [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'video/mp4',
      ]
  for (const t of order) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}
async function fetchGiphyGifs(q: string | undefined, apiKey: string): Promise<GiphyImg[]> {
  const u = new URL(
    !q?.trim() ? 'https://api.giphy.com/v1/gifs/trending' : 'https://api.giphy.com/v1/gifs/search',
  )
  u.searchParams.set('api_key', apiKey)
  u.searchParams.set('limit', '30')
  u.searchParams.set('rating', 'g')
  u.searchParams.set('lang', 'nl')
  if (q?.trim()) u.searchParams.set('q', q.trim())
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error('giphy')
  const j = (await r.json()) as {
    data?: Array<{
      images?: {
        fixed_width?: { url?: string }
        fixed_width_still?: { url?: string }
        downsized?: { url?: string }
      }
      title?: string
    }>
  }
  return (j.data ?? [])
    .map((d) => {
      let g =
        d.images?.fixed_width?.url ||
        d.images?.downsized?.url ||
        d.images?.fixed_width_still?.url ||
        ''
      if (g.startsWith('//')) g = `https:${g}`
      if (g.startsWith('http://')) g = `https://${g.slice('http://'.length)}`
      return {
        url: g,
        label: (d.title || 'GIF').replace(/\s+/g, ' ').trim() || 'GIF',
      }
    })
    .filter((x) => x.url.startsWith('https://'))
}

/** Spraak in chat: yubo-achtige balkjes + afspeelknop; iOS kan `data:video/mp4` geven. */
function ChatVoicePlayer({ dataUrl, mine }: { dataUrl: string; mine: boolean }) {
  const useVideo = dataUrl.startsWith('data:video/')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const m = (useVideo ? videoRef.current : audioRef.current) as HTMLMediaElement | null
    if (!m) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnd = () => setPlaying(false)
    m.addEventListener('play', onPlay)
    m.addEventListener('pause', onPause)
    m.addEventListener('ended', onEnd)
    return () => {
      m.removeEventListener('play', onPlay)
      m.removeEventListener('pause', onPause)
      m.removeEventListener('ended', onEnd)
    }
  }, [dataUrl, useVideo])

  const toggle = useCallback(() => {
    const m = (useVideo ? videoRef.current : audioRef.current) as HTMLMediaElement | null
    if (!m) return
    if (m.paused) {
      void m.play().catch(() => {
        /* o.a. iOS: tweede play na user gesture */
      })
    } else {
      m.pause()
    }
  }, [useVideo])

  return (
    <div
      className={'chat-voice' + (mine ? ' chat-voice--mine' : ' chat-voice--theirs')}
      role="group"
      aria-label="Spraakbericht"
    >
      <button
        type="button"
        className="chat-voice__play"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Pauzeren' : 'Afspelen'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="chat-voice__bars" aria-hidden>
        {[0.4, 0.75, 0.55, 0.9].map((h, i) => (
          <span
            key={i}
            className={'chat-voice__bar' + (playing ? ' chat-voice__bar--pulse' : '')}
            style={{ height: `${h}rem` }}
          />
        ))}
      </div>
      {useVideo ? (
        <video
          ref={videoRef}
          className="chat-voice__media"
          src={dataUrl}
          playsInline
          preload="auto"
        />
      ) : (
        <audio
          ref={audioRef}
          className="chat-voice__media"
          src={dataUrl}
          preload="auto"
        />
      )}
    </div>
  )
}

/** Zelfde balkjes als live spraak; geen media (verloren / oude sync). */
function ChatVoicePlaceholder({ mine }: { mine: boolean }) {
  return (
    <div
      className={
        'chat-voice chat-voice--unavailable' +
        (mine ? ' chat-voice--mine' : ' chat-voice--theirs')
      }
      role="img"
      aria-label="Spraakbericht (niet meer afspeelbaar in deze sessie)"
    >
      <span className="chat-voice__play chat-voice__play--off" aria-hidden>
        ▶
      </span>
      <div className="chat-voice__bars" aria-hidden>
        {[0.4, 0.75, 0.55, 0.9].map((h, i) => (
          <span
            key={i}
            className="chat-voice__bar"
            style={{ height: `${h}rem` }}
          />
        ))}
      </div>
    </div>
  )
}

type ChatLine =
  | { id: string; from: 'them' | 'me'; kind: 'text'; text: string }
  | { id: string; from: 'them' | 'me'; kind: 'image'; dataUrl: string; name: string }
  | { id: string; from: 'them' | 'me'; kind: 'gif'; url: string; label: string }
  | { id: string; from: 'them' | 'me'; kind: 'audio'; dataUrl: string }
  /** Oude/sync zonder data-URL: zelfde look, geen afspeelbaar bestand. */
  | { id: string; from: 'them' | 'me'; kind: 'audio_unavailable' }

function sharedToViewLines(msgs: SwChatMsg[] | undefined, myId: string): ChatLine[] {
  if (!msgs?.length) return []
  return [...msgs]
    .sort((a, b) => a.ts - b.ts)
    .map((m) => {
      const from = m.fromUser === myId ? 'me' : 'them'
      if (m.imageDataUrl) {
        return {
          id: m.id,
          from,
          kind: 'image' as const,
          dataUrl: m.imageDataUrl,
          name: (m.imageName || m.text || 'Foto').replace(/\s+/g, ' ').trim(),
        }
      }
      if (m.gifUrl) {
        return {
          id: m.id,
          from,
          kind: 'gif' as const,
          url: m.gifUrl,
          label: (m.gifLabel || m.text || 'GIF').replace(/\s+/g, ' ').trim() || 'GIF',
        }
      }
      if (m.audioDataUrl) {
        return {
          id: m.id,
          from,
          kind: 'audio' as const,
          dataUrl: m.audioDataUrl,
        }
      }
      const tPlain = (m.text || '').trim()
      if (
        !m.imageDataUrl &&
        !m.gifUrl &&
        tPlain.length > 0 &&
        tPlain.length < 100 &&
        (tPlain === '🎤 Spraakbericht' ||
          /\[spraakbericht|🎤|spraakbericht.*\btest\b/i.test(tPlain))
      ) {
        return { id: m.id, from, kind: 'audio_unavailable' as const }
      }
      return {
        id: m.id,
        from,
        kind: 'text' as const,
        text: m.text,
      }
    })
}

function inboxPreviewMsgs(msgs: SwChatMsg[] | undefined, peerName: string, myId: string): string {
  if (!msgs?.length) return 'Nog leeg, tik om te starten'
  const s = [...msgs].sort((a, b) => a.ts - b.ts)
  const last = s[s.length - 1]
  if (!last) return 'Nog leeg'
  if (last.imageDataUrl) {
    if (last.fromUser === myId) return 'Jij 📷 Foto'
    return `${peerName} 📷 Foto`
  }
  if (last.gifUrl) {
    if (last.fromUser === myId) return 'Jij 🎬 GIF'
    return `${peerName} 🎬 GIF`
  }
  if (last.audioDataUrl) {
    if (last.fromUser === myId) return 'Jij 🎤 Spraak'
    return `${peerName} 🎤 Spraak`
  }
  if (last.fromUser === myId) return `Jij ${last.text}`
  return `${peerName} ${last.text}`
}

function ChatThreadBody({ lines, peer }: { lines: ChatLine[]; peer: SwipeProfile }): ReactNode {
  const photo = peer.mainPhoto
  const nodes: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.from === 'them' && l.kind === 'text') {
      nodes.push(
        <div key={l.id} className="chat-row theirs" role="article">
          <img className="chat-av" src={photo} alt="" width={28} height={28} />
          <div className="bubble theirs">{l.text}</div>
        </div>,
      )
      i++
      continue
    }
    if (l.from === 'them' && l.kind === 'image') {
      nodes.push(
        <div key={l.id} className="chat-row theirs" role="article">
          <img className="chat-av" src={photo} alt="" width={28} height={28} />
          <div className="bubble theirs chat-bubble--image">
            <img
              className="chat-bubble__img"
              src={l.dataUrl}
              alt={l.name}
              loading="lazy"
            />
          </div>
        </div>,
      )
      i++
      continue
    }
    if (l.from === 'them' && l.kind === 'gif') {
      nodes.push(
        <div key={l.id} className="chat-row theirs" role="article">
          <img className="chat-av" src={photo} alt="" width={28} height={28} />
          <div className="bubble theirs chat-bubble--image chat-bubble--gif">
            <ChatGiphyImg
              className="chat-bubble__img"
              url={l.url}
              alt={l.label}
            />
          </div>
        </div>,
      )
      i++
      continue
    }
    if (l.from === 'them' && l.kind === 'audio') {
      nodes.push(
        <div key={l.id} className="chat-row theirs" role="article">
          <img className="chat-av" src={photo} alt="" width={28} height={28} />
          <div className="bubble theirs chat-bubble--audio">
            <ChatVoicePlayer dataUrl={l.dataUrl} mine={false} />
          </div>
        </div>,
      )
      i++
      continue
    }
    if (l.from === 'them' && l.kind === 'audio_unavailable') {
      nodes.push(
        <div key={l.id} className="chat-row theirs" role="article">
          <img className="chat-av" src={photo} alt="" width={28} height={28} />
          <div className="bubble theirs chat-bubble--audio">
            <ChatVoicePlaceholder mine={false} />
          </div>
        </div>,
      )
      i++
      continue
    }
    if (l.from === 'me' && l.kind === 'text') {
      const run: Array<Extract<ChatLine, { kind: 'text' }>> = []
      while (i < lines.length && lines[i].from === 'me' && lines[i].kind === 'text') {
        run.push(lines[i] as Extract<ChatLine, { kind: 'text' }>)
        i++
      }
      if (run.length === 0) {
        i += 1
        continue
      }
      const first = run[0]
      nodes.push(
        <div
          key={first.id}
          className="chat-mine-stack"
          role="group"
          aria-label="Jij"
          style={{ alignSelf: 'flex-end' }}
        >
          {run.map((r) => (
            <div key={r.id} className="bubble mine">
              {r.text}
            </div>
          ))}
        </div>,
      )
      continue
    }
    if (l.from === 'me' && l.kind === 'image') {
      nodes.push(
        <div
          key={l.id}
          className="chat-mine-stack"
          role="group"
          aria-label="Jij"
          style={{ alignSelf: 'flex-end' }}
        >
          <div className="bubble mine chat-bubble--image">
            <img
              className="chat-bubble__img"
              src={l.dataUrl}
              alt={l.name}
              loading="lazy"
            />
          </div>
        </div>,
      )
      i++
      continue
    }
    if (l.from === 'me' && l.kind === 'gif') {
      nodes.push(
        <div
          key={l.id}
          className="chat-mine-stack"
          role="group"
          aria-label="Jij"
          style={{ alignSelf: 'flex-end' }}
        >
          <div className="bubble mine chat-bubble--image chat-bubble--gif">
            <ChatGiphyImg
              className="chat-bubble__img"
              url={l.url}
              alt={l.label}
            />
          </div>
        </div>,
      )
      i++
      continue
    }
    if (l.from === 'me' && l.kind === 'audio') {
      nodes.push(
        <div
          key={l.id}
          className="chat-mine-stack"
          role="group"
          aria-label="Jij"
          style={{ alignSelf: 'flex-end' }}
        >
          <div className="bubble mine chat-bubble--audio">
            <ChatVoicePlayer dataUrl={l.dataUrl} mine />
          </div>
        </div>,
      )
      i++
      continue
    }
    if (l.from === 'me' && l.kind === 'audio_unavailable') {
      nodes.push(
        <div
          key={l.id}
          className="chat-mine-stack"
          role="group"
          aria-label="Jij"
          style={{ alignSelf: 'flex-end' }}
        >
          <div className="bubble mine chat-bubble--audio">
            <ChatVoicePlaceholder mine />
          </div>
        </div>,
      )
      i++
      continue
    }
    i += 1
  }
  return <>{nodes}</>
}

function ChatPanel({
  matches,
  liveProfiles,
  onOpenSwipes,
  openThreadId: openId,
  onOpenThreadId: setOpenId,
}: {
  matches: SwipeProfile[]
  liveProfiles: SwipeProfile[]
  onOpenSwipes: () => void
  openThreadId: string | null
  onOpenThreadId: (id: string | null) => void
}) {
  const myUserId = useMemo(() => getOrCreateUserId(), [])
  const [draft, setDraft] = useState('')
  const [rawByPeer, setRawByPeer] = useState<Record<string, SwChatMsg[]>>({})
  const [otherOnline, setOtherOnline] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [fav, setFav] = useState(false)
  /** Triggert opnieuw sorteren van de chat-inbox na favoriet in header */
  const [favInboxKey, setFavInboxKey] = useState(0)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportThanks, setReportThanks] = useState(false)
  const [reportReason, setReportReason] = useState('ongepast')
  const [reportNote, setReportNote] = useState('')
  const [photoErr, setPhotoErr] = useState('')
  const [gifOpen, setGifOpen] = useState(false)
  const [gifQ, setGifQ] = useState('')
  const [gifItems, setGifItems] = useState<GiphyImg[]>(GIPHY_FALLBACK)
  const [gifLoad, setGifLoad] = useState(false)
  const [recActive, setRecActive] = useState(false)
  const giphyKey = useMemo(
    () => (import.meta.env.VITE_GIPHY_API_KEY || '').trim(),
    [],
  )
  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recEndTimerRef = useRef<number | null>(null)
  const gifQTimerRef = useRef<number | null>(null)
  const canSendVoiceRef = useRef(true)
  const bcRef = useRef<BroadcastChannel | null>(null)
  const otherUntilRef = useRef(0)
  const typingUntilRef = useRef(0)
  const openIdRef = useRef<string | null>(null)
  openIdRef.current = openId

  const peer = openId
    ? matches.find((m) => m.id === openId && !isUserBanned(m.liveUserId ?? m.id)) ?? null
    : null
  const liveByUserId = useMemo(() => {
    const m = new Map<string, SwipeProfile>()
    for (const p of liveProfiles) {
      if (p.liveUserId && p.isStreaming) m.set(p.liveUserId, p)
    }
    return m
  }, [liveProfiles])
  const livePeer = peer?.liveUserId ? liveByUserId.get(peer.liveUserId) ?? null : null

  const lines = useMemo(
    () => (peer ? sharedToViewLines(rawByPeer[peer.id], myUserId) : []),
    [peer, rawByPeer, myUserId],
  )

  useEffect(() => {
    if (!openId) {
      setFav(false)
      return
    }
    setFav(isMatchFavorite(openId))
  }, [openId])

  useEffect(() => {
    setRawByPeer((prev) => {
      let c = false
      const n = { ...prev }
      for (const m of matches) {
        if (n[m.id] === undefined) {
          n[m.id] = readThread(m.id)
          c = true
        }
      }
      return c ? n : prev
    })
  }, [matches])

  useLayoutEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const bc = new BroadcastChannel(BROADCAST)
    bcRef.current = bc
    const onMsg = (e: MessageEvent) => {
      const d = e.data as BCEnvelope
      if (!d || d.v !== 1) return
      if (d.t === 'msg' && d.msg) {
        setRawByPeer((p) => {
          const cur = p[d.matchId] ?? []
          if (cur.some((x) => x.id === d.msg.id)) return p
          const n = appendMessageDedupe(cur, d.msg)
          writeThread(d.matchId, n)
          return { ...p, [d.matchId]: n }
        })
      }
      if (d.t === 'pr' && d.userId !== myUserId && d.matchId === openIdRef.current) {
        otherUntilRef.current = Date.now() + 8000
        setOtherOnline(true)
      }
      if (d.t === 'typing' && d.userId !== myUserId && d.matchId === openIdRef.current) {
        typingUntilRef.current = d.typing ? Date.now() + 3500 : 0
        setOtherTyping(d.typing)
        if (d.typing) {
          otherUntilRef.current = Date.now() + 8000
          setOtherOnline(true)
        }
      }
    }
    bc.addEventListener('message', onMsg)
    return () => {
      bc.removeEventListener('message', onMsg)
      bc.close()
      bcRef.current = null
    }
  }, [myUserId])

  const chatBodyRef = useRef<HTMLDivElement>(null)
  const photoPickRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (!openId) return
    const el = chatBodyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
  }, [openId, lines])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith(THREAD_KEY_PREFIX) || e.newValue == null) return
      const matchId = e.key.slice(THREAD_KEY_PREFIX.length)
      try {
        const list = JSON.parse(e.newValue) as SwChatMsg[]
        if (!Array.isArray(list)) return
        setRawByPeer((p) => ({ ...p, [matchId]: list }))
      } catch {
        /* */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || !openId) return
    const bc = bcRef.current
    if (!bc) return
    const t = setInterval(() => {
      const b = bcRef.current
      if (b) {
        postChat(b, {
          v: 1,
          t: 'pr',
          matchId: openId,
          userId: myUserId,
          at: Date.now(),
        })
      }
    }, 2500)
    return () => clearInterval(t)
  }, [openId, myUserId])

  useEffect(() => {
    if (!openId) {
      setOtherOnline(false)
      return
    }
    const tick = setInterval(() => {
      if (Date.now() > otherUntilRef.current) {
        setOtherOnline(false)
      }
      if (Date.now() > typingUntilRef.current) {
        setOtherTyping(false)
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [openId])

  useEffect(() => {
    if (!openId) {
      setOtherTyping(false)
      return
    }
    const b = bcRef.current
    if (!b) return
    postChat(b, {
      v: 1,
      t: 'typing',
      matchId: openId,
      userId: myUserId,
      at: Date.now(),
      typing: draft.trim().length > 0,
    })
  }, [draft, openId, myUserId])

  const closeThread = useCallback(() => {
    setOpenId(null)
    setDraft('')
    setReportOpen(false)
    setPhotoErr('')
    setGifOpen(false)
    setGifQ('')
    canSendVoiceRef.current = false
    if (recRef.current) {
      const mr = recRef.current
      mr.onstop = null
      if (mr.state === 'recording') {
        try {
          mr.stop()
        } catch {
          /* */
        }
      }
      recRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (recEndTimerRef.current) {
      window.clearTimeout(recEndTimerRef.current)
      recEndTimerRef.current = null
    }
    setRecActive(false)
    canSendVoiceRef.current = true
  }, [])

  const onToggleFav = useCallback(() => {
    if (!openId) return
    setFav(toggleMatchFavorite(openId))
    setFavInboxKey((k) => k + 1)
  }, [openId])

  const submitReport = useCallback(() => {
    if (!openId || !peer) return
    saveAdminReport({
      reporterUserId: myUserId,
      reportedUserId: peer.liveUserId ?? peer.id,
      reportedName: peer.name,
      reason: reportReason,
      note: reportNote.trim(),
    })
    setReportOpen(false)
    setReportNote('')
    setReportThanks(true)
    window.setTimeout(() => setReportThanks(false), 4000)
  }, [openId, peer, myUserId, reportReason, reportNote])

  useEffect(() => {
    if (!reportOpen) return
    const onK = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReportOpen(false)
    }
    window.addEventListener('keydown', onK)
    return () => window.removeEventListener('keydown', onK)
  }, [reportOpen])

  useEffect(() => {
    if (!photoErr) return
    const t = window.setTimeout(() => setPhotoErr(''), 5000)
    return () => window.clearTimeout(t)
  }, [photoErr])

  const postOutgoing = useCallback(
    (body: Omit<SwChatMsg, 'id' | 'ts' | 'fromUser'>) => {
      if (!openId) return
      if (!matches.some((m) => m.id === openId)) return
      const peerId = openId
      const msg: SwChatMsg = {
        id: randomId(),
        fromUser: myUserId,
        ts: Date.now(),
        ...body,
      }
      setRawByPeer((prev) => {
        const cur = prev[peerId] ?? []
        const n = appendMessageDedupe(cur, msg)
        writeThread(peerId, n)
        return { ...prev, [peerId]: n }
      })
      const b = bcRef.current
      if (b) {
        postChat(b, { v: 1, t: 'msg', matchId: peerId, userId: myUserId, msg })
      }
    },
    [openId, matches, myUserId],
  )

  const sendText = useCallback(
    (raw: string) => {
      const t = raw.trim()
      if (!t) return
      postOutgoing({ text: t.slice(0, 500) })
    },
    [postOutgoing],
  )

  const send = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    sendText(t)
    setDraft('')
  }, [draft, sendText])

  const onPhotoPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setPhotoErr('Kies een afbeeldingsbestand.')
      return
    }
    if (!openId) return
    if (!matches.some((m) => m.id === openId)) return
    if (f.size > MAX_IMAGE_FILE_BYTES) {
      setPhotoErr('Deze foto is te groot. Maximaal ongeveer 800 KB.')
      return
    }
    const r = new FileReader()
    r.onload = () => {
      const dataUrl = r.result
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        setPhotoErr('Foto kon niet ingelezen worden.')
        return
      }
      if (dataUrl.length > MAX_IMAGE_DATAURL_CHARS) {
        setPhotoErr('Foto is te groot om te bewaren. Probeer een kleinere of scherpere jpg/webp.')
        return
      }
      const name = f.name || 'Foto'
      const caption = `📷 ${name}`.slice(0, 500)
      postOutgoing({ text: caption, imageDataUrl: dataUrl, imageName: name })
    }
    r.onerror = () => setPhotoErr('Foto kon niet ingelezen worden.')
    r.readAsDataURL(f)
  }

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (recEndTimerRef.current) {
      window.clearTimeout(recEndTimerRef.current)
      recEndTimerRef.current = null
    }
  }, [])

  const cancelVoiceIfNeeded = useCallback(() => {
    if (!recRef.current) return
    if (recRef.current.state !== 'recording') {
      recRef.current = null
      return
    }
    canSendVoiceRef.current = false
    const mr = recRef.current
    mr.onstop = null
    try {
      mr.stop()
    } catch {
      /* */
    }
    recRef.current = null
    stopStream()
    setRecActive(false)
    canSendVoiceRef.current = true
  }, [stopStream])

  useEffect(() => {
    cancelVoiceIfNeeded()
  }, [openId, cancelVoiceIfNeeded])

  const sendChosenGif = useCallback(
    (g: GiphyImg) => {
      const label = g.label.slice(0, 200)
      postOutgoing({ text: label, gifUrl: g.url, gifLabel: label })
      setGifOpen(false)
      setGifQ('')
    },
    [postOutgoing],
  )

  const onMicClick = useCallback(() => {
    if (recRef.current && recRef.current.state === 'recording') {
      recRef.current.stop()
      return
    }
    if (!openId) return
    if (!matches.some((m) => m.id === openId)) return
    setPhotoErr('')
    canSendVoiceRef.current = true
    if (recRef.current && recRef.current.state === 'inactive') {
      recRef.current = null
    }
    stopStream()
    void (async () => {
      try {
        if (typeof MediaRecorder === 'undefined') {
          setRecActive(false)
          setPhotoErr('Deze browser heeft geen spraakopname (MediaRecorder). Gebruik Chrome, Safari of Firefox.')
          return
        }
        const st = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        if (!openIdRef.current) {
          st.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = st
        const mime = pickRecorderMime()
        const mr = mime
          ? new MediaRecorder(st, { mimeType: mime })
          : new MediaRecorder(st)
        chunksRef.current = []
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
        }
        mr.onerror = () => {
          setPhotoErr('Opname mislukt.')
          stopStream()
          setRecActive(false)
        }
        const hintMime = () =>
          (mr.mimeType && mr.mimeType.length > 0
            ? mr.mimeType
            : mime) || 'audio/webm'
        mr.onstop = () => {
          if (!canSendVoiceRef.current) {
            stopStream()
            setRecActive(false)
            return
          }
          setRecActive(false)
          queueMicrotask(() => {
            const ch = chunksRef.current
            const blobType =
              (ch[0] && ch[0].type && ch[0].type !== 'application/octet-stream'
                ? ch[0].type
                : null) || hintMime()
            const b = new Blob(ch, { type: blobType })
            stopStream()
            if (ch.length === 0 || b.size < 8) {
              setPhotoErr(
                'Opname is leeg (0 bytes). Blijf iets langer praten, of probeer een andere browser / HTTPS.',
              )
              return
            }
            if (b.size < 32) {
              setPhotoErr('Opname is te kort. Houd de microfoon 1 seconde ingedrukt.')
              return
            }
            const fr = new FileReader()
            fr.onload = () => {
              const dataUrl = fr.result
              if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
                setPhotoErr('Spraakbericht kon niet worden verwerkt.')
                return
              }
              if (dataUrl.length > MAX_AUDIO_DATAURL_CHARS) {
                setPhotoErr('Opname is te groot. Probeer korter te spreken.')
                return
              }
              postOutgoing({ text: '🎤 Spraakbericht', audioDataUrl: dataUrl })
            }
            fr.onerror = () => setPhotoErr('Spraakbericht kon niet worden verwerkt.')
            fr.readAsDataURL(b)
          })
        }
        recRef.current = mr
        /* iOS: één blob op stop; desktop: stukken voor lange opnames */
        if (isIOSOrIPad()) {
          mr.start()
        } else {
          mr.start(200)
        }
        setRecActive(true)
        recEndTimerRef.current = window.setTimeout(() => {
          if (recRef.current && recRef.current.state === 'recording') {
            recRef.current.stop()
          }
        }, MAX_VOICE_RECORD_MS)
      } catch {
        setRecActive(false)
        setPhotoErr('Geen toegang tot de microfoon, of opname niet ondersteund in deze browser.')
      }
    })()
  }, [openId, matches, postOutgoing, stopStream])

  useLayoutEffect(
    () => () => {
      canSendVoiceRef.current = false
      if (recRef.current) {
        const mr = recRef.current
        mr.onstop = null
        if (mr.state === 'recording') {
          try {
            mr.stop()
          } catch {
            /* */
          }
        }
        recRef.current = null
      }
      stopStream()
      setRecActive(false)
    },
    [stopStream],
  )

  useEffect(() => {
    if (!gifOpen) return
    if (gifQTimerRef.current) window.clearTimeout(gifQTimerRef.current)
    if (!giphyKey) {
      setGifLoad(false)
      setGifItems(GIPHY_FALLBACK)
      return
    }
    setGifLoad(true)
    const tid = window.setTimeout(() => {
      fetchGiphyGifs(gifQ || undefined, giphyKey)
        .then(setGifItems)
        .catch(() => setGifItems(GIPHY_FALLBACK))
        .finally(() => setGifLoad(false))
    }, 400)
    gifQTimerRef.current = tid
    return () => {
      if (gifQTimerRef.current) window.clearTimeout(gifQTimerRef.current)
    }
  }, [gifOpen, gifQ, giphyKey])

  useEffect(() => {
    if (!gifOpen) return
    const onK = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGifOpen(false)
        setGifQ('')
      }
    }
    window.addEventListener('keydown', onK)
    return () => window.removeEventListener('keydown', onK)
  }, [gifOpen])

  const previews = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of matches) {
      m[p.id] = inboxPreviewMsgs(rawByPeer[p.id], p.name, myUserId)
    }
    return m
  }, [matches, rawByPeer, myUserId])

  const { matchesInboxOrder, favIds } = useMemo(() => {
    const favs = readFavSet()
    const sorted = matches.filter((m) => !isUserBanned(m.liveUserId ?? m.id)).sort((a, b) => {
      const aF = favs.has(a.id) ? 0 : 1
      const bF = favs.has(b.id) ? 0 : 1
      if (aF !== bF) return aF - bF
      return a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' })
    })
    return { matchesInboxOrder: sorted, favIds: favs }
  }, [matches, favInboxKey])

  if (matches.length === 0) {
    return (
      <div className="yubo-screen-chat yubo-screen-chat--inbox yubo-inbox-page">
        <header
          className="yubo-app-title-row yubo-inbox-header"
        >
          <h1 className="yubo-friends-h1 yubo-inbox-header__h">Chats</h1>
        </header>
        <div
          className="yubo-main with-tabbar yubo-inbox-zero"
        >
          <div className="yubo-inbox-zero__inner">
            <div className="yubo-inbox-zero__blob" aria-hidden>
              <span className="yubo-inbox-zero__ico">💬</span>
            </div>
            <h2 className="yubo-inbox-zero__title">Nog geen gesprekken</h2>
            <p className="yubo-inbox-zero__lede">
              Swipe in <strong>Swipes</strong> naar rechts
              <span className="yubo-inbox-zero__heart" aria-hidden>
                {' '}
                ♥
              </span>{' '}
              om iemand te matchen. Zodra jullie elkaar liken, chat je hier
              rechtstreeks.
            </p>
            <button
              type="button"
              className="yubo-inbox-zero__cta"
              onClick={onOpenSwipes}
            >
              Naar Swipes
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!openId || !peer) {
    return (
      <div className="yubo-screen-chat yubo-screen-chat--inbox yubo-inbox-page">
        <header className="yubo-app-title-row yubo-inbox-header">
          <h1 className="yubo-friends-h1 yubo-inbox-header__h">Chats</h1>
        </header>
        <div
          className="yubo-main with-tabbar yubo-inbox-list-wrap"
        >
          <ul className="chat-inbox" role="list" aria-label="Gesprekken">
            {matchesInboxOrder.map((m) => {
              const live = m.liveUserId ? liveByUserId.get(m.liveUserId) : null
              return (
              <li key={m.id}>
                <button
                  type="button"
                  className={
                    'chat-inbox__row' +
                    (favIds.has(m.id) ? ' chat-inbox__row--fav' : '') +
                    (live ? ' chat-inbox__row--live' : '')
                  }
                  onClick={() => setOpenId(m.id)}
                >
                  <img
                    className="chat-inbox__av"
                    src={m.mainPhoto}
                    alt=""
                    width={56}
                    height={56}
                  />
                  <div className="chat-inbox__meta">
                    <span className="chat-inbox__name">
                      {m.name}
                      {favIds.has(m.id) ? (
                        <span className="chat-inbox__fav-ico" aria-label="Favoriet">
                          ★
                        </span>
                      ) : null}
                      <span className="yubo-verified" aria-label="Match">
                        ✓
                      </span>
                      {live ? (
                        <span className="chat-inbox__live" aria-label={`${m.name} is live`}>
                          LIVE
                        </span>
                      ) : null}
                    </span>
                    <span className="chat-inbox__preview" title={previews[m.id] ?? ''}>
                      {live
                        ? `Live: ${live.streamTitle || 'kom kijken en chatten'}`
                        : previews[m.id] ?? 'Nieuw'}
                    </span>
                  </div>
                </button>
              </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="yubo-screen-chat">
      <header className="yubo-top compact" style={{ flexShrink: 0 }}>
        <button
          className="yubo-back"
          type="button"
          aria-label="Terug naar berichten"
          onClick={closeThread}
        >
          ‹
        </button>
        <div className="yubo-title-block">
          <div className="yubo-title-name-row">
            <img
              className="yubo-avatar"
              src={peer.mainPhoto}
              alt=""
            />
            <span>{peer.name}</span>
            <span className="yubo-verified" aria-label="Verified">
              ✓
            </span>
          </div>
          <p
            className="yubo-title-sub"
            title={
              otherOnline
                ? 'Deze persoon is nu online'
                : 'Wacht op een reactie'
            }
          >
            {livePeer ? (
              <>
                <span className="yubo-dot-live" />
                <span style={{ color: '#ef1748' }}>Live · {livePeer.streamTitle || 'chat mee'}</span>
              </>
            ) : otherOnline ? (
              <>
                <span className="yubo-dot-online" />
                <span style={{ color: '#22c55e' }}>
                  {otherTyping ? `${peer.name} typt…` : 'Online'}
                </span>
              </>
            ) : (
              <span className="yubo-title-offline">Offline</span>
            )}
          </p>
        </div>
        <div className="yubo-top-actions">
          <button
            type="button"
            className={'yubo-icon-btn' + (fav ? ' yubo-icon-btn--fav-on' : '')}
            onClick={onToggleFav}
            aria-pressed={fav}
            aria-label={fav ? 'Verwijderen uit favorieten' : 'Aan favorieten toevoegen'}
            title={
              fav
                ? 'Verwijderen uit favorieten (niet meer bovenaan de lijst)'
                : 'Aan favorieten — bovenaan in de chatlijst'
            }
          >
            ★
          </button>
          <button
            type="button"
            className="yubo-icon-btn"
            aria-label="Gebruiker melden"
            title="Melden"
            onClick={() => {
              setReportReason('ongepast')
              setReportOpen(true)
            }}
          >
            !
          </button>
        </div>
      </header>

      <div className="chat-messages-outer">
        <div
          ref={chatBodyRef}
          className="chat-body"
          role="log"
          aria-relevant="additions"
          aria-label={lines.length === 0 ? 'Nog geen berichten' : 'Chatverloop'}
        >
          <div className="chat-messages" style={{ paddingTop: 4 }}>
            <ChatThreadBody lines={lines} peer={peer} />
            {otherTyping ? (
              <div className="chat-row theirs" aria-live="polite">
                <img className="chat-av" src={peer.mainPhoto} alt="" />
                <div className="bubble theirs bubble--typing" aria-label={`${peer.name} typt`}>
                  <span className="chat-typing" aria-hidden>
                    <span className="chat-typing__dot" />
                    <span className="chat-typing__dot" />
                    <span className="chat-typing__dot" />
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="chat-bottom">
          {photoErr ? (
            <p className="chat-photo-err" role="alert">
              {photoErr}
            </p>
          ) : null}
          <input
            ref={photoPickRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            tabIndex={-1}
            aria-hidden
            onChange={onPhotoPick}
          />
          <button
            type="button"
            className="yubo-cam"
            aria-label="Foto toevoegen"
            title="Foto uit je apparaat — zo verschijnt die in deze chat (lokaal op dit apparaat)"
            onClick={() => photoPickRef.current?.click()}
          >
            📷
          </button>
          {isItemOwned('sticker_pack') ? (
            <div
              className="chat-sticker-bar"
              role="group"
              aria-label="Stickers (winkel)"
            >
              {['😂', '🔥', '✨', '❤️', '👀', '🫶'].map((emo) => (
                <button
                  key={emo}
                  type="button"
                  className="chat-sticker-btn"
                  onClick={() => {
                    setDraft((d) => {
                      const next = d
                        ? d.endsWith(' ') || d.length === 0
                          ? d + emo
                          : `${d} ${emo}`
                        : emo
                      return next.slice(0, 500)
                    })
                  }}
                >
                  {emo}
                </button>
              ))}
            </div>
          ) : null}
          <div className="chat-input-wrap">
            <input
              className="chat-input"
              id="yubo-chat-composer"
              type="text"
              name="message"
              placeholder="Stuur een bericht…"
              maxLength={500}
              value={draft}
              autoComplete="off"
              enterKeyHint="send"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <div className="chat-input-icons">
              <button
                type="button"
                className="in-icon"
                aria-label="GIF kiezen en verzenden"
                title={
                  giphyKey
                    ? 'GIF kiezen — zoeken op giphy.com'
                    : 'GIFs van Giphy (voor zoeken: VITE_GIPHY_API_KEY — zie developers.giphy.com)'
                }
                onClick={() => {
                  setPhotoErr('')
                  if (!giphyKey) {
                    setGifItems(GIPHY_FALLBACK)
                  }
                  setGifQ('')
                  setGifOpen(true)
                }}
              >
                GIF
              </button>
              <button
                type="button"
                className={
                  'yubo-icon-btn yubo-icon-btn--chat-tools' +
                  (recActive ? ' yubo-icon-btn--rec' : '')
                }
                aria-pressed={recActive}
                aria-label={
                  recActive ? 'Opname stoppen en verzenden' : 'Spraakbericht opnemen'
                }
                title={
                  recActive
                    ? 'Tik opnieuw om te stoppen en te verzenden (max. ca. 90 s)'
                    : 'Tik om op te nemen — nogmaals om te verzenden'
                }
                onClick={onMicClick}
              >
                🎤
              </button>
            </div>
            <button
              type="button"
              className="chat-send-fab"
              disabled={!draft.trim()}
              aria-label="Verzenden"
              title="Verzenden"
              onClick={send}
            >
              <span aria-hidden>➤</span>
            </button>
          </div>
        </div>
      </div>

      {gifOpen && (
        <div
          className="yubo-profile-modal yubo-gif-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yubo-gif-title"
          onClick={() => {
            setGifOpen(false)
            setGifQ('')
          }}
        >
          <div
            className="yubo-profile-modal__panel yubo-gif-modal__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="yubo-profile-modal__head">
              <h2 id="yubo-gif-title" className="yubo-profile-modal__title">
                GIF kiezen
              </h2>
              <button
                type="button"
                className="yubo-profile-modal__close"
                onClick={() => {
                  setGifOpen(false)
                  setGifQ('')
                }}
                aria-label="Sluiten"
              >
                ×
              </button>
            </div>
            <p className="yubo-gif-modal__hint">
              {giphyKey
                ? 'Zoek of scroll; tik op een GIF om te verzenden. Alle GIFs komen van Giphy.'
                : 'Onderstaande komen van Giphy. Voor zoeken en trends: vraag een key op via developers.giphy.com en zet VITE_GIPHY_API_KEY in .env.'}
            </p>
            <p className="yubo-gif-modal__giphy-attr">
              <a
                className="yubo-gif-modal__giphy-link"
                href="https://giphy.com/"
                target="_blank"
                rel="noreferrer"
              >
                giphy.com
              </a>
              {giphyKey ? (
                <>
                  {' '}
                  · API{' '}
                  <a
                    className="yubo-gif-modal__giphy-link"
                    href="https://developers.giphy.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    developers.giphy.com
                  </a>
                </>
              ) : null}
            </p>
            <div className="yubo-gif-modal__search">
              <input
                className="yubo-field"
                type="search"
                value={gifQ}
                onChange={(e) => setGifQ(e.target.value)}
                placeholder={giphyKey ? 'Zoek op Giphy…' : 'Zoeken vereist API-sleutel'}
                disabled={!giphyKey}
                autoComplete="off"
                enterKeyHint="search"
                aria-label="Giphy-zoekopdracht"
              />
            </div>
            {gifLoad ? (
              <p className="yubo-gif-modal__load" role="status">
                Laden…
              </p>
            ) : null}
            <div
              className="yubo-gif-modal__grid"
              role="list"
              aria-label="GIF-resultaten"
            >
              {gifItems.map((g) => (
                <GifPickerThumb
                  key={`${g.label}-${g.url}`}
                  g={g}
                  onPick={sendChosenGif}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {reportOpen && peer && (
        <div
          className="yubo-profile-modal yubo-profile-modal--report"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yubo-report-title"
          onClick={() => setReportOpen(false)}
        >
          <div
            className="yubo-profile-modal__panel yubo-report-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="yubo-profile-modal__head">
              <h2 id="yubo-report-title" className="yubo-profile-modal__title">
                {peer.name} melden
              </h2>
              <button
                type="button"
                className="yubo-profile-modal__close"
                onClick={() => setReportOpen(false)}
                aria-label="Sluiten"
              >
                ×
              </button>
            </div>
            <div className="yubo-report-panel__body">
              <p className="yubo-report-panel__lead">
                Je melding wordt lokaal geregistreerd en bevestigd.
              </p>
              <label className="yubo-report-panel__label" htmlFor="yubo-report-cat">
                Reden
              </label>
              <select
                id="yubo-report-cat"
                className="yubo-field"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                <option value="ongepast">Ongedrag of grensoverschrijding</option>
                <option value="fake">Valse identiteit of spam</option>
                <option value="ongemak">Onveilig of onprettig gevoel</option>
                <option value="anders">Iets anders</option>
              </select>
              <label className="yubo-report-panel__label" htmlFor="yubo-report-note">
                Opmerking (optioneel)
              </label>
              <textarea
                id="yubo-report-note"
                className="yubo-field"
                rows={3}
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                maxLength={500}
                placeholder="Kort toelichten…"
              />
            </div>
            <div className="yubo-profile-modal__footer">
              <button
                type="button"
                className="btn primary"
                style={{ width: '100%' }}
                onClick={submitReport}
              >
                Melding verzenden
              </button>
            </div>
          </div>
        </div>
      )}

      {reportThanks ? (
        <div className="yubo-toast" role="status" aria-live="polite">
          Melding geregistreerd.
        </div>
      ) : null}
    </div>
  )
}

/* ——— Friends ——— */
function liveChatMessagePreview(msg: SwChatMsg | undefined): string {
  if (!msg) return 'Nieuw bericht'
  if (msg.imageDataUrl) return msg.imageName ? `Foto: ${msg.imageName}` : 'Foto gestuurd'
  if (msg.gifUrl) return msg.gifLabel || 'GIF gestuurd'
  if (msg.audioDataUrl) return 'Spraakbericht'
  return msg.text || 'Nieuw bericht'
}

function profileMatchesSearch(p: SwipeProfile, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase().replace(/^@+/, '')
  if (!q) return true
  const haystack = [
    p.name,
    p.username,
    `@${p.username}`,
    p.city,
    p.bio,
    p.profession,
    p.company,
    ...p.tags.map((tag) => tag.t),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

function FriendsPanel({
  sub,
  onSub,
  onOpenMenuSettings,
  userAvatarUrl,
  userGreetingName,
  userCoins,
  onOpenShop,
  discoverUnlocked,
  onStripeDiscoverCheckout,
  discoverSuggestions,
  onOpenSwipesTab,
  incoming,
  followedLive,
  matches,
  myUserId,
  liveJoinRequests,
  isStreaming,
  liveViewerCount,
  streamTitle,
  onStreamTitle,
  onStartLive,
  onStopLive,
  onSendGift,
  onRequestJoinLive,
  onUpdateJoinRequest,
  onOpenLiveChat,
  onAcceptRequest,
  onDismissRequest,
}: {
  sub: 'live' | 'req' | 'dis'
  onSub: (s: 'live' | 'req' | 'dis') => void
  onOpenMenuSettings: () => void
  userAvatarUrl: string
  userGreetingName: string
  userCoins: number
  onOpenShop: () => void
  discoverUnlocked: boolean
  onStripeDiscoverCheckout: () => Promise<void>
  discoverSuggestions: SwipeProfile[]
  onOpenSwipesTab: () => void
  incoming: IncomingItem[]
  followedLive: SwipeProfile[]
  matches: SwipeProfile[]
  myUserId: string
  liveJoinRequests: LiveJoinRequest[]
  isStreaming: boolean
  liveViewerCount: number
  streamTitle: string
  onStreamTitle: (value: string) => void
  onStartLive: () => void
  onStopLive: () => void
  onSendGift: (p: SwipeProfile, gift: LiveGift) => boolean
  onRequestJoinLive: (p: SwipeProfile) => void
  onUpdateJoinRequest: (requestId: string, status: LiveJoinRequest['status']) => void
  onOpenLiveChat: (p: SwipeProfile) => void
  onAcceptRequest: (it: IncomingItem) => void
  onDismissRequest: (it: IncomingItem) => void
}) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [discoverTermsOk, setDiscoverTermsOk] = useState(false)
  const [liveCameraOn, setLiveCameraOn] = useState(false)
  const [liveCameraError, setLiveCameraError] = useState('')
  const [giftToast, setGiftToast] = useState('')
  const [liveChatByMatch, setLiveChatByMatch] = useState<Record<string, SwChatMsg[]>>({})
  const [liveTypingByMatch, setLiveTypingByMatch] = useState<Record<string, number>>({})
  const [liveChatTick, setLiveChatTick] = useState(0)
  const [peopleSearch, setPeopleSearch] = useState('')
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const liveStreamRef = useRef<MediaStream | null>(null)

  const stopLiveCamera = useCallback(() => {
    liveStreamRef.current?.getTracks().forEach((track) => track.stop())
    liveStreamRef.current = null
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null
    setLiveCameraOn(false)
  }, [])

  const startLiveCamera = useCallback(async () => {
    setLiveCameraError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setLiveCameraError('Camera wordt niet ondersteund in deze browser.')
        return false
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      liveStreamRef.current = stream
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
        await liveVideoRef.current.play().catch(() => undefined)
      }
      setLiveCameraOn(true)
      return true
    } catch {
      setLiveCameraError('Camera-toegang geweigerd of niet beschikbaar.')
      return false
    }
  }, [])

  useEffect(() => () => stopLiveCamera(), [stopLiveCamera])

  useEffect(() => {
    if (isStreaming) return
    stopLiveCamera()
  }, [isStreaming, stopLiveCamera])

  useEffect(() => {
    if (!giftToast) return
    const t = window.setTimeout(() => setGiftToast(''), 2600)
    return () => window.clearTimeout(t)
  }, [giftToast])

  useEffect(() => {
    setLiveChatByMatch((prev) => {
      let changed = false
      const next = { ...prev }
      for (const m of matches) {
        if (next[m.id] === undefined) {
          next[m.id] = readThread(m.id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [matches])

  useEffect(() => {
    if (!isStreaming) return
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith(THREAD_KEY_PREFIX) || e.newValue == null) return
      const matchId = e.key.slice(THREAD_KEY_PREFIX.length)
      if (!matches.some((m) => m.id === matchId)) return
      try {
        const list = JSON.parse(e.newValue) as SwChatMsg[]
        if (Array.isArray(list)) {
          setLiveChatByMatch((prev) => ({ ...prev, [matchId]: list }))
        }
      } catch {
        /* */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [isStreaming, matches])

  useEffect(() => {
    if (!isStreaming || typeof BroadcastChannel === 'undefined') return
    const bc = new BroadcastChannel(BROADCAST)
    const onMsg = (e: MessageEvent) => {
      const d = e.data as BCEnvelope
      if (!d || d.v !== 1 || d.userId === myUserId) return
      if (!matches.some((m) => m.id === d.matchId)) return
      if (d.t === 'msg' && d.msg) {
        setLiveChatByMatch((prev) => {
          const cur = prev[d.matchId] ?? readThread(d.matchId)
          const next = appendMessageDedupe(cur, d.msg)
          return { ...prev, [d.matchId]: next }
        })
      }
      if (d.t === 'typing') {
        setLiveTypingByMatch((prev) => ({
          ...prev,
          [d.matchId]: d.typing ? Date.now() + 3500 : 0,
        }))
      }
    }
    bc.addEventListener('message', onMsg)
    return () => {
      bc.removeEventListener('message', onMsg)
      bc.close()
    }
  }, [isStreaming, matches, myUserId])

  useEffect(() => {
    if (!isStreaming) return
    const t = window.setInterval(() => setLiveChatTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [isStreaming])

  useEffect(() => {
    if (sub !== 'live' || followedLive.length === 0) return
    const ping = () => {
      for (const p of followedLive) {
        if (p.liveUserId && p.isStreaming) {
          pingLiveViewer(p.liveUserId, myUserId)
        }
      }
    }
    ping()
    const t = window.setInterval(ping, 4000)
    return () => window.clearInterval(t)
  }, [sub, followedLive, myUserId])

  const liveChatRows = useMemo(() => {
    const now = Date.now()
    return matches
      .map((match) => {
        const messages = liveChatByMatch[match.id] ?? []
        const lastIncoming = [...messages]
          .reverse()
          .find((msg) => msg.fromUser !== myUserId)
        return {
          match,
          lastIncoming,
          typing: (liveTypingByMatch[match.id] ?? 0) > now,
        }
      })
      .filter((row) => row.typing || row.lastIncoming)
      .sort((a, b) => {
        if (a.typing !== b.typing) return a.typing ? -1 : 1
        return (b.lastIncoming?.ts ?? 0) - (a.lastIncoming?.ts ?? 0)
      })
      .slice(0, 5)
  }, [matches, liveChatByMatch, liveTypingByMatch, liveChatTick, myUserId])

  const searchedFollowedLive = useMemo(
    () => followedLive.filter((p) => profileMatchesSearch(p, peopleSearch)),
    [followedLive, peopleSearch],
  )
  const searchedIncoming = useMemo(
    () => incoming.filter((row) => profileMatchesSearch(row.card, peopleSearch)),
    [incoming, peopleSearch],
  )
  const searchedDiscoverSuggestions = useMemo(
    () => discoverSuggestions.filter((p) => profileMatchesSearch(p, peopleSearch)),
    [discoverSuggestions, peopleSearch],
  )
  const peopleSearchResults = useMemo(() => {
    if (!peopleSearch.trim()) return []
    const byId = new Map<string, SwipeProfile>()
    for (const p of [...followedLive, ...incoming.map((row) => row.card), ...discoverSuggestions, ...matches]) {
      const key = p.liveUserId || p.id
      if (isUserBanned(key)) continue
      if (!byId.has(key) && profileMatchesSearch(p, peopleSearch)) {
        byId.set(key, p)
      }
    }
    return [...byId.values()].slice(0, 20)
  }, [followedLive, incoming, discoverSuggestions, matches, peopleSearch])

  const handleLiveToggle = async () => {
    if (isStreaming) {
      onStopLive()
      stopLiveCamera()
      return
    }
    const cameraOk = await startLiveCamera()
    if (!cameraOk) return
    onStartLive()
  }

  const onPay = async () => {
    setCheckoutError(null)
    setCheckoutLoading(true)
    try {
      await onStripeDiscoverCheckout()
    } catch (e) {
      setCheckoutError(formatStripeUserError(e))
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="yubo-screen-chat">
      <div className="yubo-app-title-row">
        <h1 className="yubo-friends-h1">Friends</h1>
        <div className="friends-top-icons" style={{ paddingRight: 4 }}>
          <button
            type="button"
            className="yubo-shop"
            title="Shop — items en coins"
            onClick={onOpenShop}
          >
            <span aria-hidden>🪙</span>
            <span className="yubo-shop__bal">{userCoins}</span> Shop
          </button>
          <button
            type="button"
            className="yubo-me-avatar-btn"
            onClick={onOpenMenuSettings}
            style={{ width: 36, height: 36 }}
            aria-label="Menu en instellingen"
            title="Menu en instellingen"
          >
            <img
              className="yubo-me-avatar-btn__img"
              src={userAvatarUrl}
              alt=""
              width={32}
              height={32}
            />
            <span className="visually-hidden">{userGreetingName}</span>
          </button>
        </div>
      </div>

      <div className="yubo-subtabs" role="tablist" aria-label="Vrienden">
        <button
          className={'yubo-subtab' + (sub === 'live' ? ' active' : '')}
          type="button"
          onClick={() => onSub('live')}
          role="tab"
          aria-selected={sub === 'live'}
        >
          Live
        </button>
        <button
          className={'yubo-subtab' + (sub === 'req' ? ' active' : '')}
          type="button"
          onClick={() => onSub('req')}
          role="tab"
          aria-selected={sub === 'req'}
        >
          Requests
        </button>
        <button
          className={
            'yubo-subtab' +
            (sub === 'dis' ? ' active' : '') +
            (!discoverUnlocked ? ' yubo-subtab--paid' : '')
          }
          type="button"
          onClick={() => onSub('dis')}
          role="tab"
          aria-selected={sub === 'dis'}
          title={!discoverUnlocked ? 'Discover+ is betaald' : undefined}
        >
          Discover
          {!discoverUnlocked ? (
            <span className="yubo-subtab__mark" aria-hidden>
              +
            </span>
          ) : null}
        </button>
      </div>

      <div className="friends-search-wrap">
        <label className="visually-hidden" htmlFor="friends-people-search">
          Mensen zoeken
        </label>
        <input
          id="friends-people-search"
          className="friends-search"
          type="text"
          value={peopleSearch}
          onChange={(e) => setPeopleSearch(e.target.value)}
          placeholder="Zoek mensen op naam, @username of tag…"
          autoComplete="off"
        />
        {peopleSearch ? (
          <button
            type="button"
            className="friends-search-clear"
            onClick={() => setPeopleSearch('')}
            aria-label="Zoekopdracht wissen"
          >
            ×
          </button>
        ) : null}
      </div>

      {peopleSearch.trim() ? (
        <div className="yubo-main with-tabbar friends-search-results">
          <h2 className="friends-search-results__h">Zoekresultaten</h2>
          {peopleSearchResults.length === 0 ? (
            <p className="swipe-hint" style={{ padding: '0.35rem 0.75rem' }}>
              Geen mensen gevonden met deze gebruikersnaam of naam.
            </p>
          ) : (
            <ul className="friends-discover-sug__list" role="list">
              {peopleSearchResults.map((p) => (
                <li key={p.liveUserId || p.id} className="friends-suggest-row">
                  <div className="friends-suggest-media">
                    <img
                      className="friends-suggest-av"
                      src={p.mainPhoto}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                    />
                    <span className={p.city === 'Live' || p.city === 'Actief' ? 'friends-suggest-badge friends-suggest-badge--live' : 'friends-suggest-badge'}>
                      {p.city === 'Live' ? 'live' : p.city === 'Actief' ? 'actief' : 'profiel'}
                    </span>
                  </div>
                  <div className="friends-suggest-mid">
                    <div className="friends-suggest-line1">
                      {p.name}
                      <span className="friends-suggest-age"> {p.age}</span>
                    </div>
                    <p className="friends-suggest-user">@{p.username} · {p.city}</p>
                  </div>
                  <button
                    type="button"
                    className="friends-suggest-swipe"
                    onClick={onOpenSwipesTab}
                    title="Open Swipes om te matchen"
                  >
                    Swipes
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!peopleSearch.trim() && sub === 'live' && (
        <div className="yubo-main with-tabbar yubo-live-panel">
          <section className="yubo-live-card" aria-label="Zelf live gaan">
            <div className="yubo-live-card__top">
              <div>
                <p className="yubo-live-eyebrow">Stream</p>
                <h2 className="yubo-live-card__h">
                  {isStreaming ? 'Je bent live' : 'Ga live voor je volgers'}
                </h2>
              </div>
              <span className={'yubo-live-dot' + (isStreaming ? ' is-on' : '')}>
                {isStreaming ? 'LIVE' : 'OFF'}
              </span>
            </div>
            {isStreaming ? (
              <div className="yubo-live-viewers" aria-live="polite">
                <span aria-hidden>👀</span>
                {liveViewerCount} kijker{liveViewerCount === 1 ? '' : 's'}
              </div>
            ) : null}
            <div className="yubo-live-preview">
              <div className="yubo-live-preview__media">
                <video
                  ref={liveVideoRef}
                  className="yubo-live-video"
                  playsInline
                  muted
                  autoPlay
                  aria-label="Camera preview"
                />
                {!liveCameraOn ? (
                  <img src={userAvatarUrl} alt="" width={96} height={128} />
                ) : null}
                {isStreaming ? <span className="yubo-live-preview__badge">LIVE</span> : null}
              </div>
              <div className="yubo-live-preview__copy">
                <strong>{userGreetingName}</strong>
                <span>{isStreaming ? streamTitle : 'Zet je camera aan en start je live.'}</span>
                {liveCameraError ? (
                  <em className="yubo-live-camera-error">{liveCameraError}</em>
                ) : null}
              </div>
            </div>
            <label className="yubo-live-label" htmlFor="swipey-live-title">
              Titel van je live
            </label>
            <input
              id="swipey-live-title"
              className="yubo-field"
              value={streamTitle}
              onChange={(e) => onStreamTitle(e.target.value.slice(0, 60))}
              maxLength={60}
              placeholder="bijv. Kom gezellig meepraten"
            />
            <button
              type="button"
              className={isStreaming ? 'yubo-live-stop' : 'yubo-live-start'}
              onClick={handleLiveToggle}
            >
              {isStreaming ? 'Stop live' : 'Camera aan & ga live'}
            </button>
            {isStreaming ? (
              <div className="yubo-live-chat-panel" aria-label="Live chat tijdens je stream">
                <div className="yubo-live-chat-panel__head">
                  <strong>Live chat</strong>
                  <span>{liveChatRows.length ? 'Nu binnen' : 'Wacht op chats'}</span>
                </div>
                {liveChatRows.length === 0 ? (
                  <p className="yubo-live-chat-empty">
                    Berichten van je matches verschijnen hier terwijl jij live bent.
                  </p>
                ) : (
                  <ul className="yubo-live-chat-list" role="list">
                    {liveChatRows.map(({ match, lastIncoming, typing }) => (
                      <li key={match.id} className="yubo-live-chat-row">
                        <img
                          className="yubo-live-chat-row__av"
                          src={match.mainPhoto}
                          alt=""
                          width={28}
                          height={28}
                        />
                        <div className="yubo-live-chat-row__body">
                          <span className="yubo-live-chat-row__name">{match.name}</span>
                          <span className="yubo-live-chat-row__text">
                            {typing
                              ? 'typt…'
                              : liveChatMessagePreview(lastIncoming)}
                          </span>
                        </div>
                        {typing ? (
                          <span className="chat-typing yubo-live-chat-row__typing" aria-hidden>
                            <span className="chat-typing__dot" />
                            <span className="chat-typing__dot" />
                            <span className="chat-typing__dot" />
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {isStreaming ? (
              <div className="yubo-live-join-panel" aria-label="Meedoen aanvragen">
                <div className="yubo-live-chat-panel__head">
                  <strong>Meedoen requests</strong>
                  <span>{liveJoinRequests.filter((r) => r.status === 'pending').length} wachtend</span>
                </div>
                {liveJoinRequests.length === 0 ? (
                  <p className="yubo-live-chat-empty">
                    Als kijkers willen meedoen aan je live, verschijnen ze hier.
                  </p>
                ) : (
                  <ul className="yubo-live-join-list" role="list">
                    {liveJoinRequests.slice(0, 6).map((req) => (
                      <li key={req.id} className="yubo-live-join-row">
                        <img src={req.viewerPhoto} alt="" width={28} height={28} />
                        <div>
                          <strong>{req.viewerName}</strong>
                          <span>{req.status === 'pending' ? 'wil meedoen' : req.status === 'accepted' ? 'toegelaten' : 'geweigerd'}</span>
                        </div>
                        {req.status === 'pending' ? (
                          <div className="yubo-live-join-actions">
                            <button type="button" onClick={() => onUpdateJoinRequest(req.id, 'accepted')}>
                              Toelaten
                            </button>
                            <button type="button" onClick={() => onUpdateJoinRequest(req.id, 'declined')}>
                              Weigeren
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>

          <section className="yubo-live-following" aria-label="Volgers die live zijn">
            <h2 className="yubo-live-section-title">Live bij mensen die je volgt</h2>
            <p className="yubo-live-note">
              Als jij live gaat, zien je matches jou hier ook. Tik op Chat om meteen
              mee te praten terwijl iemand live is.
            </p>
            {searchedFollowedLive.length === 0 ? (
              <p className="swipe-hint" style={{ padding: '0.2rem 0 0.4rem' }}>
                {peopleSearch
                  ? 'Geen live mensen gevonden voor deze zoekopdracht.'
                  : 'Niemand van je matches is nu live. Als iemand uit je friends live gaat, verschijnt die hier meteen.'}
              </p>
            ) : (
              <div className="friend-list yubo-live-list">
                {searchedFollowedLive.map((p) => (
                  <article key={p.liveUserId ?? p.id} className="friend-row yubo-live-row">
                    <img
                      className="friend-av"
                      src={p.mainPhoto}
                      alt=""
                      width={44}
                      height={44}
                    />
                    <div className="friend-mid">
                      <h3 className="friend-name">{p.name}</h3>
                      <p className="friend-user">
                        @{p.username} · {p.streamTitle || 'Live op Swipey'}
                      </p>
                    </div>
                    <span className="yubo-live-pill">LIVE</span>
                    <button
                      type="button"
                      className="yubo-live-chat-btn"
                      onClick={() => onOpenLiveChat(p)}
                    >
                      Chat
                    </button>
                    <button
                      type="button"
                      className="yubo-live-chat-btn yubo-live-join-btn"
                      onClick={() => onRequestJoinLive(p)}
                    >
                      Meedoen
                    </button>
                    <div className="yubo-live-gifts" aria-label={`Gifts sturen naar ${p.name}`}>
                      {LIVE_GIFTS.map((gift) => (
                        <button
                          key={gift.id}
                          type="button"
                          className="yubo-live-gift-btn"
                          onClick={() => {
                            const ok = onSendGift(p, gift)
                            setGiftToast(
                              ok
                                ? `${gift.icon} ${gift.label} gestuurd naar ${p.name}`
                                : 'Niet genoeg coins. Open Shop om coins te kopen.',
                            )
                          }}
                        >
                          <span aria-hidden>{gift.icon}</span>
                          {gift.cost}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          {giftToast ? (
            <div className="yubo-live-gift-toast" role="status">
              {giftToast}
            </div>
          ) : null}
        </div>
      )}

      {!peopleSearch.trim() && sub === 'req' && (
        <div className="yubo-main with-tabbar" style={{ paddingTop: 0, flex: 1, overflow: 'auto' }}>
          {searchedIncoming.length === 0 ? (
            <p className="swipe-hint" style={{ padding: '0.6rem 1.25rem 0.25rem' }}>
              {peopleSearch ? (
                <>Geen requests gevonden voor deze zoekopdracht.</>
              ) : (
                <>
                  Nog geen requests. Zodra iemand jou toevoegt, liket of wil connecten,
                  verschijnt die aanvraag hier.
                </>
              )}
            </p>
          ) : null}
          <div className="friend-list">
            {searchedIncoming.map((row, i) => {
              const c = row.card
              const stackClasses = ['stacked-1', 'stacked-2', 'stacked-3'] as const
              const stacked = i < 3 ? stackClasses[i] : ''
              return (
                <article
                  key={row.id}
                  className={'friend-row' + (stacked ? ' ' + stacked : '')}
                >
                  <img
                    className="friend-av"
                    src={c.mainPhoto}
                    alt=""
                    width={40}
                    height={40}
                  />
                  <div className="friend-mid">
                    <h2 className="friend-name">{c.name}</h2>
                    <p className="friend-user">@{c.username}</p>
                  </div>
                  <button
                    type="button"
                    className="friend-accept"
                    onClick={() => onAcceptRequest(row)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="friend-decline"
                    aria-label="Afwijzen"
                    title="Afwijzen"
                    onClick={() => onDismissRequest(row)}
                  >
                    ×
                  </button>
                </article>
              )
            })}
          </div>
        </div>
      )}

      {!peopleSearch.trim() && sub === 'dis' && (
        <div
          className="disco with-tabbar"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '0.5rem' }}
        >
          {discoverUnlocked ? (
            <div
              className="friends-discover-sug yubo-main with-tabbar"
              style={{
                paddingTop: 0,
                flex: 1,
                overflow: 'auto',
                margin: '0 0.45rem 0.5rem',
              }}
            >
              <h2 className="friends-discover-sug__h">Suggesties voor jou</h2>
              <p className="friends-discover-sug__lead">
                Alleen echte accounts in je pool. <strong>Actief</strong> = zojuist
                actief; <strong>Offline</strong> = wel in de pool, minder recent. Tik op{' '}
                <strong>Accept</strong> om naar <strong>Swipes</strong> te gaan.
              </p>
              {searchedDiscoverSuggestions.length === 0 ? (
                <p className="swipe-hint" style={{ padding: '0.4rem 0.75rem 0.6rem' }}>
                  {peopleSearch ? (
                    <>Geen mensen gevonden voor deze zoekopdracht.</>
                  ) : (
                    <>
                      Nog geen profielen gevonden. Zodra er nieuwe mensen beschikbaar zijn
                      die passen bij je voorkeuren, verschijnen ze hier.
                    </>
                  )}
                </p>
              ) : null}
              <ul className="friends-discover-sug__list" role="list">
                {searchedDiscoverSuggestions.map((p) => {
                  const isOn = p.city === 'Actief' || p.city === 'Live'
                  const t1 = p.tags[0]
                  const t2 = p.tags[1]
                  return (
                    <li key={p.id} className="friends-suggest-row">
                      <div className="friends-suggest-media">
                        <img
                          className="friends-suggest-av"
                          src={p.mainPhoto}
                          alt=""
                          width={48}
                          height={48}
                          loading="lazy"
                        />
                        {isOn ? (
                          <span className="friends-suggest-badge friends-suggest-badge--live">
                            actief
                          </span>
                        ) : (
                          <span className="friends-suggest-badge">offline</span>
                        )}
                      </div>
                      <div className="friends-suggest-mid">
                        <div className="friends-suggest-line1">
                          {p.name}
                          <span className="friends-suggest-age"> {p.age}</span>
                        </div>
                        <p className="friends-suggest-user">@{p.username} · {p.city}</p>
                        {(t1 || t2) && (
                          <p className="friends-suggest-tags" aria-label="Interesses">
                            {t1 ? (
                              <span
                                className="friends-suggest-pill"
                                style={{ background: t1.c }}
                              >
                                {t1.t}
                              </span>
                            ) : null}
                            {t2 ? (
                              <span
                                className="friends-suggest-pill"
                                style={{ background: t2.c }}
                              >
                                {t2.t}
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="friends-suggest-swipe"
                        onClick={onOpenSwipesTab}
                        title="Open Swipes om te matchen"
                        aria-label={`Accept, ${p.name}`}
                      >
                        Accept
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div className="friends-discover-pay" role="region" aria-label="Discover+">
              <div className="friends-discover-pay__icon" aria-hidden>
                ✦
              </div>
              <h2 className="friends-discover-pay__h">Discover+</h2>
              <p className="friends-discover-pay__p">
                Suggesties op basis van stijl en dichtbij, plus extra plek in je
                vrienden-flow. Abonnement per maand op dit apparaat.
              </p>
              <p className="friends-discover-pay__price">€3,99 per maand</p>
              {checkoutError ? (
                <p
                  className="friends-discover-pay__test"
                  style={{ color: '#b91c1c' }}
                  role="alert"
                >
                  {checkoutError}
                </p>
              ) : null}
              <label className="friends-discover-pay__accept">
                <input
                  type="checkbox"
                  checked={discoverTermsOk}
                  onChange={(e) => setDiscoverTermsOk(e.target.checked)}
                />
                <span>
                  Ik accepteer de voorwaarden en het abonnement (per maand op dit
                  apparaat).
                </span>
              </label>
              <button
                type="button"
                className="friends-discover-pay__btn"
                onClick={() => {
                  void onPay()
                }}
                disabled={checkoutLoading || !discoverTermsOk}
              >
                {checkoutLoading ? 'Laden…' : 'Afrekenen met Stripe'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ——— Muted ——— */
const MAX_MUTED_WORDS = 80
const MUTED_WMAX = 48

function MutedScreen({
  onBack,
  matchPreferences,
  onMatchPreferences,
}: {
  onBack: () => void
  matchPreferences: MatchPreferences
  onMatchPreferences: (value: MatchPreferences) => void
}) {
  const [items, setItems] = useState<MutedEntry[]>(() => readMutedWords())
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [openPanel, setOpenPanel] = useState<
    null | 'blocked' | 'words' | 'location' | 'camera' | 'data' | 'login'
  >('words')
  const [blockedRows, setBlockedRows] = useState(() => readBannedUsers())
  const [locationBusy, setLocationBusy] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    writeMutedWords(items)
  }, [items])

  const addWord = useCallback(() => {
    const w = draft.trim()
    if (!w) return
    if (w.length > MUTED_WMAX) return
    if (items.length >= MAX_MUTED_WORDS) return
    if (items.some((x) => x.w.toLowerCase() === w.toLowerCase())) return
    setItems((p) => [...p, { id: randomId(), w }])
    setDraft('')
  }, [draft, items])

  const removeWord = useCallback((id: string) => {
    setItems((p) => p.filter((x) => x.id !== id))
  }, [])

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => {
      setNotice((current) => (current === message ? '' : current))
    }, 3200)
  }, [])

  const clearLocalSafetyData = useCallback(() => {
    if (!window.confirm('Lokale chat-, swipe-, report- en accountdata wissen op dit apparaat?')) {
      return
    }
    clearAdminLocalData()
    setItems([])
    setBlockedRows([])
    showNotice('Lokale gegevens zijn gewist.')
  }, [showNotice])

  const unblockUser = useCallback(
    (userId: string) => {
      unbanUser(userId)
      setBlockedRows(readBannedUsers())
      showNotice('Gebruiker gedeblokkeerd.')
    },
    [showNotice],
  )

  const togglePanel = useCallback(
    (panel: NonNullable<typeof openPanel>) => {
      setOpenPanel((current) => (current === panel ? null : panel))
      if (panel === 'words') {
        window.setTimeout(() => addInputRef.current?.focus(), 0)
      }
    },
    [],
  )

  const setLocationEnabled = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        onMatchPreferences({
          ...matchPreferences,
          locationEnabled: false,
          nearbyOnly: false,
          locationLabel: '',
        })
        showNotice('Locatie is uitgezet.')
        return
      }
      if (!navigator.geolocation) {
        showNotice('Locatie wordt niet ondersteund in deze browser.')
        return
      }
      setLocationBusy(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationBusy(false)
          onMatchPreferences({
            ...matchPreferences,
            locationEnabled: true,
            nearbyOnly: true,
            locationLabel: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
          })
          showNotice('Locatie staat aan.')
        },
        () => {
          setLocationBusy(false)
          showNotice('Locatie-toestemming is geweigerd of niet beschikbaar.')
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 },
      )
    },
    [matchPreferences, onMatchPreferences, showNotice],
  )

  return (
    <div className="yubo-screen-chat safety-screen">
      <header className="yubo-top compact safety-top" style={{ flexShrink: 0 }}>
        <button
          className="yubo-back yubo-back--chevron"
          type="button"
          onClick={onBack}
          aria-label="Terug"
        >
          ‹
        </button>
        <h1 className="yubo-title">Veiligheid en privacy</h1>
        <span style={{ width: 32 }} aria-hidden />
      </header>

      <div className="yubo-main with-tabbar safety-body">
        <section className="safety-list" aria-label="Veiligheid en privacy opties">
          <button
            type="button"
            className="safety-row"
            onClick={() => togglePanel('blocked')}
            aria-expanded={openPanel === 'blocked'}
          >
            <span>Geblokkeerde gebruikers</span>
            <strong>{blockedRows.length}</strong>
            <i aria-hidden>›</i>
          </button>
          {openPanel === 'blocked' ? (
            <div className="safety-panel">
              {blockedRows.length === 0 ? (
                <p>Je hebt nog niemand geblokkeerd. Reports en bans verschijnen hier.</p>
              ) : (
                <ul className="safety-blocked-list" role="list">
                  {blockedRows.map((user) => (
                    <li key={user.userId}>
                      <span>{user.name}</span>
                      <button type="button" onClick={() => unblockUser(user.userId)}>
                        Deblokkeer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <button
            type="button"
            className="safety-row"
            onClick={() => togglePanel('words')}
            aria-expanded={openPanel === 'words'}
          >
            <span>Genegeerde woorden</span>
            <strong>{items.length}</strong>
            <i aria-hidden>›</i>
          </button>
          <p className="safety-row-help">
            Blokkeer berichten in chats en lives die je genegeerde woorden bevatten.
          </p>
          {openPanel === 'words' ? (
            <div className="safety-panel safety-panel--words">
              <div className="muted-add-row">
                <label className="visually-hidden" htmlFor="muted-new-word">
                  Woord om te dempen
                </label>
                <input
                  ref={addInputRef}
                  id="muted-new-word"
                  className="yubo-field muted-add-row__input"
                  type="text"
                  value={draft}
                  maxLength={MUTED_WMAX}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      addWord()
                    }
                  }}
                  placeholder="Typ een woord…"
                />
                <button
                  type="button"
                  className="yubo-tag-add__btn muted-add-row__go"
                  onClick={addWord}
                  disabled={!draft.trim() || items.length >= MAX_MUTED_WORDS}
                  aria-label="Toevoegen"
                >
                  +
                </button>
              </div>
              {items.length > 0 ? (
                <ul className="muted-list" role="list">
                  {items.map((m) => (
                    <li key={m.id}>
                      <div className="muted-card muted-card--item">
                        <div>
                          <span className="muted-prim">{m.w}</span>
                          <span className="muted-sec">Overal geblokkeerd in chat</span>
                        </div>
                        <button
                          type="button"
                          className="muted-card__remove"
                          onClick={() => removeWord(m.id)}
                          aria-label={`${m.w} verwijderen`}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="safety-empty">Nog geen woorden toegevoegd.</p>
              )}
            </div>
          ) : null}

          <button
            type="button"
            className="safety-row"
            onClick={() => togglePanel('location')}
            aria-expanded={openPanel === 'location'}
          >
            <span>Locatie</span>
            <strong>{matchPreferences.locationEnabled ? 'Aan' : 'Uit'}</strong>
            <i aria-hidden>›</i>
          </button>
          <p className="safety-row-help">Beheer de toegang tot je locatiegegevens.</p>
          {openPanel === 'location' ? (
            <div className="safety-panel safety-panel--location">
              <label className="safety-location-toggle">
                <span>
                  <strong>Locatie gebruiken</strong>
                  <em>
                    {matchPreferences.locationEnabled
                      ? `Aan${matchPreferences.locationLabel ? ` · ${matchPreferences.locationLabel}` : ''}`
                      : 'Uitgeschakeld'}
                  </em>
                </span>
                <input
                  type="checkbox"
                  checked={matchPreferences.locationEnabled}
                  disabled={locationBusy}
                  onChange={(e) => {
                    void setLocationEnabled(e.target.checked)
                  }}
                />
              </label>
              <p>
                Als je dit aanzet, vraagt je browser toestemming. Swipey gebruikt locatie
                voor voorkeuren zoals “in je buurt” en maximale afstand.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="safety-row"
            onClick={() => togglePanel('camera')}
            aria-expanded={openPanel === 'camera'}
          >
            <span>Camera en microfoon</span>
            <i aria-hidden>›</i>
          </button>
          {openPanel === 'camera' ? (
            <div className="safety-panel">
              <p>Camera wordt gebruikt voor live en verificatie. Microfoon wordt gebruikt voor spraakberichten. Je browser vraagt toestemming wanneer dit nodig is.</p>
            </div>
          ) : null}

          <button
            type="button"
            className="safety-row"
            onClick={() => togglePanel('data')}
            aria-expanded={openPanel === 'data'}
          >
            <span>Personalisatie en data</span>
            <i aria-hidden>›</i>
          </button>
          {openPanel === 'data' ? (
            <div className="safety-panel">
              <p>Profielen, chats, swipes, likes, reports en shop-items worden lokaal op dit apparaat opgeslagen.</p>
              <button type="button" className="safety-panel__danger" onClick={clearLocalSafetyData}>
                Lokale gegevens wissen
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="safety-row"
            onClick={() => togglePanel('login')}
            aria-expanded={openPanel === 'login'}
          >
            <span>Inlogmethoden</span>
            <i aria-hidden>›</i>
          </button>
          {openPanel === 'login' ? (
            <div className="safety-panel">
              <p>Je kunt inloggen met Google of een lokaal Swipey-account gebruiken. Opgeslagen accounts blijven op dit apparaat beschikbaar.</p>
            </div>
          ) : null}
        </section>
        {notice ? <div className="yubo-toast" role="status">{notice}</div> : null}
      </div>
    </div>
  )
}

/* ——— Likes (Who liked you) — betaald ——— */
function LikesInboxColumn({
  unlocked,
  incoming,
  outgoingLikes,
  myUserId,
  notificationPermission,
  onEnableNotifications,
  onStartCheckout,
  onOpenFriendsRequests,
}: {
  unlocked: boolean
  incoming: IncomingItem[]
  outgoingLikes: LikedItem[]
  myUserId: string
  notificationPermission: NotificationPermission | 'unsupported'
  onEnableNotifications: () => void
  onStartCheckout: () => Promise<void>
  onOpenFriendsRequests: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [likesTermsOk, setLikesTermsOk] = useState(false)
  const [profileOpen, setProfileOpen] = useState<SwipeProfile | null>(null)
  const [profileReportReason, setProfileReportReason] = useState('ongepast')
  const [profileReportNote, setProfileReportNote] = useState('')
  const [profileReportThanks, setProfileReportThanks] = useState(false)

  const openProfile = (profile: SwipeProfile) => {
    if (isUserBanned(profile.liveUserId ?? profile.id)) return
    setProfileOpen(profile)
    setProfileReportReason('ongepast')
    setProfileReportNote('')
    setProfileReportThanks(false)
  }

  const submitProfileReport = () => {
    if (!profileOpen) return
    saveAdminReport({
      reporterUserId: myUserId,
      reportedUserId: profileOpen.liveUserId ?? profileOpen.id,
      reportedName: profileOpen.name,
      reason: profileReportReason,
      note: profileReportNote.trim(),
    })
    setProfileReportNote('')
    setProfileReportThanks(true)
    window.setTimeout(() => setProfileReportThanks(false), 3500)
  }

  const visibleIncoming = incoming.filter((row) => !isUserBanned(row.card.liveUserId ?? row.card.id))
  const visibleOutgoingLikes = outgoingLikes.filter((row) => !isUserBanned(row.card.liveUserId ?? row.card.id))

  if (!unlocked) {
    return (
      <div className="yubo-screen-chat">
        <p className="disco-hero" style={{ paddingTop: '0.5rem' }}>
          Who liked you
        </p>
        <div
          className="disco with-tabbar"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          <div className="likes-pay" role="region" aria-label="Likes+">
            <div className="likes-pay__icon" aria-hidden>
              ♥
            </div>
            <h2 className="likes-pay__h">Likes+</h2>
            <p className="likes-pay__p">
              Zie wie op jouw profielkan tikte en naar rechts swipete vóór jullie
              matchen. Likes+ per maand op dit apparaat.
            </p>
            <p className="likes-pay__price">€2,99 per maand</p>
            <p className="likes-pay__sub">
              <code>STRIPE_SECRET_KEY</code> moet met <code>sk_</code> beginnen (niet{' '}
              <code>pk_</code>). <code>STRIPE_LIKES_PRICE_ID</code> in <code>.env</code> en
              draai <code>npm run dev:stripe</code>.
            </p>
            {err ? (
              <p className="likes-pay__err" role="alert">
                {err}
              </p>
            ) : null}
            <label className="likes-pay__accept">
              <input
                type="checkbox"
                checked={likesTermsOk}
                onChange={(e) => setLikesTermsOk(e.target.checked)}
              />
              <span>
                Ik accepteer de voorwaarden en het Likes+ abonnement (per maand op dit
                apparaat).
              </span>
            </label>
            <button
              type="button"
              className="likes-pay__btn"
              disabled={loading || !likesTermsOk}
              onClick={() => {
                setErr(null)
                setLoading(true)
                void (async () => {
                  try {
                    await onStartCheckout()
                  } catch (e) {
                    setErr(formatStripeUserError(e))
                  } finally {
                    setLoading(false)
                  }
                })()
              }}
            >
              {loading ? 'Laden…' : 'Ontgrendel Likes+'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="yubo-screen-chat likes-inbox-screen">
      <header className="likes-inbox-top">
        <p className="likes-inbox-top__eyebrow">Activiteit</p>
        <h1 className="likes-inbox-top__title">Inbox</h1>
        <p className="likes-inbox-top__sub">
          Likes, toevoegingen en meldingen op een plek.
        </p>
      </header>
      <div
        className="disco with-tabbar likes-inbox-col"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <div className="likes-inbox__notify">
          <span className="likes-inbox__notify-ico" aria-hidden>
            🔔
          </span>
          <div>
            <strong>Meldingen</strong>
            <span>
              {notificationPermission === 'granted'
                ? 'Aan voor nieuwe berichten en requests'
                : notificationPermission === 'denied'
                  ? 'Geblokkeerd in je browser'
                  : notificationPermission === 'unsupported'
                    ? 'Niet ondersteund'
                    : 'Zet aan voor berichten en likes'}
            </span>
          </div>
          {notificationPermission === 'default' ? (
            <button type="button" onClick={onEnableNotifications}>
              Aanzetten
            </button>
          ) : null}
        </div>

        <section className="likes-inbox__section" aria-label="Mensen die jou hebben toegevoegd">
          <div className="likes-inbox__section-head">
            <h2 className="likes-inbox__h">Jou toegevoegd</h2>
            <span>{visibleIncoming.length}</span>
          </div>
          {visibleIncoming.length === 0 ? (
            <p className="likes-inbox__empty" role="status">
              Nog niemand heeft jou toegevoegd. Als iemand in <strong>Swipes</strong> naar
              rechts swipet op jouw profiel, verschijnt die persoon hier.
            </p>
          ) : (
            <ul className="likes-inbox__list" role="list" aria-label="Likes op jou">
              {visibleIncoming.map((row) => {
                const c = row.card
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="likes-inbox__row likes-inbox__row--button"
                      onClick={() => openProfile(c)}
                    >
                    <img
                      className="likes-inbox__av"
                      src={c.mainPhoto}
                      alt=""
                      width={48}
                      height={48}
                    />
                    <div className="likes-inbox__mid">
                      <div className="likes-inbox__name">{c.name}</div>
                      <p className="likes-inbox__user">@{c.username}</p>
                    </div>
                    <span className="likes-inbox__badge">liked jou</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="likes-inbox__section" aria-label="Mensen die jij hebt geliket">
          <div className="likes-inbox__section-head">
            <h2 className="likes-inbox__h">Jij liked</h2>
            <span>{visibleOutgoingLikes.length}</span>
          </div>
          {visibleOutgoingLikes.length === 0 ? (
            <p className="likes-inbox__empty" role="status">
              Je hebt nog niemand geliket. Swipe naar rechts op iemand om die hier te bewaren.
            </p>
          ) : (
            <ul className="likes-inbox__list" role="list" aria-label="Jouw likes">
              {visibleOutgoingLikes.map((row) => {
                const c = row.card
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="likes-inbox__row likes-inbox__row--button"
                      onClick={() => openProfile(c)}
                    >
                    <img
                      className="likes-inbox__av"
                      src={c.mainPhoto}
                      alt=""
                      width={48}
                      height={48}
                    />
                    <div className="likes-inbox__mid">
                      <div className="likes-inbox__name">{c.name}</div>
                      <p className="likes-inbox__user">@{c.username}</p>
                    </div>
                    <span className="likes-inbox__badge likes-inbox__badge--sent">jij liked</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <p className="likes-inbox__foot">
          Request accepteren of afwijzen:{' '}
          <button
            type="button"
            className="likes-inbox__link"
            onClick={onOpenFriendsRequests}
          >
            Friends → Requests
          </button>
        </p>
      </div>
      {profileOpen ? (
        <div
          className="yubo-profile-preview likes-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="likes-profile-title"
        >
          <header className="yubo-top compact" style={{ background: '#fff', flexShrink: 0 }}>
            <button
              className="yubo-back"
              type="button"
              onClick={() => setProfileOpen(null)}
              aria-label="Sluiten"
            >
              ‹
            </button>
            <h1 id="likes-profile-title" className="yubo-title">
              {profileOpen.name}
            </h1>
            <span style={{ width: 40 }} aria-hidden />
          </header>
          <div className="yubo-profile-preview__body with-tabbar">
            <div className="yubo-profile-preview__card">
              <div className="swipe-card">
                <SwipeProfileCard p={profileOpen} showExtra layout="full" />
              </div>
            </div>
            <section className="likes-profile-report" aria-label={`${profileOpen.name} melden`}>
              <h2>Melden</h2>
              <p>Zie je iets dat niet klopt? Stuur een report naar het admin panel.</p>
              <label className="visually-hidden" htmlFor="likes-profile-report-reason">
                Reden
              </label>
              <select
                id="likes-profile-report-reason"
                className="yubo-field"
                value={profileReportReason}
                onChange={(e) => setProfileReportReason(e.target.value)}
              >
                <option value="ongepast">Ongepast gedrag of content</option>
                <option value="fake">Fake profiel of spam</option>
                <option value="veiligheid">Onveilig gevoel</option>
                <option value="anders">Iets anders</option>
              </select>
              <label className="visually-hidden" htmlFor="likes-profile-report-note">
                Opmerking
              </label>
              <textarea
                id="likes-profile-report-note"
                className="yubo-field"
                value={profileReportNote}
                onChange={(e) => setProfileReportNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Leg kort uit wat er mis is…"
              />
              {profileReportThanks ? (
                <p className="likes-profile-report__thanks" role="status">
                  Report verzonden naar admin panel.
                </p>
              ) : null}
              <button
                type="button"
                className="likes-profile-report__btn"
                onClick={submitProfileReport}
              >
                Report versturen
              </button>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ——— Admin ——— */
function formatAdminTime(ts: number) {
  if (!ts) return 'onbekend'
  return new Date(ts).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AdminPanel({ onBack }: { onBack: () => void }) {
  const adminPassword = (import.meta.env.VITE_ADMIN_PASSWORD || 'admin123').trim()
  const allowedAdminIp = (import.meta.env.VITE_ADMIN_ALLOWED_IP || '').trim()
  const [ipCheck, setIpCheck] = useState<'checking' | 'allowed' | 'denied'>(
    allowedAdminIp ? 'checking' : 'allowed',
  )
  const [detectedIp, setDetectedIp] = useState('')
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem('swipey-admin-unlocked-v1') === '1'
    } catch {
      return false
    }
  })
  const [passwordDraft, setPasswordDraft] = useState('')
  const [authError, setAuthError] = useState('')
  const [stats, setStats] = useState<AdminStats>(() => getAdminStats())
  const [users, setUsers] = useState<AdminUserRow[]>(() => getAdminUsers())
  const [reports, setReports] = useState<AdminReport[]>(() => readAdminReports())
  const [bans, setBans] = useState(() => readBannedUsers())
  const [refreshing, setRefreshing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')

  useEffect(() => {
    if (!allowedAdminIp) return
    let dead = false
    ;(async () => {
      try {
        const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
        const j = (await r.json()) as { ip?: string }
        if (dead) return
        const ip = String(j.ip || '').trim()
        setDetectedIp(ip)
        setIpCheck(ip === allowedAdminIp ? 'allowed' : 'denied')
      } catch {
        if (!dead) setIpCheck('denied')
      }
    })()
    return () => {
      dead = true
    }
  }, [allowedAdminIp])

  const refresh = useCallback(async (syncRemote = true) => {
    if (syncRemote) {
      setRefreshing(true)
      const result = await syncSharedUsersDetailed()
      setSyncStatus(
        result.ok
          ? `Gedeelde gebruikers bijgewerkt: ${result.count} remote account${result.count === 1 ? '' : 's'}.`
          : `Kon gedeelde gebruikers niet ophalen${result.error ? ` (${result.error})` : ''}.`,
      )
      window.setTimeout(() => {
        setSyncStatus((current) =>
          current.startsWith('Gedeelde gebruikers bijgewerkt:') ||
          current.startsWith('Kon gedeelde gebruikers niet ophalen')
            ? ''
            : current,
        )
      }, 3500)
      setRefreshing(false)
    }
    setStats(getAdminStats())
    setUsers(getAdminUsers())
    setReports(readAdminReports())
    setBans(readBannedUsers())
  }, [])

  useEffect(() => {
    if (!unlocked) return
    void refresh()
    const t = window.setInterval(() => {
      void refresh(false)
    }, 2500)
    return () => window.clearInterval(t)
  }, [refresh, unlocked])

  const submitAdminPassword = (e: FormEvent) => {
    e.preventDefault()
    if (passwordDraft.trim() !== adminPassword) {
      setAuthError('Wachtwoord klopt niet.')
      return
    }
    try {
      sessionStorage.setItem('swipey-admin-unlocked-v1', '1')
    } catch {
      /* */
    }
    setAuthError('')
    setPasswordDraft('')
    setUnlocked(true)
    void refresh()
  }

  const toggleBan = (userId: string, name: string, banned: boolean) => {
    if (banned) unbanUser(userId)
    else banUser(userId, name)
    void refresh(false)
  }

  const clearEveryone = () => {
    if (!window.confirm('Alle lokale gebruikers, reports, bans, likes, requests en chats wissen?')) {
      return
    }
    clearAdminLocalData()
    void refresh(false)
  }

  return (
    <div className="yubo-screen-chat admin-screen">
      <header className="yubo-top compact admin-screen__head">
        <button className="yubo-back yubo-back--chevron" type="button" onClick={onBack} aria-label="Terug">
          ‹
        </button>
        <h1 className="yubo-title">Admin panel</h1>
        {unlocked ? (
          <button
            className="yubo-icon-btn admin-refresh"
            type="button"
            onClick={() => {
              void refresh()
            }}
            aria-label="Verversen"
            disabled={refreshing}
            title="Gedeelde gebruikers opnieuw ophalen"
          >
            {refreshing ? '…' : '↻'}
          </button>
        ) : (
          <span style={{ width: 32 }} aria-hidden />
        )}
      </header>

      <div className="admin-body with-tabbar">
        {ipCheck === 'checking' ? (
          <div className="admin-lock">
            <div className="admin-lock__icon" aria-hidden>
              🛡
            </div>
            <h2>Admin toegang controleren</h2>
            <p>Je IP-adres wordt gecontroleerd…</p>
          </div>
        ) : ipCheck === 'denied' ? (
          <div className="admin-lock admin-lock--denied">
            <div className="admin-lock__icon" aria-hidden>
              ⛔
            </div>
            <h2>Geen toegang</h2>
            <p>
              Dit admin panel is alleen toegestaan vanaf IP {allowedAdminIp}.
              {detectedIp ? ` Je huidige IP is ${detectedIp}.` : ''}
            </p>
            <button type="button" className="admin-lock__btn" onClick={onBack}>
              Terug
            </button>
          </div>
        ) : !unlocked ? (
          <form className="admin-lock" onSubmit={submitAdminPassword}>
            <div className="admin-lock__icon" aria-hidden>
              🛡
            </div>
            <h2>Admin toegang</h2>
            <p>Vul het admin-wachtwoord in om reports, gebruikers en bans te beheren.</p>
            <label className="visually-hidden" htmlFor="admin-password">
              Admin wachtwoord
            </label>
            <input
              id="admin-password"
              className="yubo-field"
              type="password"
              value={passwordDraft}
              onChange={(e) => {
                setPasswordDraft(e.target.value)
                if (authError) setAuthError('')
              }}
              placeholder="Admin wachtwoord"
              autoComplete="current-password"
              autoFocus
            />
            {authError ? (
              <p className="admin-lock__error" role="alert">
                {authError}
              </p>
            ) : null}
            <button type="submit" className="admin-lock__btn">
              Open admin panel
            </button>
          </form>
        ) : (
          <>
        {syncStatus ? (
          <p className="admin-sync-status" role="status">
            {syncStatus}
          </p>
        ) : null}
        <section className="admin-stats" aria-label="Statistieken">
          <div className="admin-stat">
            <strong>{stats.activeUsers}</strong>
            <span>nu actief</span>
          </div>
          <div className="admin-stat">
            <strong>{stats.liveUsers}</strong>
            <span>live</span>
          </div>
          <div className="admin-stat">
            <strong>{stats.reportCount}</strong>
            <span>reports</span>
          </div>
          <div className="admin-stat">
            <strong>{stats.bannedCount}</strong>
            <span>bans</span>
          </div>
        </section>

        <section className="admin-danger-zone" aria-label="Admin acties">
          <div>
            <strong>Alles leegmaken</strong>
            <span>Wist alle lokale gebruikers, chats, likes, requests, reports en bans.</span>
          </div>
          <button type="button" onClick={clearEveryone}>
            Iedereen verwijderen
          </button>
        </section>

        <section className="admin-section">
          <h2>Reports</h2>
          {reports.length === 0 ? (
            <p className="admin-empty">Nog geen reports.</p>
          ) : (
            <ul className="admin-list" role="list">
              {reports.map((report) => {
                const banned = bans.some((b) => b.userId === report.reportedUserId)
                return (
                  <li key={report.id} className="admin-card">
                    <div className="admin-card__main">
                      <strong>{report.reportedName}</strong>
                      <span>{formatAdminTime(report.at)} · {report.reason}</span>
                      {report.note ? <p>{report.note}</p> : null}
                    </div>
                    <button
                      type="button"
                      className={banned ? 'admin-ban admin-ban--undo' : 'admin-ban'}
                      onClick={() => toggleBan(report.reportedUserId, report.reportedName, banned)}
                    >
                      {banned ? 'Unban' : 'Ban'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="admin-section">
          <h2>Gebruikers</h2>
          {users.length === 0 ? (
            <p className="admin-empty">Nog geen actieve profielen gevonden.</p>
          ) : (
            <ul className="admin-list" role="list">
              {users.map((user) => (
                <li key={user.userId} className="admin-card admin-card--user">
                  <img src={user.mainPhoto} alt="" width={42} height={42} />
                  <div className="admin-card__main">
                    <strong>{user.name}</strong>
                    <span>
                      @{user.username} · {user.isStreaming ? 'live' : user.isActive ? 'actief' : 'offline'}
                    </span>
                    <small>Laatst gezien: {formatAdminTime(user.lastSeen)}</small>
                  </div>
                  <button
                    type="button"
                    className={user.isBanned ? 'admin-ban admin-ban--undo' : 'admin-ban'}
                    onClick={() => toggleBan(user.userId, user.name, user.isBanned)}
                  >
                    {user.isBanned ? 'Unban' : 'Ban'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
          </>
        )}
      </div>
    </div>
  )
}

/* ——— Helpcenter ——— */
type HelpArticle = {
  id: string
  category: string
  title: string
  body: string
}

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'start',
    category: 'Account',
    title: 'Account aanmaken en inloggen',
    body: 'Log in met Google of kies Aan de slag. Daarna vul je je bijnaam, leeftijd, ID-check en face-check in. Bestaande accounts vind je via Inloggen op bestaand account.',
  },
  {
    id: 'profile',
    category: 'Profiel',
    title: 'Profiel, foto’s en tags aanpassen',
    body: 'Ga naar Menu > Account. Daar kun je je naam, foto’s, bio, beroep en tags aanpassen. Je profiel verschijnt daarna in Swipes voor andere accounts.',
  },
  {
    id: 'swipes',
    category: 'Swipes',
    title: 'Mensen zoeken, liken en matchen',
    body: 'Gebruik Swipes om mensen te liken. In Friends kun je zoeken op naam, @gebruikersnaam of tags. Je likes en mensen die jou toevoegden staan in de Inbox.',
  },
  {
    id: 'chat',
    category: 'Chats',
    title: 'Chatten, GIFs en spraakberichten',
    body: 'Open Chats na een match. Je kunt tekst, foto’s, GIFs en spraakberichten sturen. Als iemand typt zie je een typing-indicator.',
  },
  {
    id: 'live',
    category: 'Live',
    title: 'Live gaan en kijkers zien',
    body: 'Open Friends > Live. Start je camera om live te gaan. Je ziet hoeveel kijkers er zijn en live chats komen binnen op je livekaart.',
  },
  {
    id: 'safety',
    category: 'Veiligheid',
    title: 'Iemand melden of blokkeren',
    body: 'Open een profiel en gebruik Report versturen. Reports komen in het admin panel. Admins kunnen gebruikers bannen; gebande profielen verdwijnen uit zoekresultaten, chats en inbox.',
  },
  {
    id: 'shop',
    category: 'Shop',
    title: 'Coins, shopitems en Stripe',
    body: 'In Shop kun je coins aanvullen en items kopen. Gekochte items komen eerst in bezit. Thema’s activeer je apart met Activeren.',
  },
  {
    id: 'admin',
    category: 'Admin',
    title: 'Admin panel gebruiken',
    body: 'Ga naar Menu > Admin panel. Alleen het ingestelde IP en wachtwoord krijgen toegang. Daar zie je reports, actieve gebruikers, bans en kun je lokale data wissen.',
  },
]

function HelpCenterScreen({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = HELP_ARTICLES.filter((article) =>
    [article.category, article.title, article.body]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
  const categories = [...new Set(HELP_ARTICLES.map((article) => article.category))]

  return (
    <div className="yubo-screen-chat help-screen">
      <header className="yubo-top compact help-screen__head">
        <button className="yubo-back yubo-back--chevron" type="button" onClick={onBack} aria-label="Terug">
          ‹
        </button>
        <h1 className="yubo-title">Swipey Help</h1>
        <span style={{ width: 32 }} aria-hidden />
      </header>

      <div className="help-body with-tabbar">
        <section className="help-hero" aria-label="Help zoeken">
          <p className="help-hero__eyebrow">Helpcentrum</p>
          <h2>Waarmee kunnen we helpen?</h2>
          <label className="visually-hidden" htmlFor="swipey-help-search">
            Zoek in help
          </label>
          <input
            id="swipey-help-search"
            className="help-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op account, live, chat, report…"
            autoComplete="off"
          />
        </section>

        {!q ? (
          <div className="help-cats" aria-label="Categorieën">
            {categories.map((cat) => (
              <button key={cat} type="button" onClick={() => setQuery(cat)}>
                <span aria-hidden>
                  {cat === 'Account'
                    ? '👤'
                    : cat === 'Profiel'
                      ? '🖼'
                      : cat === 'Swipes'
                        ? '💚'
                        : cat === 'Chats'
                          ? '💬'
                          : cat === 'Live'
                            ? '📹'
                            : cat === 'Veiligheid'
                              ? '🛡'
                              : cat === 'Shop'
                                ? '🪙'
                                : '⚙'}
                </span>
                {cat}
              </button>
            ))}
          </div>
        ) : null}

        <section className="help-section" aria-label="Help-artikelen">
          <h2>{q ? 'Zoekresultaten' : 'Populaire artikelen'}</h2>
          {filtered.length === 0 ? (
            <p className="help-empty">Geen artikel gevonden. Probeer een andere zoekterm.</p>
          ) : (
            <ul className="help-list" role="list">
              {filtered.map((article) => (
                <li key={article.id} className="help-article">
                  <span>{article.category}</span>
                  <h3>{article.title}</h3>
                  <p>{article.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoScreen({
  title,
  eyebrow,
  intro,
  articles,
  tone = 'help',
  onBack,
}: {
  title: string
  eyebrow: string
  intro: string
  articles: HelpArticle[]
  tone?: 'help' | 'community' | 'legal'
  onBack: () => void
}) {
  return (
    <div className="yubo-screen-chat help-screen">
      <header className="yubo-top compact help-screen__head">
        <button className="yubo-back yubo-back--chevron" type="button" onClick={onBack} aria-label="Terug">
          ‹
        </button>
        <h1 className="yubo-title">{title}</h1>
        <span style={{ width: 32 }} aria-hidden />
      </header>

      <div className="help-body with-tabbar">
        <section className={`help-hero help-hero--${tone}`} aria-label={title}>
          <p className="help-hero__eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{intro}</p>
          <div className="help-hero__chips" aria-label="Belangrijke onderdelen">
            {articles.slice(0, 3).map((article) => (
              <span key={article.id}>{article.category}</span>
            ))}
          </div>
        </section>

        <section className="help-section" aria-label={`${title} artikelen`}>
          <h2>{tone === 'legal' ? 'Voorwaarden' : 'Belangrijk'}</h2>
          <ul className="help-list" role="list">
            {articles.map((article) => (
              <li key={article.id} className="help-article">
                <span>{article.category}</span>
                <h3>{article.title}</h3>
                <p>{article.body}</p>
              </li>
            ))}
          </ul>
          {tone === 'legal' ? (
            <p className="help-legal-note">
              Laatst bijgewerkt: vandaag. Voor betalingen loopt de afhandeling via Stripe en
              gelden ook de voorwaarden van de betaalprovider.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}

const COMMUNITY_ARTICLES: HelpArticle[] = [
  {
    id: 'respect',
    category: 'Gedrag',
    title: 'Wees respectvol',
    body: 'Geen haat, intimidatie, pesten, bedreigingen of seksuele druk. Behandel anderen alsof je ze in het echt spreekt.',
  },
  {
    id: 'real-profile',
    category: 'Profiel',
    title: 'Gebruik een eerlijk profiel',
    body: 'Gebruik je eigen naam of bijnaam en plaats geen misleidende foto’s, spam of impersonatie van iemand anders.',
  },
  {
    id: 'safe-chat',
    category: 'Chat',
    title: 'Hou chats veilig',
    body: 'Deel geen privégegevens zoals adres, wachtwoorden, bankgegevens of gevoelige foto’s. Meld gesprekken die onveilig voelen.',
  },
  {
    id: 'report',
    category: 'Melden',
    title: 'Meld misbruik',
    body: 'Gebruik de report-knop bij profielen of chats. Meldingen komen in het admin panel waar een beheerder gebruikers kan bannen.',
  },
  {
    id: 'age-safety',
    category: 'Leeftijd',
    title: 'Respecteer leeftijd en grenzen',
    body: 'Gebruik alleen je echte leeftijd en ga niet door als iemand aangeeft geen contact te willen.',
  },
]

function CommunityGuidelinesScreen({ onBack }: { onBack: () => void }) {
  return (
    <InfoScreen
      title="Community-richtlijnen"
      eyebrow="Swipey veiligheid"
      intro="Duidelijke regels voor respect, veiligheid en echte profielen."
      articles={COMMUNITY_ARTICLES}
      tone="community"
      onBack={onBack}
    />
  )
}

const LEGAL_ARTICLES: HelpArticle[] = [
  {
    id: 'terms',
    category: 'Voorwaarden',
    title: 'Gebruik van Swipey',
    body: 'Je gebruikt Swipey alleen op een respectvolle manier. Spam, misleiding, bedreiging, intimidatie en misbruik van chat, reports of shopfuncties zijn niet toegestaan.',
  },
  {
    id: 'privacy',
    category: 'Privacy',
    title: 'Lokale opslag',
    body: 'Profielen, chats, swipes, likes en instellingen worden op dit moment lokaal in je browser opgeslagen. Je kunt browserdata wissen of het admin panel gebruiken om lokale gegevens te verwijderen.',
  },
  {
    id: 'payments',
    category: 'Aankopen',
    title: 'Shop, coins en premium',
    body: 'Aankopen voor coins, Discover+, Likes+ en Premium zijn gekoppeld aan je appgebruik. Betalingen verlopen via Stripe wanneer checkout is ingesteld.',
  },
  {
    id: 'safety',
    category: 'Veiligheid',
    title: 'Meldingen en bans',
    body: 'Reports kunnen door beheerders worden bekeken. Een ban verbergt profielen uit zoekresultaten, swipes, inbox en chats waar dat technisch mogelijk is.',
  },
  {
    id: 'contact',
    category: 'Contact',
    title: 'Vragen of verwijderverzoek',
    body: 'Neem contact op met de beheerder van deze app als je vragen hebt over accountgegevens, betalingen of het verwijderen van opgeslagen informatie.',
  },
]

function LegalScreen({ onBack }: { onBack: () => void }) {
  return (
    <InfoScreen
      title="Juridisch"
      eyebrow="Voorwaarden en privacy"
      intro="Een duidelijk overzicht van gebruik, privacy, betalingen en veiligheid."
      articles={LEGAL_ARTICLES}
      tone="legal"
      onBack={onBack}
    />
  )
}

function MatchPreferencesScreen({
  value,
  onChange,
  onBack,
  onOpenSwipes,
}: {
  value: MatchPreferences
  onChange: (value: MatchPreferences) => void
  onBack: () => void
  onOpenSwipes: () => void
}) {
  const setGender = (gender: MatchGenderPreference) => onChange({ ...value, gender })
  const setMinAge = (raw: number) => {
    const minAge = Math.min(raw, value.maxAge)
    onChange({ ...value, minAge })
  }
  const setMaxAge = (raw: number) => {
    const maxAge = Math.max(raw, value.minAge)
    onChange({ ...value, maxAge })
  }

  return (
    <div className="yubo-screen-chat match-pref-screen">
      <header className="yubo-top compact match-pref-top" style={{ flexShrink: 0 }}>
        <button
          className="yubo-back yubo-back--chevron"
          type="button"
          onClick={onBack}
          aria-label="Terug"
        >
          ‹
        </button>
        <h1 className="yubo-title">Match-voorkeuren</h1>
        <span style={{ width: 32 }} aria-hidden />
      </header>

      <div className="match-pref-body with-tabbar">
        <section className="match-pref-section">
          <h2>Gender</h2>
          <div className="match-pref-card match-pref-card--choices">
            {(['man', 'vrouw', 'iedereen'] as MatchGenderPreference[]).map((gender) => (
              <button
                key={gender}
                type="button"
                className="match-pref-choice"
                onClick={() => setGender(gender)}
                aria-pressed={value.gender === gender}
              >
                <span aria-hidden>{value.gender === gender ? '✓' : ''}</span>
                {gender === 'man' ? 'Man' : gender === 'vrouw' ? 'Vrouw' : 'Iedereen'}
              </button>
            ))}
          </div>
        </section>

        <section className="match-pref-section">
          <div className="match-pref-section__head">
            <h2>Leeftijd</h2>
            <strong>{value.minAge}-{value.maxAge}</strong>
          </div>
          <div className="match-pref-card">
            <div className="match-pref-range match-pref-range--dual">
              <input
                type="range"
                min={13}
                max={99}
                value={value.minAge}
                onChange={(e) => setMinAge(Number(e.target.value))}
                aria-label="Minimum leeftijd"
              />
              <input
                type="range"
                min={13}
                max={99}
                value={value.maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value))}
                aria-label="Maximum leeftijd"
              />
            </div>
            <label className="match-pref-toggle">
              <span>Als er geen profielen meer zijn, toon tot 3 jaar buiten je voorkeur.</span>
              <input
                type="checkbox"
                checked={value.flexibleAge}
                onChange={(e) => onChange({ ...value, flexibleAge: e.target.checked })}
              />
            </label>
          </div>
        </section>

        <section className="match-pref-section">
          <h2>Locatie</h2>
          <label className="match-pref-card match-pref-toggle match-pref-toggle--row">
            <span>In je buurt</span>
            <input
              type="checkbox"
              checked={value.nearbyOnly && value.locationEnabled}
              disabled={!value.locationEnabled}
              onChange={(e) => onChange({ ...value, nearbyOnly: e.target.checked })}
            />
          </label>
          {!value.locationEnabled ? (
            <p className="match-pref-help">
              Zet locatie aan via Veiligheid en privacy om “In je buurt” te gebruiken.
            </p>
          ) : null}
        </section>

        <section className="match-pref-section">
          <div className="match-pref-section__head">
            <h2>Maximale afstand</h2>
            <strong>{value.maxDistanceKm} km</strong>
          </div>
          <div className="match-pref-card">
            <div className="match-pref-range">
              <input
                type="range"
                min={1}
                max={500}
                value={value.maxDistanceKm}
                onChange={(e) => onChange({ ...value, maxDistanceKm: Number(e.target.value) })}
                aria-label="Maximale afstand"
              />
            </div>
          </div>
          <p className="match-pref-help">
            Als we geen profielen meer hebben, kunnen we mensen tonen die verder weg zijn.
          </p>
        </section>

        <button type="button" className="match-pref-cta" onClick={onOpenSwipes}>
          Bekijk Swipes
        </button>
      </div>
    </div>
  )
}

function PushPreferencesScreen({
  value,
  onChange,
  notificationPermission,
  onEnableNotifications,
  onBack,
}: {
  value: PushPreferences
  onChange: (value: PushPreferences) => void
  notificationPermission: NotificationPermission | 'unsupported'
  onEnableNotifications: () => void
  onBack: () => void
}) {
  const rows: Array<{ key: keyof PushPreferences; label: string }> = [
    { key: 'newFriends', label: 'Nieuwe vrienden' },
    { key: 'friendRequests', label: 'Vriendschapsverzoeken' },
    { key: 'reactions', label: 'Reacties ontvangen' },
    { key: 'friendsLive', label: 'Je vrienden gaan live' },
    { key: 'messages', label: 'Berichten ontvangen' },
  ]

  return (
    <div className="yubo-screen-chat push-pref-screen">
      <header className="yubo-top compact push-pref-top" style={{ flexShrink: 0 }}>
        <button
          className="yubo-back yubo-back--chevron"
          type="button"
          onClick={onBack}
          aria-label="Terug"
        >
          ‹
        </button>
        <h1 className="yubo-title">Pushberichten</h1>
        <span style={{ width: 32 }} aria-hidden />
      </header>

      <div className="push-pref-body with-tabbar">
        {notificationPermission !== 'granted' ? (
          <section className="push-pref-permission">
            <strong>
              {notificationPermission === 'denied'
                ? 'Meldingen zijn geblokkeerd'
                : notificationPermission === 'unsupported'
                  ? 'Meldingen worden niet ondersteund'
                  : 'Zet meldingen aan'}
            </strong>
            <p>
              Deze switches bewaren je voorkeuren. Browsermeldingen werken pas nadat je
              toestemming hebt gegeven.
            </p>
            {notificationPermission === 'default' ? (
              <button type="button" onClick={onEnableNotifications}>
                Toestemming vragen
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="push-pref-card" aria-label="Pushbericht voorkeuren">
          {rows.map((row) => (
            <label key={row.key} className="push-pref-row">
              <span>{row.label}</span>
              <input
                type="checkbox"
                checked={value[row.key]}
                onChange={(e) => onChange({ ...value, [row.key]: e.target.checked })}
              />
            </label>
          ))}
        </section>
      </div>
    </div>
  )
}

/* ——— Menu / Instellingen (Yubo-achtig) ——— */
function MenuPanel({
  displayName,
  didCompleteAgeFlow,
  profilePhotoUrl,
  onOpenProfile,
  onOpenMuted,
  onOpenPush,
  onOpenShop,
  onOpenPremium,
  onOpenAdmin,
  onOpenHelp,
  onOpenCommunity,
  onOpenLegal,
  onShareInvite,
  premiumUnlocked,
  premiumPlanLabel,
  userCoins,
  onBackFromMenu,
  onGoSwipes,
  onLogout,
}: {
  displayName: string
  didCompleteAgeFlow: boolean
  profilePhotoUrl: string
  onOpenProfile: () => void
  onOpenMuted: () => void
  onOpenPush: () => void
  onOpenShop: () => void
  onOpenPremium: () => void
  onOpenAdmin: () => void
  onOpenHelp: () => void
  onOpenCommunity: () => void
  onOpenLegal: () => void
  onShareInvite: () => void
  premiumUnlocked: boolean
  premiumPlanLabel: string
  userCoins: number
  onBackFromMenu: () => void
  onGoSwipes: () => void
  onLogout: () => void
}) {
  const nm = (displayName || 'Profiel').trim() || 'Profiel'

  const onRestorePurchases = () => {
    onOpenShop()
  }

  return (
    <div className="yubo-screen-chat settings-screen">
      <header className="yubo-top compact settings-screen__head">
        <button
          className="yubo-back yubo-back--chevron"
          type="button"
          onClick={onBackFromMenu}
          aria-label="Sluiten"
        >
          ‹
        </button>
        <h1 className="yubo-title" style={{ fontSize: '1.02rem' }}>
          Instellingen
        </h1>
        <span style={{ width: 32 }} aria-hidden />
      </header>
      <div
        className="yubo-main with-tabbar settings-screen__body"
        role="navigation"
        aria-label="Instellingen en account"
      >
        <button
          type="button"
          className="settings-hero"
          onClick={onOpenProfile}
          aria-label="Profiel bewerken"
        >
          <img
            className="settings-hero__img"
            src={profilePhotoUrl}
            alt=""
            width={56}
            height={56}
            decoding="async"
          />
          <div className="settings-hero__text">
            <div className="settings-hero__name">
              <span>{nm}</span>
              {didCompleteAgeFlow ? (
                <span className="settings-hero__verified" aria-label="Paspoort geverifieerd">
                  ✓
                </span>
              ) : null}
            </div>
            <div className="settings-hero__sub">
              {didCompleteAgeFlow ? (
                <span className="settings-hero__id">Paspoort geverifieerd</span>
              ) : null}
              {didCompleteAgeFlow ? ' · ' : null}
              Foto, tags, bio, werk
            </div>
          </div>
          <span className="settings-hero__chev" aria-hidden>›</span>
        </button>

        <div className="settings-group">
          <p className="settings-group__label" aria-hidden>
            Account
          </p>
          <div className="settings-group__box">
            <Row
              ico="👤"
              icoClass="settings-ico--blue"
              label="Account"
              onClick={onOpenProfile}
            />
            <Row
              ico="🔒"
              icoClass="settings-ico--orange"
              label="Veiligheid en privacy"
              onClick={onOpenMuted}
            />
            <Row
              ico="🔔"
              icoClass="settings-ico--coral"
              label="Pushberichten"
              onClick={onOpenPush}
            />
            <Row
              ico="🛡"
              icoClass="settings-ico--admin"
              label="Admin panel"
              isLast
              onClick={onOpenAdmin}
            />
          </div>
        </div>

        <div className="settings-group">
          <p className="settings-group__label" aria-hidden>
            Ontdekken
          </p>
          <div className="settings-group__box">
            <Row
              ico="✦"
              icoClass="settings-ico--teal"
              label="Match en Swipes"
              onClick={onGoSwipes}
            />
            <Row
              ico="🎁"
              icoClass="settings-ico--gift"
              label="Swipey delen (+10 coins)"
              isLast
              onClick={onShareInvite}
            />
          </div>
        </div>

        <div className="settings-group">
          <p className="settings-group__label" aria-hidden>
            Hulp
          </p>
          <div className="settings-group__box">
            <Row
              ico="?"
              icoClass="settings-ico--info"
              label="Hulp"
              onClick={onOpenHelp}
            />
            <Row
              ico="📋"
              icoClass="settings-ico--yellow"
              label="Community-richtlijnen"
              onClick={onOpenCommunity}
            />
            <Row
              ico="📖"
              icoClass="settings-ico--book"
              label="Juridisch"
              isLast
              onClick={onOpenLegal}
            />
          </div>
        </div>

        <div className="settings-group">
          <p className="settings-group__label" aria-hidden>
            Aankopen
          </p>
          <div className="settings-group__box">
            <Row
              ico="↻"
              icoClass="settings-ico--violet"
              label="Aankopen herstellen (Shop / Premium)"
              isLast
              onClick={onRestorePurchases}
            />
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group__box">
            <Row
              ico="🚪"
              icoClass="settings-ico--grey"
              label="Uitloggen"
              isDanger={false}
              onClick={() => {
                if (window.confirm('Wil je uitloggen en terug naar het startscherm?')) {
                  onLogout()
                }
              }}
            />
            <Row
              ico="🗑"
              icoClass="settings-ico--red"
              label="Account wissen"
              isLast
              isDanger
              onClick={() => {
                if (
                  window.confirm(
                    'Dit wist lokaal je sessie (zoals uitloggen). Doorgaan?',
                  )
                ) {
                  onLogout()
                }
              }}
            />
          </div>
        </div>

        <div className="settings-bonus" role="region" aria-label="Abonnement en shop op deze site">
          <p className="settings-bonus__label">In deze app</p>
          <button
            className="settings-bonus__btn"
            type="button"
            onClick={onOpenPremium}
          >
            {premiumUnlocked ? '✓ ' : ''}Swipey Premium
            <span>
              {premiumUnlocked
                ? `actief — ${premiumPlanLabel}`
                : '1, 3 of 12 maanden — extra bereik, stijl en coins'}
            </span>
          </button>
          <button
            className="settings-bonus__btn"
            type="button"
            onClick={onOpenShop}
          >
            Shop
            <span>🪙 {userCoins} coins</span>
          </button>
        </div>
        <p className="settings-foot">Swipey</p>
      </div>
    </div>
  )
}

function Row({
  ico,
  icoClass,
  label,
  onClick,
  isLast,
  isDanger,
}: {
  ico: string
  icoClass: string
  label: string
  onClick: () => void
  isLast?: boolean
  isDanger?: boolean
}) {
  return (
    <button
      className={'settings-row' + (isLast ? ' settings-row--last' : '')}
      type="button"
      onClick={onClick}
    >
      <span className={'settings-row__ico ' + icoClass} aria-hidden>
        {ico}
      </span>
      <span
        className={
          'settings-row__text' + (isDanger ? ' settings-row__text--danger' : '')
        }
      >
        {label}
      </span>
      <span className="settings-row__chev" aria-hidden>
        ›
      </span>
    </button>
  )
}
