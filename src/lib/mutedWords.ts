import { randomId } from './realChatSync'

const KEY = 'swipey-muted-words-v1'

export type MutedEntry = { id: string; w: string }

export function readMutedWords(): MutedEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    if (!Array.isArray(a)) return []
    const out: MutedEntry[] = []
    for (const x of a) {
      if (!x || typeof x !== 'object') continue
      const o = x as { id?: string; w?: string }
      const w = typeof o.w === 'string' ? o.w.trim() : ''
      if (!w) continue
      out.push({ id: typeof o.id === 'string' && o.id ? o.id : randomId(), w })
    }
    return out
  } catch {
    return []
  }
}

export function writeMutedWords(list: MutedEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* */
  }
}
