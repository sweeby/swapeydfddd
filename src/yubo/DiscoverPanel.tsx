import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SwipeProfile } from './discoverData'

function shuffleProfiles(profiles: SwipeProfile[]): SwipeProfile[] {
  const a = [...profiles]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]!
    a[i] = a[j]!
    a[j] = t
  }
  return a
}

const THRESH = 90
const ROT = 0.04
const LEAVE_MS = 300

type Props = {
  /** Gepubliceerde profielen (zelfde site / pool) — stack; zonder andere gebruikers: voorbeelden. */
  extraDeck?: SwipeProfile[]
  onLikedCount?: (n: number) => void
  /** Iemand is naar rechts geswipet — toe te voegen als chatmatch */
  onMatch?: (profile: SwipeProfile) => void
  onSwipe?: (profile: SwipeProfile, direction: 'left' | 'right') => void
}

export function DiscoverPanel({ extraDeck = [], onLikedCount, onMatch, onSwipe }: Props) {
  const [index, setIndex] = useState(0)
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [leaving, setLeaving] = useState<null | 'left' | 'right'>(null)
  const [dragging, setDragging] = useState(false)
  const [likedIds, setLikedIds] = useState<string[]>([])

  const startRef = useRef({ x: 0, y: 0 })
  const pointerActive = useRef(false)
  /** Vastzettende index op het moment dat we de kaart wegsturen (voor timeout) */
  const leaveIndexRef = useRef(0)
  const leaveProfileRef = useRef<SwipeProfile | null>(null)
  const onLikedRef = useRef(onLikedCount)
  const onMatchRef = useRef(onMatch)
  const onSwipeRef = useRef(onSwipe)
  useLayoutEffect(() => {
    onLikedRef.current = onLikedCount
  }, [onLikedCount])
  useLayoutEffect(() => {
    onMatchRef.current = onMatch
  }, [onMatch])
  useLayoutEffect(() => {
    onSwipeRef.current = onSwipe
  }, [onSwipe])

  /** Stabiele handtekening van wie in de pool zit (volgorde telt niet). String per render; zelfde inhoud = zelfde effect-deps. */
  const poolKey = extraDeck
    .map((c) => c.id)
    .filter(Boolean)
    .sort()
    .join('|')
  const extraDeckRef = useRef(extraDeck)
  extraDeckRef.current = extraDeck
  const [shuffledDeck, setShuffledDeck] = useState<SwipeProfile[]>([])
  useLayoutEffect(() => {
    const ed = extraDeckRef.current
    if (ed.length === 0) {
      setShuffledDeck([])
      setIndex(0)
      setLikedIds([])
      return
    }
    setShuffledDeck(shuffleProfiles(ed))
    setIndex(0)
    setLikedIds([])
  }, [poolKey])

  const deck = shuffledDeck

  const current = deck[index]
  const stackN = 3

  useEffect(() => {
    if (!leaving) return
    const dir = leaving
    const t = window.setTimeout(() => {
      const idx = leaveIndexRef.current
      const c = leaveProfileRef.current
      if (c) {
        onSwipeRef.current?.(c, dir)
      }
      if (dir === 'right' && c) {
        onMatchRef.current?.(c)
        setLikedIds((p) => {
          if (p.includes(c.id)) return p
          const n = [...p, c.id]
          onLikedRef.current?.(n.length)
          return n
        })
      }
      setIndex((i) => (i === idx ? i + 1 : i))
      setLeaving(null)
      setDx(0)
      setDy(0)
      leaveProfileRef.current = null
    }, LEAVE_MS)
    return () => window.clearTimeout(t)
  }, [leaving])

  const beginLeave = (dir: 'left' | 'right') => {
    if (leaving || !current) return
    leaveIndexRef.current = index
    leaveProfileRef.current = current
    setLeaving(dir)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerActive.current = true
    setDragging(true)
    startRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerActive.current || leaving) return
    setDx(e.clientX - startRef.current.x)
    setDy(e.clientY - startRef.current.y)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointerActive.current || leaving) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* */
    }
    pointerActive.current = false
    setDragging(false)
    const x = e.clientX - startRef.current.x
    if (x > THRESH) beginLeave('right')
    else if (x < -THRESH) beginLeave('left')
    else {
      setDx(0)
      setDy(0)
    }
  }

  const onPointerCancel = () => {
    pointerActive.current = false
    setDragging(false)
    setDx(0)
    setDy(0)
  }

  const hasLiveOthers = extraDeck.length > 0
  const showDoneEmpty = deck.length > 0 && index >= deck.length
  const showActiveCard = Boolean(deck.length > 0 && index < deck.length)

  const reset = () => {
    const ed = extraDeckRef.current
    if (ed.length) {
      setShuffledDeck(shuffleProfiles(ed))
    }
    setIndex(0)
    setLikedIds([])
  }

  const tTop =
    leaving === 'right'
      ? 'translate3d(125%,-6%,0) rotate(20deg) scale(0.94)'
      : leaving === 'left'
        ? 'translate3d(-125%,-6%,0) rotate(-20deg) scale(0.94)'
        : `translate3d(${dx}px,${dy * 0.15}px,0) rotate(${dx * ROT}deg)`

  const tTransition = dragging
    ? 'none'
    : leaving
      ? `transform ${LEAVE_MS}ms cubic-bezier(0.4,0,0.2,1), opacity ${LEAVE_MS}ms ease`
      : 'transform 0.2s ease, opacity 0.2s ease'

  return (
    <div className="swipe-screen yubo-screen-chat">
      <p
        className={
          'disco-hero disco-hero--swipe' +
          (hasLiveOthers ? ' disco-hero--swipe--live' : ' disco-hero--swipe--solo')
        }
      >
        <span className="disco-hero--swipe__title">Swipe to meet</span>
        {hasLiveOthers ? (
          <span className="disco-hero--swipe__sub">
            <strong className="disco-hero--swipe__live-n">{extraDeck.length}</strong> andere profiel
            {extraDeck.length === 1 ? '' : 'en'} in de stack.
          </span>
        ) : null}
        {likedIds.length > 0 && (
          <span className="swipe-likes-pill" aria-label="Aantal likes">
            ♥ {likedIds.length}
          </span>
        )}
      </p>

      <div className="swipe-outer">
        {deck.length === 0 && !showDoneEmpty && (
          <div className="swipe-empty swipe-empty--pool" role="status">
            <p className="swipe-empty__t">Nog geen profielen in de pool</p>
          </div>
        )}

        {showDoneEmpty && (
          <div className="swipe-empty">
            <p className="swipe-empty__t">Je stack is leeg</p>
            <p className="swipe-empty__s">
              Je gaf {likedIds.length} hartje{likedIds.length === 1 ? '' : 's'}.{' '}
              <strong>Nieuwe ronde</strong> schudt de volgorde — je krijgt niet weer
              per se dezelfde volgorde als net.
            </p>
            <button type="button" className="swipe-reload" onClick={reset}>
              Nieuwe ronde
            </button>
          </div>
        )}

        {showActiveCard && current && (
          <div
            className="swipe-deck"
            role="list"
            aria-label="Profielen in de stack"
          >
            {Array.from({ length: stackN }, (_, o) => {
              const p = deck[index + o]
              if (!p) return null
              if (o === 0) {
                return (
                  <div
                    key={p.id + '-a'}
                    className="swipe-card-layer"
                    style={{
                      zIndex: 20,
                      position: 'relative' as const,
                    }}
                  >
                    <div
                      role="listitem"
                      className="swipe-card"
                      style={{
                        transform: tTop,
                        transition: tTransition,
                        touchAction: 'none' as const,
                        opacity: leaving ? 0.88 : 1,
                      }}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerCancel}
                    >
                      <SwipeProfileCard p={p} showExtra />
                      {!leaving && (
                        <>
                          {dx > 40 && (
                            <span
                              className="swipe-stamp swipe-stamp--like"
                              style={{ opacity: Math.min(0.95, (dx - 20) / 100) }}
                            >
                              LIKE
                            </span>
                          )}
                          {dx < -40 && (
                            <span
                              className="swipe-stamp swipe-stamp--nope"
                              style={{
                                opacity: Math.min(0.95, (-dx - 20) / 100),
                              }}
                            >
                              NOPE
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              }
              return (
                <div
                  key={p.id + '-b'}
                  className="swipe-card-layer swipe-card-layer--back"
                  style={{
                    zIndex: 19 - o,
                    position: 'absolute' as const,
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    display: 'flex' as const,
                    alignItems: 'center' as const,
                    justifyContent: 'center' as const,
                    pointerEvents: 'none' as const,
                    transform: `scale(${1 - 0.042 * o}) translateY(${
                      0.3 * o
                    }rem)`,
                    transformOrigin: '50% 0%',
                  }}
                >
                  <div
                    className="swipe-card swipe-card--back"
                    style={{ maxHeight: '100%' }}
                    aria-hidden
                  >
                    <SwipeProfileCard p={p} showExtra={false} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showActiveCard && current && (
          <div
            className="swipe-actions"
            role="group"
            aria-label="Voorbij of leuk"
          >
            <button
              type="button"
              className="swipe-act swipe-act--no"
              aria-label="Niet mijn type"
              disabled={!!leaving}
              onClick={() => beginLeave('left')}
            >
              ✕
            </button>
            <button
              type="button"
              className="swipe-act swipe-act--yes"
              aria-label="Tof"
              disabled={!!leaving}
              onClick={() => beginLeave('right')}
            >
              ♥
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function SwipeProfileCard({
  p,
  showExtra,
  layout = 'deck',
}: {
  p: SwipeProfile
  showExtra: boolean
  /** In de profiel-Preview: geen hoge max-height, volledige bio/tags/werk zonder mini-scroll. */
  layout?: 'deck' | 'full'
}) {
  const isFull = layout === 'full'
  const nPhotos = 1 + p.extraPhotos.length

  return (
    <div
      className={
        isFull
          ? 'swipe-card-inner swipe-card-inner--full'
          : 'swipe-card-inner swipe-card-inner--deck'
      }
    >
      <div className="swipe-card__media">
        <div
          className="swipe-card__photo"
          style={{ backgroundImage: `url(${p.mainPhoto})` }}
          role="img"
          aria-label={`Foto ${p.name}`}
        />
        {isFull && nPhotos > 1 ? (
          <p className="swipe-card__photo-badges" aria-hidden>
            1 / {nPhotos} foto&apos;s
          </p>
        ) : null}
      </div>
      <div className="swipe-card__fade" aria-hidden />
      <div className="swipe-card__nameblock">
        {isFull ? (
          <h2 className="swipe-card__name">
            {p.name}, {p.age}
          </h2>
        ) : null}
        <p className="swipe-card__meta">
          @{p.username} ·{' '}
          {p.city === 'Online' ? (
            <span className="swipe-card__online">
              <span className="swipe-card__dot" aria-hidden>●</span>
              {p.city}
            </span>
          ) : (
            p.city
          )}
        </p>
      </div>

      {showExtra && (
        <div className="swipe-card__body">
          {p.extraPhotos.length > 0 && (
            <div
              className="swipe-thumbs-wrap"
              aria-label={isFull ? 'Overige profielfoto’s' : undefined}
            >
              {isFull && (
                <h3 className="swipe-card__h">Meer foto’s</h3>
              )}
              <div
                className={
                  isFull ? 'swipe-thumbs swipe-thumbs--large' : 'swipe-thumbs'
                }
                aria-hidden
              >
                {p.extraPhotos.map((u, i) => (
                  <div
                    key={i}
                    className="swipe-thumb"
                    style={{ backgroundImage: `url(${u})` }}
                  />
                ))}
              </div>
            </div>
          )}

          {isFull && p.tags.length > 0 && (
            <h3 className="swipe-card__h">Tags & interesses</h3>
          )}
          {isFull && p.tags.length === 0 && (
            <p className="swipe-card__emptyline">Nog geen tags in je profiel.</p>
          )}

          <div className="swipe-tags" role="list" aria-label="Interesses">
            {p.tags.map((t, ti) => (
              <span
                key={`${p.id}-t-${ti}`}
                className="yubo-tag swipe-pill"
                style={{ background: t.c }}
                role="listitem"
              >
                {t.t}
              </span>
            ))}
          </div>

          {isFull && <h3 className="swipe-card__h">Bio</h3>}
          <p className="swipe-bio">“{p.bio}”</p>

          {isFull && <h3 className="swipe-card__h">Beroep &amp; plek</h3>}
          <div className="swipe-pro" aria-label="Beroep">
            <p className="swipe-pro__j">{p.profession}</p>
            <p className="swipe-pro__c">{p.company}</p>
          </div>
        </div>
      )}
    </div>
  )
}
