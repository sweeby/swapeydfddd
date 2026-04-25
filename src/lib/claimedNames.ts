/**
 * Lokaal geclaimde bijnamen (hier, geen server) zodat dezelfde naam niet
 * dubbel wordt kozen na een voltooide inschrijving. Bij uitchecken
 * (clear session) komt de naam weer vrij.
 */

const KEY = 'swipey-claimed-nicknames-v1'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const o = JSON.parse(raw) as unknown
    if (!Array.isArray(o)) return []
    return o.filter((x) => typeof x === 'string')
  } catch {
    return []
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* */
  }
}

export function normNickname(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function isClaimedName(raw: string): boolean {
  const n = normNickname(raw)
  if (n.length === 0) return false
  return read().includes(n)
}

/**
 * @returns false als de naam al geclaimd is
 */
export function tryRegisterClaimedName(raw: string): boolean {
  const n = normNickname(raw)
  if (n.length === 0) return true
  const list = read()
  if (list.includes(n)) return false
  write([...list, n])
  return true
}

export function releaseClaimedName(raw: string) {
  const n = normNickname(raw)
  if (n.length === 0) return
  write(read().filter((x) => x !== n))
}

/** Houd bestaande ingelogde sessies consistent met de claim-lijst (upgrade zonder dataverlies). */
export function ensureNameClaimedIfMissing(raw: string) {
  const n = normNickname(raw)
  if (n.length === 0) return
  const list = read()
  if (list.includes(n)) return
  write([...list, n])
}
