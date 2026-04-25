/**
 * Synchronisatie zonder server:zelfde origin, tweede tab, zelfde match;
 * + localStorage als fallback bij storage events.
 * Geen AI-berichten: alleen wat gebruikers (tabs) echt sturen.
 */

import type { SwipeProfile } from '../yubo/discoverData'

export const SS_TAB_USER = 'swipey-tab-uid'
/** Oude key: één id per browser (vóór per-tab accounts). */
const LS_PERSIST_USER = 'swipey-uid-persist-v1'
const legacyMatchesKey = 'swipey-matches-v1'
export const THREAD_KEY_PREFIX = 'swipey-thread-v1-'
export const keyThread = (matchId: string) => `${THREAD_KEY_PREFIX}${matchId}`

export const BROADCAST = 'swipey-chat-v1'

export type SwChatMsg = {
  id: string
  fromUser: string
  text: string
  ts: number
  /** data-URL (audio/webm); kort; sync via BroadcastChannel/LS */
  audioDataUrl?: string
  /** Rechtstreeks afspeelbare GIF-URL */
  gifUrl?: string
  /** Kort label voor in de inbox (optioneel) */
  gifLabel?: string
  /** data-URL (image/jpeg, image/png, …), zelfde tab/andere tab via sync */
  imageDataUrl?: string
  /** Oorspronkelijke bestandsnaam (optioneel) */
  imageName?: string
}

export type BCEnvelope =
  | { v: 1; t: 'msg'; matchId: string; userId: string; msg: SwChatMsg }
  | { v: 1; t: 'pr'; matchId: string; userId: string; at: number }
  | { v: 1; t: 'typing'; matchId: string; userId: string; at: number; typing: boolean }

export function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `i-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * Per tabblad een eigen id (sessionStorage), zodat meerdere accounts in
 * verschillende tabbladen elkaar in de live-pool zien. Zelfde origin + localStorage.
 *
 * `?newAccount=1` in de URL: leegt de tab-id zodat een **nieuw** account ontstaat
 * (handig na “tab dupliceren” waarbij sessionStorage meegekopieerd wordt).
 */
export function getOrCreateUserId(): string {
  try {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      if (p.get('newAccount') === '1') {
        try {
          sessionStorage.removeItem(SS_TAB_USER)
        } catch {
          /* */
        }
        p.delete('newAccount')
        const q = p.toString()
        const u =
          window.location.pathname + (q ? `?${q}` : '') + (window.location.hash || '')
        window.history.replaceState({}, '', u)
      }
    }
    const fromSs = sessionStorage.getItem(SS_TAB_USER)
    if (fromSs && fromSs.length > 3) {
      return fromSs
    }
    const u = `u-${randomId()}`
    try {
      sessionStorage.setItem(SS_TAB_USER, u)
    } catch {
      /* */
    }
    try {
      localStorage.removeItem(LS_PERSIST_USER)
    } catch {
      /* */
    }
    return u
  } catch {
    return `u-temp-${randomId()}`
  }
}

/** Uitloggen: volgende bezoek krijgt een leeg tab-id (nieuw account) tenzij opgeslagen sessie. */
export function clearTabUserId() {
  try {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(SS_TAB_USER)
  } catch {
    /* */
  }
}

function matchesKeyFor(userId: string) {
  return `swipey-matches-v1-${userId}`
}

export function readStoredMatches(userId: string): SwipeProfile[] {
  const k = matchesKeyFor(userId)
  try {
    const s = localStorage.getItem(k)
    if (s) {
      const a = JSON.parse(s) as SwipeProfile[]
      if (Array.isArray(a)) return a
    }
    const leg = localStorage.getItem(legacyMatchesKey)
    if (!leg) return []
    const a = JSON.parse(leg) as SwipeProfile[]
    if (!Array.isArray(a)) return []
    try {
      localStorage.setItem(k, leg)
      localStorage.removeItem(legacyMatchesKey)
    } catch {
      /* */
    }
    return a
  } catch {
    return []
  }
}

export function writeStoredMatches(userId: string, m: SwipeProfile[]) {
  try {
    localStorage.setItem(matchesKeyFor(userId), JSON.stringify(m))
  } catch {
    /* */
  }
}

export function readThread(matchId: string): SwChatMsg[] {
  try {
    const s = localStorage.getItem(keyThread(matchId))
    if (!s) return []
    const a = JSON.parse(s) as SwChatMsg[]
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

export function writeThread(matchId: string, messages: SwChatMsg[]) {
  try {
    localStorage.setItem(keyThread(matchId), JSON.stringify(messages))
  } catch {
    /* */
  }
}

function sortTs(a: SwChatMsg, b: SwChatMsg) {
  return a.ts - b.ts
}

export function appendMessageDedupe(
  prev: SwChatMsg[] | undefined,
  msg: SwChatMsg,
): SwChatMsg[] {
  const list = [...(prev ?? [])]
  if (list.some((x) => x.id === msg.id)) return list
  list.push(msg)
  list.sort(sortTs)
  return list
}

export function postChat(bc: BroadcastChannel, payload: BCEnvelope) {
  bc.postMessage(payload)
}
