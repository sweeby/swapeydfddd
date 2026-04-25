/**
 * Publiekelijke Giphy-URL’s in <img> — Giphy blokkeert vaker “lege”
 * afbeeldingen als de Referrer niet klopt; of probeer een andere host.
 */

const HOSTS = (id: string) => [
  `https://i.giphy.com/${id}.gif`,
  `https://media0.giphy.com/media/${id}/giphy.gif`,
  `https://media1.giphy.com/media/${id}/giphy-downsized.gif`,
  `https://media2.giphy.com/media/${id}/200w.gif`,
]

function extractGiphyId(u: string): string | null {
  const t = (u || '').trim()
  if (!t) return null
  const a = t.match(/i\.giphy\.com\/([a-zA-Z0-9]+)\.gif/i)
  if (a) return a[1]!
  const b = t.match(/giphy\.com\/media\/([a-zA-Z0-9]+)\b/i)
  if (b) return b[1]!
  return null
}

/** Lijst om te proberen (i.giphy eerst — werkt grotendeels in moderne browsers). */
export function giphyImgFallbackSources(url: string): string[] {
  const id = extractGiphyId(url)
  if (id) {
    return [...new Set(HOSTS(id))]
  }
  if (url.startsWith('https://') || url.startsWith('//')) {
    if (url.startsWith('//')) return [`https:${url}`]
    return [url]
  }
  return [url]
}

export function toIGiphyIdUrl(id: string) {
  const x = id.replace(/[^a-zA-Z0-9]/g, '')
  return x ? `https://i.giphy.com/${x}.gif` : ''
}
