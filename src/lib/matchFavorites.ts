const KEY = 'swipey-fav-matches-v1'

export function readFavSet(): Set<string> {
  try {
    const s = localStorage.getItem(KEY)
    if (!s) return new Set()
    const a = JSON.parse(s) as unknown
    if (!Array.isArray(a)) return new Set()
    return new Set(a.filter((x) => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeFavSet(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]))
  } catch {
    /* */
  }
}

export function isMatchFavorite(matchId: string): boolean {
  return readFavSet().has(matchId)
}

/**
 * @returns new favorite state: true = nu in favorieten
 */
export function toggleMatchFavorite(matchId: string): boolean {
  const s = readFavSet()
  if (s.has(matchId)) {
    s.delete(matchId)
    writeFavSet(s)
    return false
  }
  s.add(matchId)
  writeFavSet(s)
  return true
}
