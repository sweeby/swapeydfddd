import type { SwipeProfile, SwipeTag } from '../yubo/discoverData'

const KEY = 'swipey-local-users-v1'
const MAX_USERS = 250

type LocalUserMap = Record<string, LocalUserRecord>

export type LocalUserRecord = {
  v: 1
  userId: string
  name: string
  birthdate?: string
  username: string
  mainPhoto: string
  extraPhotos: string[]
  tags: SwipeTag[]
  bio: string
  profession: string
  company: string
  updatedAt: number
}

function readMap(): LocalUserMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as LocalUserMap
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: LocalUserMap) {
  try {
    const rows = Object.values(map)
      .filter((u) => u?.v === 1 && Boolean(u.userId) && Boolean(u.name))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_USERS)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(rows.map((u) => [u.userId, u]))))
  } catch {
    /* */
  }
}

function mergeUsers(users: LocalUserRecord[]) {
  const map = readMap()
  for (const user of users) {
    if (!user?.userId || !user.name) continue
    const current = map[user.userId]
    if (!current || (user.updatedAt ?? 0) >= (current.updatedAt ?? 0)) {
      map[user.userId] = user
    }
  }
  writeMap(map)
}

export async function publishSharedUser(user: LocalUserRecord): Promise<boolean> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    })
    return res.ok
  } catch {
    /* Offline/lokaal: localStorage blijft fallback. */
    return false
  }
}

export async function syncSharedUsers(): Promise<boolean> {
  const result = await syncSharedUsersDetailed()
  return result.ok
}

export async function syncSharedUsersDetailed(): Promise<{
  ok: boolean
  count: number
  error?: string
}> {
  try {
    const res = await fetch(`/api/users?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      return { ok: false, count: 0, error: `HTTP ${res.status}` }
    }
    const data = (await res.json().catch(() => ({}))) as { users?: LocalUserRecord[] }
    if (!Array.isArray(data.users)) {
      return { ok: false, count: 0, error: 'Geen users-array ontvangen' }
    }
    mergeUsers(data.users)
    return { ok: true, count: data.users.length }
  } catch {
    return { ok: false, count: 0, error: 'Netwerkfout' }
  }
}

function slugName(name: string) {
  const s = name
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || 'gebruiker'
}

function mainPhotoForUserId(userId: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(userId)}/500/800`
}

function ageFromBirthdate(birthdate?: string): number {
  if (!birthdate) return 21
  const d = new Date(birthdate)
  if (Number.isNaN(d.getTime())) return 21
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return Math.max(13, Math.min(99, age))
}

function normalizeUserId(userId: string | undefined) {
  return String(userId ?? '').trim()
}

export function upsertLocalUserFromSession(args: {
  userId?: string
  name: string
  birthdate?: string
}) {
  const userId = normalizeUserId(args.userId)
  const name = args.name.trim()
  if (!userId || !name) return

  const map = readMap()
  const prev = map[userId]
  const next: LocalUserRecord = {
    v: 1,
    userId,
    name,
    birthdate: args.birthdate,
    username: prev?.username || `${slugName(name)}._${userId.slice(2, 6)}`,
    mainPhoto: prev?.mainPhoto || mainPhotoForUserId(userId),
    extraPhotos: prev?.extraPhotos ?? [],
    tags: prev?.tags?.length ? prev.tags : [{ t: 'SWIPEY', c: '#2d7ce8' }],
    bio: prev?.bio || 'Hoi van een echte speler in deze browser.',
    profession: prev?.profession || 'Profiel',
    company: prev?.company || 'Swipey',
    updatedAt: Date.now(),
  }
  map[userId] = next
  writeMap(map)
  void publishSharedUser(next)
}

export function upsertLocalUserProfile(args: {
  userId: string
  name: string
  photos: string[]
  tags: SwipeTag[]
  bio: string
  profession: string
  company: string
}) {
  const userId = normalizeUserId(args.userId)
  const name = args.name.trim()
  if (!userId || !name) return

  const map = readMap()
  const prev = map[userId]
  const mainPhoto = args.photos[0] || prev?.mainPhoto || mainPhotoForUserId(userId)
  const next: LocalUserRecord = {
    v: 1,
    userId,
    name,
    birthdate: prev?.birthdate,
    username: `${slugName(name)}._${userId.slice(2, 6)}`,
    mainPhoto,
    extraPhotos: args.photos.length > 1 ? args.photos.slice(1) : prev?.extraPhotos ?? [],
    tags: args.tags.length ? args.tags : prev?.tags?.length ? prev.tags : [{ t: 'SWIPEY', c: '#2d7ce8' }],
    bio: args.bio || prev?.bio || 'Hoi van een echte speler in deze browser.',
    profession: args.profession || prev?.profession || 'Profiel',
    company: args.company || prev?.company || 'Swipey',
    updatedAt: Date.now(),
  }
  map[userId] = next
  writeMap(map)
  void publishSharedUser(next)
}

export function upsertLocalUserFromSwipeProfile(profile: SwipeProfile) {
  const userId = normalizeUserId(profile.liveUserId)
  if (!userId) return
  upsertLocalUserProfile({
    userId,
    name: profile.name,
    photos: [profile.mainPhoto, ...(profile.extraPhotos ?? [])].filter(Boolean),
    tags: profile.tags,
    bio: profile.bio,
    profession: profile.profession,
    company: profile.company,
  })
}

export function readLocalSwipeProfilesForMe(myUserId: string): SwipeProfile[] {
  const me = normalizeUserId(myUserId).toLowerCase()
  if (!me) return []
  return Object.values(readMap())
    .filter((u) => u.userId.toLowerCase() !== me)
    .map((u): SwipeProfile => ({
      id: `local-${u.userId}`,
      name: u.name,
      age: ageFromBirthdate(u.birthdate),
      city: 'Profiel',
      username: u.username,
      mainPhoto: u.mainPhoto,
      extraPhotos: u.extraPhotos.length ? u.extraPhotos : [u.mainPhoto],
      tags: u.tags,
      bio: u.bio,
      profession: u.profession,
      company: u.company,
      liveUserId: u.userId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
}

export function readLocalAdminUsers(): Array<{
  userId: string
  name: string
  username: string
  mainPhoto: string
  updatedAt: number
}> {
  return Object.values(readMap())
    .filter((u) => u?.userId && u.name)
    .map((u) => ({
      userId: u.userId,
      name: u.name,
      username: u.username,
      mainPhoto: u.mainPhoto,
      updatedAt: u.updatedAt,
    }))
}
