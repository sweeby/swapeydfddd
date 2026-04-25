import { getStore } from '@netlify/blobs'

const SWIPES_STORE = 'swipey-swipes'
const USERS_STORE = 'swipey-users'
const SWIPES_KEY = 'swipes-v1'
const USERS_KEY = 'users-v1'
const MAX_SWIPES = 20_000
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers })
}

function swipeStore() {
  return getStore(SWIPES_STORE)
}

function userStore() {
  return getStore(USERS_STORE)
}

function cleanSwipe(input) {
  const fromUserId = String(input?.fromUserId || '').trim()
  const toUserId = String(input?.toUserId || '').trim()
  const direction = input?.direction === 'left' ? 'left' : input?.direction === 'right' ? 'right' : ''
  if (!fromUserId || !toUserId || !direction || fromUserId === toUserId) return null
  return {
    fromUserId,
    toUserId,
    direction,
    at: Number.isFinite(Number(input.at)) ? Number(input.at) : Date.now(),
  }
}

async function readSwipes() {
  const rows = await swipeStore().get(SWIPES_KEY, { type: 'json' }).catch(() => null)
  return Array.isArray(rows) ? rows.map(cleanSwipe).filter(Boolean) : []
}

async function writeSwipes(rows) {
  const byPair = new Map()
  for (const row of rows) {
    const key = `${row.fromUserId}->${row.toUserId}`
    const current = byPair.get(key)
    if (!current || row.at > current.at) byPair.set(key, row)
  }
  const next = [...byPair.values()].sort((a, b) => b.at - a.at).slice(0, MAX_SWIPES)
  await swipeStore().setJSON(SWIPES_KEY, next)
  return next
}

async function readUsers() {
  const rows = await userStore().get(USERS_KEY, { type: 'json' }).catch(() => null)
  return Array.isArray(rows) ? rows : []
}

function ageFromBirthdate(birthdate) {
  const d = new Date(String(birthdate || ''))
  if (Number.isNaN(d.getTime())) return 21
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return Math.max(13, Math.min(99, age))
}

function profileFromUser(user) {
  if (!user?.userId || !user?.name) return null
  return {
    id: `shared-${user.userId}`,
    name: user.name,
    age: ageFromBirthdate(user.birthdate),
    city: 'Profiel',
    username: user.username || `user_${String(user.userId).slice(0, 6)}`,
    mainPhoto: user.mainPhoto || `https://picsum.photos/seed/${encodeURIComponent(user.userId)}/500/800`,
    extraPhotos: Array.isArray(user.extraPhotos) && user.extraPhotos.length ? user.extraPhotos : [user.mainPhoto].filter(Boolean),
    tags: Array.isArray(user.tags) ? user.tags : [],
    bio: user.bio || 'Nieuw op Swipey.',
    profession: user.profession || 'Profiel',
    company: user.company || 'Swipey',
    liveUserId: user.userId,
  }
}

function buildState(userId, swipes, users) {
  const userById = new Map(users.map((user) => [String(user.userId), user]))
  const outgoing = swipes.filter((row) => row.fromUserId === userId)
  const outgoingTargetIds = [...new Set(outgoing.map((row) => row.toUserId))]
  const likedByMe = new Set(outgoing.filter((row) => row.direction === 'right').map((row) => row.toUserId))
  const incomingLikes = swipes.filter((row) => row.toUserId === userId && row.direction === 'right')
  const incomingProfiles = incomingLikes
    .filter((row) => !outgoingTargetIds.includes(row.fromUserId))
    .map((row) => profileFromUser(userById.get(row.fromUserId)))
    .filter(Boolean)
  const matchProfiles = incomingLikes
    .filter((row) => likedByMe.has(row.fromUserId))
    .map((row) => profileFromUser(userById.get(row.fromUserId)))
    .filter(Boolean)
  return { outgoingTargetIds, incomingProfiles, matchProfiles }
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers })
  }

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const userId = String(url.searchParams.get('userId') || '').trim()
      if (!userId) return json({ error: 'userId ontbreekt' }, 400)
      const [swipes, users] = await Promise.all([readSwipes(), readUsers()])
      return json(buildState(userId, swipes, users))
    }

    if (request.method === 'POST') {
      let body = {}
      try {
        body = await request.json()
      } catch {
        return json({ error: 'Ongeldige JSON' }, 400)
      }
      const swipe = cleanSwipe(body)
      if (!swipe) return json({ error: 'Ongeldige swipe' }, 400)
      const current = await readSwipes()
      const swipes = await writeSwipes([swipe, ...current])
      const users = await readUsers()
      return json({ ok: true, ...buildState(swipe.fromUserId, swipes, users) })
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (e) {
    return json(
      {
        error: e instanceof Error ? e.message : String(e),
        type: e?.constructor?.name,
      },
      500,
    )
  }
}
