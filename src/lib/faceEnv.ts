/** Bouw link om op de telefoon de face-flow te openen (zelfde origine, query) */
export function buildFaceVerifyLink(): string {
  if (typeof window === 'undefined') return ''
  const u = new URL(window.location.href)
  u.searchParams.set('faceVerify', '1')
  u.searchParams.set('quick', '1')
  return u.toString()
}

export function hasFaceVerifyParam(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('faceVerify') === '1'
}

export function hasQuickParam(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('quick') === '1'
}

/**
 * Eén telefoon met frontcamera: browser op mobiel, of smal scherm + touch.
 * Op desktop: QR tonen, geen getUserMedia tenzij de gebruiker kiest (optioneel).
 */
export function isLikelyPhoneForCamera(): boolean {
  if (typeof window === 'undefined') return false
  if (!navigator.mediaDevices?.getUserMedia) return false
  const ua = navigator.userAgent
  if (
    /iPhone|iPod|Android(?!.*PC)|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      ua,
    ) ||
    /iPad|Tablet/i.test(ua)
  ) {
    return true
  }
  if (
    window.matchMedia('(max-width: 720px)').matches &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  ) {
    return true
  }
  return false
}

export function isSecureContextForCamera(): boolean {
  if (typeof window === 'undefined') return true
  return window.isSecureContext
}

export function stripFaceVerifyParamsFromUrl() {
  const p = new URLSearchParams(window.location.search)
  if (!p.has('faceVerify') && !p.has('quick')) return
  p.delete('faceVerify')
  p.delete('quick')
  const s = p.toString()
  const u = window.location.pathname + (s ? `?${s}` : '') + window.location.hash
  window.history.replaceState({}, '', u)
}
