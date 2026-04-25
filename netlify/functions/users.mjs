import { getStore } from '@netlify/blobs'

const STORE_NAME = 'swipey-users'
const USERS_KEY = 'users-v1'
const MAX_USERS = 1000
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers })
}

function store() {
  return getStore(STORE_NAME)
}

function personKey(user) {
  return `${String(user?.name || '').trim().toLowerCase()}::${String(user?.birthdate || '')}`
}

function cleanUser(input) {
  const userId = String(input?.userId || '').trim()
  const name = String(input?.name || '').trim().slice(0, 64)
  if (!userId || !name) return null
  return {
    v: 1,
    userId,
    name,
    birthdate: typeof input.birthdate === 'string' ? input.birthdate.slice(0, 16) : '',
    username: String(input.username || '').trim().slice(0, 64),
    mainPhoto: String(input.mainPhoto || '').trim().slice(0, 4000),
    extraPhotos: Array.isArray(input.extraPhotos)
      ? input.extraPhotos.map((x) => String(x).slice(0, 4000)).slice(0, 5)
      : [],
    tags: Array.isArray(input.tags)
      ? input.tags
          .map((tag) => ({
            t: String(tag?.t || '').slice(0, 24),
            c: String(tag?.c || '#2d7ce8').slice(0, 24),
          }))
          .filter((tag) => tag.t)
          .slice(0, 12)
      : [],
    bio: String(input.bio || '').slice(0, 500),
    profession: String(input.profession || '').slice(0, 80),
    company: String(input.company || '').slice(0, 80),
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : Date.now(),
  }
}

async function readUsers() {
  const users = await store().get(USERS_KEY, { type: 'json' }).catch(() => null)
  return Array.isArray(users) ? users.map(cleanUser).filter(Boolean) : []
}

async function writeUsers(users) {
  const byPerson = new Map()
  for (const user of users) {
    const key = personKey(user) || user.userId
    const current = byPerson.get(key)
    if (!current || user.updatedAt > current.updatedAt) {
      byPerson.set(key, user)
    }
  }
  const rows = [...byPerson.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_USERS)
  await store().setJSON(USERS_KEY, rows)
  return rows
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers })
  }

  try {
    if (request.method === 'GET') {
      return json({ users: await readUsers() })
    }

    if (request.method === 'POST') {
      let body = {}
      try {
        body = await request.json()
      } catch {
        return json({ error: 'Ongeldige JSON' }, 400)
      }
      const incoming = cleanUser(body.user || body)
      if (!incoming) return json({ error: 'Ongeldige user' }, 400)
      const users = await readUsers()
      const next = await writeUsers([
        incoming,
        ...users.filter((user) => user.userId !== incoming.userId && personKey(user) !== personKey(incoming)),
      ])
      return json({ ok: true, users: next })
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
