/**
 * Sessie na voltooide onboarding: blijf ingelogd (home) tot uitloggen.
 * Alleen lokaal (localStorage).
 * `userId` koppelt dezelfde “Swipey”-id aan deze account (zelfde in nieuwe tabbladen).
 */

import { SS_TAB_USER } from './realChatSync'
import { upsertLocalUserFromSession } from './localUserDb'

const KEY = 'swipey-app-session-v1'
const ACCOUNTS_KEY = 'swipey-saved-accounts-v1'
const MAX_SAVED_ACCOUNTS = 100

/** Lokaal opgeslagen. In productie: alleen resultaat via gecertificeerde ID-provider, geen ruwe nummers in de browser. */
export type IdCheckPayload = {
  docType: 'passport' | 'id_card'
  firstName: string
  lastName: string
  /** ISO (geboortedatum zoals op document) */
  birthdateOnDocument: string
  documentFrontImageName: string
  documentBackImageName: string
  /** ISO YYYY-MM-DD (vervaldocument) */
  expires: string
  nationality: string
}

export type AppSessionV1 = {
  v: 1
  name: string
  birthdate: string
  idVerified: boolean
  /** Gekoppeld aan `sessionStorage` tab-id: matches, chats, shop — blijft hetzelfde account. */
  userId?: string
  /** Ingevuld op de ID-stap. */
  idCheck?: IdCheckPayload
}

export type SavedAppAccount = AppSessionV1 & {
  savedAt: number
}

export function loadAppSession(): AppSessionV1 | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as AppSessionV1
    if (o.v !== 1 || typeof o.name !== 'string' || typeof o.birthdate !== 'string') {
      return null
    }
    if (typeof o.idVerified !== 'boolean' || !o.idVerified) return null
    return o
  } catch {
    return null
  }
}

export function saveAppSession(s: AppSessionV1) {
  const session = canonicalizeSession(s)
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
    saveAccountCopy(session)
    if (session.idVerified) {
      upsertLocalUserFromSession({
        userId: session.userId,
        name: session.name,
        birthdate: session.birthdate,
      })
    }
  } catch {
    /* */
  }
}

function personKey(s: Pick<AppSessionV1, 'name' | 'birthdate'>): string {
  return `${s.name.trim().toLowerCase()}::${s.birthdate}`
}

function accountKey(s: AppSessionV1): string {
  return personKey(s)
}

function readSavedAccountsRaw(): SavedAppAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as SavedAppAccount[]
    if (!Array.isArray(list)) return []
    return list.filter(
      (a) =>
        a?.v === 1 &&
        typeof a.name === 'string' &&
        typeof a.birthdate === 'string' &&
        a.idVerified === true,
    )
  } catch {
    return []
  }
}

function canonicalizeSession(s: AppSessionV1): AppSessionV1 {
  if (!s.idVerified) return s
  const existing = readSavedAccountsRaw().find(
    (account) => personKey(account) === personKey(s) && account.userId,
  )
  const userId = existing?.userId || s.userId
  if (userId && userId !== s.userId) {
    try {
      sessionStorage.setItem(SS_TAB_USER, userId)
    } catch {
      /* */
    }
    return { ...s, userId }
  }
  return s
}

function saveAccountCopy(s: AppSessionV1) {
  if (!s.idVerified) return
  const key = accountKey(s)
  if (!key) return
    const list = readSavedAccountsRaw()
  const next: SavedAppAccount = { ...s, savedAt: Date.now() }
  const without = list.filter((a) => accountKey(a) !== key)
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([next, ...without].slice(0, MAX_SAVED_ACCOUNTS)))
  } catch {
    /* */
  }
}

export function loadSavedAccounts(): SavedAppAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) {
      const current = loadAppSession()
      if (!current?.idVerified) return []
      const migrated: SavedAppAccount = { ...current, savedAt: Date.now() }
      try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([migrated]))
      } catch {
        /* */
      }
      return [migrated]
    }
    const list = readSavedAccountsRaw()
    const byPerson = new Map<string, SavedAppAccount>()
    for (const account of list) {
      const key = personKey(account)
      const current = byPerson.get(key)
      if (!current || account.savedAt > current.savedAt) {
        byPerson.set(key, account)
      }
    }
    const filtered = [...byPerson.values()]
      .map((account) => {
        const canonical = list.find((a) => personKey(a) === personKey(account) && a.userId)
        return canonical?.userId && canonical.userId !== account.userId
          ? { ...account, userId: canonical.userId }
          : account
      })
      .sort((a, b) => b.savedAt - a.savedAt)
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered.slice(0, MAX_SAVED_ACCOUNTS)))
    } catch {
      /* */
    }
    for (const account of filtered) {
      upsertLocalUserFromSession({
        userId: account.userId,
        name: account.name,
        birthdate: account.birthdate,
      })
    }
    return filtered
  } catch {
    return []
  }
}

export function restoreSavedAccount(account: SavedAppAccount): AppSessionV1 {
  const session: AppSessionV1 = {
    v: 1,
    name: account.name,
    birthdate: account.birthdate,
    idVerified: true,
    userId: account.userId,
    idCheck: account.idCheck,
  }
  saveAppSession(session)
  return session
}

export function clearAppSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* */
  }
}

/**
 * Stel vóór `getOrCreateUserId()` in — zet de tab-`userId` op die van de
 * opgeslagen account zodat matches/chats dezelfde data gebruiken in elk tabblad
 * (zolang localStorage in deze browser gelijk is).
 */
export function applyStoredSessionToTabUser() {
  if (typeof window === 'undefined') return
  try {
    const s = loadAppSession()
    const uid = s?.userId
    if (typeof uid === 'string' && uid.length > 2) {
      sessionStorage.setItem(SS_TAB_USER, uid)
    }
  } catch {
    /* */
  }
}
