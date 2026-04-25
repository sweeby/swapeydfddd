/**
 * Lokaal opgeslagen Yubo-profiel.
 */

import { upsertLocalUserProfile } from './localUserDb'

const KEY_LEGACY = 'swipey-yubo-profile-v1'
function keyForUser(userId: string) {
  return `swipey-yubo-profile-v1-${userId}`
}

export type SavedProfileTag = { id: string; t: string; c: string }

export type YuboLocalProfileV1 = {
  v: 1
  /** Weergavenaam op swipe-kaarten en in matching; o.a. anders dan oude `displayName`-prop. */
  publicName?: string
  bio: string
  role: string
  workplace: string
  tags: SavedProfileTag[]
  /** Data-URL of https; volgorde = hoofd + extra's */
  photos: string[]
}

export function loadYuboProfile(): YuboLocalProfileV1 | null {
  try {
    const raw = localStorage.getItem(KEY_LEGACY)
    if (!raw) return null
    const o = JSON.parse(raw) as YuboLocalProfileV1
    if (o.v !== 1) return null
    if (typeof o.bio !== 'string' || typeof o.role !== 'string' || typeof o.workplace !== 'string') {
      return null
    }
    if (!Array.isArray(o.photos) || !Array.isArray(o.tags)) return null
    return o
  } catch {
    return null
  }
}

/**
 * Profiel per Swipey-account (tab = eigen userId).
 * Eenmalig: lege user-key + bestaande legacy-sleutel → migreren naar deze user, legacy wissen.
 */
export function loadYuboProfileForUser(userId: string): YuboLocalProfileV1 | null {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(keyForUser(userId))
    if (raw) {
      const o = JSON.parse(raw) as YuboLocalProfileV1
      if (o.v === 1 && typeof o.bio === 'string') return o
    }
  } catch {
    /* */
  }
  const leg = loadYuboProfile()
  if (leg) {
    try {
      localStorage.setItem(keyForUser(userId), JSON.stringify(leg))
      localStorage.removeItem(KEY_LEGACY)
    } catch {
      /* */
    }
    return leg
  }
  return null
}

export function saveYuboProfile(p: Omit<YuboLocalProfileV1, 'v'>) {
  const data: YuboLocalProfileV1 = { v: 1, ...p }
  try {
    const s = JSON.stringify(data)
    if (s.length > 4_000_000) {
      return false
    }
    localStorage.setItem(KEY_LEGACY, s)
    return true
  } catch {
    return false
  }
}

export function saveYuboProfileForUser(
  userId: string,
  p: Omit<YuboLocalProfileV1, 'v'>,
) {
  if (!userId) return saveYuboProfile(p)
  const data: YuboLocalProfileV1 = { v: 1, ...p }
  try {
    const s = JSON.stringify(data)
    if (s.length > 4_000_000) {
      return false
    }
    localStorage.setItem(keyForUser(userId), s)
    upsertLocalUserProfile({
      userId,
      name: p.publicName?.trim() || 'Gast',
      photos: p.photos,
      tags: p.tags.map(({ t, c }) => ({ t, c })),
      bio: p.bio,
      profession: p.role,
      company: p.workplace,
    })
    return true
  } catch {
    return false
  }
}

export function clearYuboProfile() {
  try {
    localStorage.removeItem(KEY_LEGACY)
  } catch {
    /* */
  }
}
