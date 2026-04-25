/**
 * Zonder server: "wie swipt op jou" via localStorage + BroadcastChannel
 * (zelfde app, andere tab / ander profiel, zelfde origin).
 */

import type { SwipeProfile } from '../yubo/discoverData'
import {
  readLocalAdminUsers,
  readLocalSwipeProfilesForMe,
  upsertLocalUserFromSwipeProfile,
} from './localUserDb'
import { THREAD_KEY_PREFIX, randomId } from './realChatSync'

export const BC_LIVE = 'swipey-live-v1'

const LS_LIVE = 'swipey-live-pub-v1'
const LS_IN = 'swipey-incoming-v1'
const LS_ACPT = 'swipey-accepted-pending-v1'
const LS_LIKED = 'swipey-liked-outgoing-v1'
const LS_VIEWERS = 'swipey-live-viewers-v1'
const LS_REPORTS = 'swipey-admin-reports-v1'
const LS_BANS = 'swipey-admin-bans-v1'
const LS_LIVE_JOINS = 'swipey-live-join-requests-v1'

export type LiveProfilePub = {
  userId: string
  name: string
  username: string
  mainPhoto: string
  extraPhotos: string[]
  city: string
  age: number
  bio: string
  profession: string
  company: string
  tags: SwipeProfile['tags']
  isStreaming?: boolean
  streamTitle?: string
  streamStartedAt?: number
  ts: number
}

export type IncomingItem = {
  id: string
  fromUserId: string
  at: number
  card: SwipeProfile
}

export type LikedItem = {
  id: string
  at: number
  card: SwipeProfile
}

export type AdminReport = {
  id: string
  at: number
  reporterUserId: string
  reportedUserId: string
  reportedName: string
  reason: string
  note: string
}

export type AdminUserRow = {
  userId: string
  name: string
  username: string
  mainPhoto: string
  lastSeen: number
  isActive: boolean
  isStreaming: boolean
  isBanned: boolean
}

export type AdminStats = {
  totalUsers: number
  activeUsers: number
  liveUsers: number
  reportCount: number
  bannedCount: number
}

export type LiveJoinRequest = {
  id: string
  streamerUserId: string
  viewerUserId: string
  viewerName: string
  viewerPhoto: string
  at: number
  status: 'pending' | 'accepted' | 'declined'
}

type IncomingMap = Record<string, IncomingItem[]>
type LikedMap = Record<string, LikedItem[]>
type ViewerMap = Record<string, Record<string, number>>
type BanMap = Record<string, { userId: string; name: string; at: number }>
type LiveJoinMap = Record<string, LiveJoinRequest[]>

type LiveMap = Record<string, LiveProfilePub>
type AcptMap = Record<string, SwipeProfile[]>

function readLiveMap(): LiveMap {
  try {
    const s = localStorage.getItem(LS_LIVE)
    if (!s) return {}
    const o = JSON.parse(s) as LiveMap
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeLiveMap(m: LiveMap) {
  try {
    localStorage.setItem(LS_LIVE, JSON.stringify(m))
  } catch {
    /* */
  }
}

function readIncomingMap(): IncomingMap {
  try {
    const s = localStorage.getItem(LS_IN)
    if (!s) return {}
    const o = JSON.parse(s) as IncomingMap
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeIncomingMap(m: IncomingMap) {
  try {
    localStorage.setItem(LS_IN, JSON.stringify(m))
  } catch {
    /* */
  }
}

function readLikedMap(): LikedMap {
  try {
    const s = localStorage.getItem(LS_LIKED)
    if (!s) return {}
    const o = JSON.parse(s) as LikedMap
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeLikedMap(m: LikedMap) {
  try {
    localStorage.setItem(LS_LIKED, JSON.stringify(m))
  } catch {
    /* */
  }
}

function readViewerMap(): ViewerMap {
  try {
    const s = localStorage.getItem(LS_VIEWERS)
    if (!s) return {}
    const o = JSON.parse(s) as ViewerMap
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeViewerMap(m: ViewerMap) {
  try {
    localStorage.setItem(LS_VIEWERS, JSON.stringify(m))
  } catch {
    /* */
  }
}

function readBanMap(): BanMap {
  try {
    const s = localStorage.getItem(LS_BANS)
    if (!s) return {}
    const o = JSON.parse(s) as BanMap
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeBanMap(m: BanMap) {
  try {
    localStorage.setItem(LS_BANS, JSON.stringify(m))
  } catch {
    /* */
  }
}

function readLiveJoinMap(): LiveJoinMap {
  try {
    const s = localStorage.getItem(LS_LIVE_JOINS)
    if (!s) return {}
    const o = JSON.parse(s) as LiveJoinMap
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeLiveJoinMap(m: LiveJoinMap) {
  try {
    localStorage.setItem(LS_LIVE_JOINS, JSON.stringify(m))
  } catch {
    /* */
  }
}

export function isUserBanned(userId: string | undefined): boolean {
  if (!userId) return false
  return Boolean(readBanMap()[userId])
}

export function readBannedUsers() {
  return Object.values(readBanMap()).sort((a, b) => b.at - a.at)
}

export function banUser(userId: string, name = 'Gebruiker') {
  if (!userId) return
  const m = readBanMap()
  m[userId] = { userId, name, at: Date.now() }
  writeBanMap(m)
  postLive_bc()
}

export function unbanUser(userId: string) {
  const m = readBanMap()
  delete m[userId]
  writeBanMap(m)
  postLive_bc()
}

export function readAdminReports(): AdminReport[] {
  try {
    const s = localStorage.getItem(LS_REPORTS)
    if (!s) return []
    const list = JSON.parse(s) as AdminReport[]
    return Array.isArray(list) ? list.sort((a, b) => b.at - a.at) : []
  } catch {
    return []
  }
}

export function saveAdminReport(report: Omit<AdminReport, 'id' | 'at'>) {
  const next: AdminReport = { id: randomId(), at: Date.now(), ...report }
  try {
    localStorage.setItem(LS_REPORTS, JSON.stringify([next, ...readAdminReports()].slice(0, 200)))
  } catch {
    /* */
  }
  postLive_bc()
}

function postLive_bc() {
  try {
    const c = new BroadcastChannel(BC_LIVE)
    c.postMessage({ v: 1 as const, t: 'tick' as const })
    c.close()
  } catch {
    /* */
  }
}

export function slugName(name: string) {
  const s = name
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || 'gebruiker'
}

export function mainPhotoForUserId(userId: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(userId)}/500/800`
}

const LIVE_FRESH_MS = 45_000

export function livePubToSwipeProfile(p: LiveProfilePub): SwipeProfile {
  const fresh = Date.now() - (p.ts ?? 0) < LIVE_FRESH_MS
  const isStreaming = Boolean(p.isStreaming && fresh)
  return {
    id: `livecard-${p.userId}`,
    name: p.name,
    age: p.age,
    city: isStreaming ? 'Live' : fresh ? 'Actief' : 'Offline',
    username: p.username,
    mainPhoto: p.mainPhoto,
    extraPhotos: p.extraPhotos.length ? p.extraPhotos : [p.mainPhoto],
    tags: p.tags,
    bio: p.bio,
    profession: p.profession,
    company: p.company,
    liveUserId: p.userId,
    isStreaming,
    streamTitle: p.streamTitle,
    streamStartedAt: p.streamStartedAt,
  }
}

/**
 * Alle in deze browser opgeslagen profiel-publicaties (zelfde origin) behalve jezelf.
 * Geen tijd-filter: iedereen met een gepubliceerd profiel blijft in de pool tot overschreven
 * of localStorage wissen — zo ontstaat geen lege stack terwijl de ander nog bestaat.
 */
function readAcptMap(): AcptMap {
  try {
    const s = localStorage.getItem(LS_ACPT)
    if (!s) return {}
    const o = JSON.parse(s) as AcptMap
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeAcptMap(m: AcptMap) {
  try {
    localStorage.setItem(LS_ACPT, JSON.stringify(m))
  } catch {
    /* */
  }
}

/**
 * Na vriend-accept: de *andere* partij krijgt later dit profiel in Chats.
 */
export function queueChatAfterAccept(targetUserId: string, accepterProfile: SwipeProfile) {
  if (!targetUserId) return
  const m = readAcptMap()
  const list = m[targetUserId] ? [...m[targetUserId]] : []
  const uid = accepterProfile.liveUserId
  if (uid && list.some((p) => p.liveUserId === uid)) {
    return
  }
  m[targetUserId] = [accepterProfile, ...list]
  writeAcptMap(m)
  postLive_bc()
}

export function takeChatsAfterAcceptForMe(userId: string): SwipeProfile[] {
  const m = readAcptMap()
  const list = m[userId]
  if (!list?.length) return []
  delete m[userId]
  writeAcptMap(m)
  return list
}

export function getSwipeableLiveProfilesForMe(myUserId: string): SwipeProfile[] {
  const me = String(myUserId ?? '')
    .trim()
    .toLowerCase()
  if (!me) return []
  const m = readLiveMap()
  /** Eén kaart per tegenspeler (zelfde userId kan theoretisch dubbel in de map voorkomen). */
  const byPeer = new Map<string, SwipeProfile>()
  for (const card of readLocalSwipeProfilesForMe(myUserId)) {
    const uid = String(card.liveUserId ?? '').trim().toLowerCase()
    if (!uid || uid === me) continue
    if (isUserBanned(card.liveUserId)) continue
    byPeer.set(uid, card)
  }
  for (const [key, p] of Object.entries(m)) {
    if (!p || !p.userId) continue
    const k = String(key)
      .trim()
      .toLowerCase()
    const uid = String(p.userId)
      .trim()
      .toLowerCase()
    if (k === me || uid === me) continue
    if (isUserBanned(p.userId)) continue
    const card = livePubToSwipeProfile(p)
    if (!card.liveUserId) continue
    if (String(card.liveUserId).trim().toLowerCase() === me) continue
    const peerKey = String(card.liveUserId).trim().toLowerCase()
    byPeer.set(peerKey, card)
  }
  return [...byPeer.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'nl'),
  )
}

export function getStreamingLiveProfilesForUserIds(userIds: string[]): SwipeProfile[] {
  const wanted = new Set(
    userIds
      .map((id) => String(id ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  if (wanted.size === 0) return []
  const m = readLiveMap()
  const live: SwipeProfile[] = []
  for (const p of Object.values(m)) {
    const uid = String(p?.userId ?? '').trim().toLowerCase()
    if (!uid || !wanted.has(uid)) continue
    if (isUserBanned(p.userId)) continue
    const card = livePubToSwipeProfile(p)
    if (card.isStreaming) live.push(card)
  }
  return live.sort((a, b) => (b.streamStartedAt ?? 0) - (a.streamStartedAt ?? 0))
}

const LIVE_VIEWER_FRESH_MS = 12_000

export function pingLiveViewer(streamerUserId: string, viewerUserId: string) {
  if (!streamerUserId || !viewerUserId || streamerUserId === viewerUserId) return
  const m = readViewerMap()
  const now = Date.now()
  m[streamerUserId] = {
    ...(m[streamerUserId] ?? {}),
    [viewerUserId]: now,
  }
  writeViewerMap(m)
  postLive_bc()
}

export function getLiveViewerCount(streamerUserId: string): number {
  if (!streamerUserId) return 0
  const viewers = readViewerMap()[streamerUserId]
  if (!viewers) return 0
  const now = Date.now()
  return Object.values(viewers).filter((ts) => now - ts < LIVE_VIEWER_FRESH_MS).length
}

export function requestJoinLive(args: {
  streamerUserId: string
  viewerUserId: string
  viewerName: string
  viewerPhoto: string
}) {
  if (!args.streamerUserId || !args.viewerUserId) return
  if (isUserBanned(args.streamerUserId) || isUserBanned(args.viewerUserId)) return
  const m = readLiveJoinMap()
  const list = m[args.streamerUserId] ? [...m[args.streamerUserId]] : []
  const existing = list.find((r) => r.viewerUserId === args.viewerUserId && r.status === 'pending')
  if (existing) return
  m[args.streamerUserId] = [
    {
      id: randomId(),
      streamerUserId: args.streamerUserId,
      viewerUserId: args.viewerUserId,
      viewerName: args.viewerName,
      viewerPhoto: args.viewerPhoto,
      at: Date.now(),
      status: 'pending' as const,
    },
    ...list,
  ].slice(0, 40)
  writeLiveJoinMap(m)
  postLive_bc()
}

export function readLiveJoinRequests(streamerUserId: string): LiveJoinRequest[] {
  return (readLiveJoinMap()[streamerUserId] ?? []).filter((r) => !isUserBanned(r.viewerUserId))
}

export function setLiveJoinRequestStatus(
  streamerUserId: string,
  requestId: string,
  status: LiveJoinRequest['status'],
) {
  const m = readLiveJoinMap()
  const list = m[streamerUserId]
  if (!list) return
  m[streamerUserId] = list.map((r) => (r.id === requestId ? { ...r, status } : r))
  writeLiveJoinMap(m)
  postLive_bc()
}

export function getAdminUsers(): AdminUserRow[] {
  const now = Date.now()
  const bans = readBanMap()
  const byPerson = new Map<string, AdminUserRow>()
  for (const user of readLocalAdminUsers()) {
    const row = {
      userId: user.userId,
      name: user.name,
      username: user.username,
      mainPhoto: user.mainPhoto,
      lastSeen: user.updatedAt,
      isActive: now - user.updatedAt < LIVE_FRESH_MS,
      isStreaming: false,
      isBanned: Boolean(bans[user.userId]),
    }
    const key = slugName(user.name)
    const current = byPerson.get(key)
    if (!current || row.lastSeen > current.lastSeen) {
      byPerson.set(key, row)
    }
  }
  for (const p of Object.values(readLiveMap())) {
      const card = livePubToSwipeProfile(p)
      const row = {
        userId: p.userId,
        name: p.name,
        username: p.username,
        mainPhoto: p.mainPhoto,
        lastSeen: p.ts,
        isActive: now - p.ts < LIVE_FRESH_MS,
        isStreaming: Boolean(card.isStreaming),
        isBanned: Boolean(bans[p.userId]),
      }
      const key = slugName(p.name)
      const current = byPerson.get(key)
      if (!current || row.lastSeen > current.lastSeen) {
        byPerson.set(key, row)
      }
  }
  return [...byPerson.values()].sort((a, b) => b.lastSeen - a.lastSeen)
}

export function getAdminStats(): AdminStats {
  const users = getAdminUsers()
  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
    liveUsers: users.filter((u) => u.isStreaming).length,
    reportCount: readAdminReports().length,
    bannedCount: readBannedUsers().length,
  }
}

export function clearAdminLocalData() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('swipey-') || key.startsWith(THREAD_KEY_PREFIX))) {
        localStorage.removeItem(key)
      }
    }
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith('swipey-')) {
        sessionStorage.removeItem(key)
      }
    }
  } catch {
    /* */
  }
  postLive_bc()
}

export function publishMyLiveProfile(pub: Omit<LiveProfilePub, 'ts'> & { ts?: number }) {
  if (isUserBanned(pub.userId)) return
  const b: LiveProfilePub = { ...pub, ts: pub.ts ?? Date.now() }
  const m = readLiveMap()
  m[b.userId] = b
  writeLiveMap(m)
  upsertLocalUserFromSwipeProfile(livePubToSwipeProfile(b))
  postLive_bc()
}

export function readIncomingFor(recipientUserId: string): IncomingItem[] {
  return (readIncomingMap()[recipientUserId] ?? []).filter((item) => !isUserBanned(item.fromUserId))
}

export function readOutgoingLikesFor(userId: string): LikedItem[] {
  return readLikedMap()[userId] ?? []
}

export function addOutgoingLikeFor(userId: string, liked: SwipeProfile) {
  if (!userId || !liked.liveUserId) return
  const m = readLikedMap()
  const list = m[userId] ? [...m[userId]] : []
  if (list.some((x) => x.card.liveUserId === liked.liveUserId || x.card.id === liked.id)) {
    return
  }
  m[userId] = [{ id: `liked-${liked.liveUserId}-${Date.now()}`, at: Date.now(), card: liked }, ...list].slice(0, 80)
  writeLikedMap(m)
  postLive_bc()
}

/**
 * Iemand (de swiper) gaf jou een rechter-swipe; toon in Requests.
 */
export function addIncomingForRecipient(
  recipientUserId: string,
  swiper: SwipeProfile,
) {
  if (!recipientUserId || !swiper.liveUserId) return
  if (isUserBanned(recipientUserId) || isUserBanned(swiper.liveUserId)) return
  const from = swiper.liveUserId
  const m = readIncomingMap()
  const list = m[recipientUserId] ? [...m[recipientUserId]] : []
  if (list.some((x) => x.fromUserId === from)) {
    return
  }
  const reqId = randomId()
  const stableId = `live-${from.slice(0, 12)}`
  const item: IncomingItem = {
    id: reqId,
    fromUserId: from,
    at: Date.now(),
    card: { ...swiper, id: stableId, liveUserId: from },
  }
  m[recipientUserId] = [item, ...list]
  writeIncomingMap(m)
  postLive_bc()
}

export function removeIncoming(
  recipientUserId: string,
  requestId: string,
) {
  const m = readIncomingMap()
  const list = m[recipientUserId]
  if (!list) return
  m[recipientUserId] = list.filter((x) => x.id !== requestId)
  if (m[recipientUserId].length === 0) delete m[recipientUserId]
  writeIncomingMap(m)
  postLive_bc()
}

/**
 * Voor in je eigen vrienden- / match-lijst.
 */
export function buildLocalSwipeProfileSnapshot(args: {
  myUserId: string
  displayName: string
  bio: string
  profession: string
  company: string
  mainPhoto: string
  extraPhotos?: string[]
  /** Profieltags; anders vaste live-tags */
  userTags?: { t: string; c: string }[]
}): SwipeProfile {
  const { myUserId, displayName, bio, profession, company, mainPhoto, extraPhotos = [] } =
    args
  const u = `live-${myUserId.slice(0, 12)}`
  const tagLine =
    args.userTags && args.userTags.length > 0
      ? args.userTags.slice(0, 6)
      : [
          { t: 'LIVE', c: '#22a855' },
          { t: 'SWIPEY', c: '#2d7ce8' },
        ]
  return {
    id: u,
    name: displayName,
    age: 21,
    city: 'Online',
    username: `${slugName(displayName)}._${myUserId.slice(2, 6)}`,
    mainPhoto,
    extraPhotos: extraPhotos.length ? extraPhotos : [mainPhoto],
    tags: tagLine,
    bio: bio || 'Hoi van een echte speler in deze browser.',
    profession: profession || 'Profiel',
    company: company || 'Swipey',
    liveUserId: myUserId,
  }
}

export function subscribeLiveSync(onTick: () => void) {
  const bc = new BroadcastChannel(BC_LIVE)
  const onMsg = () => onTick()
  bc.addEventListener('message', onMsg)
  const onStore = (e: StorageEvent) => {
    if (
      e.key === LS_LIVE ||
      e.key === LS_IN ||
      e.key === LS_ACPT ||
      e.key === LS_LIKED ||
      e.key === LS_VIEWERS ||
      e.key === LS_REPORTS ||
      e.key === LS_BANS ||
      e.key === LS_LIVE_JOINS
    ) onTick()
  }
  window.addEventListener('storage', onStore)
  const t = window.setInterval(onTick, 1800)
  onTick()
  return () => {
    bc.removeEventListener('message', onMsg)
    try {
      bc.close()
    } catch {
      /* */
    }
    window.removeEventListener('storage', onStore)
    clearInterval(t)
  }
}
