import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import {
  buildFaceVerifyLink,
  isSecureContextForCamera,
} from '../lib/faceEnv'
import { sampleOvalLuma } from './faceLuma'
import './yubo.css'

type Props = {
  onBack: () => void
  /** Sla de voltooide check op in de app (Menu: ID ✓) */
  onIdVerificationSuccess?: () => void | false
}

const LUMA_LO = 45
const LUMA_HI = 220
const SPREAD_MIN = 5
/** Aantal opeenvolgende “goede” frames vóór bevestigen mag (ca. 0,2s @60fps) */
const OK_STREAK_TO_CONFIRM = 10

export function FaceVerifyScreen({ onBack, onIdVerificationSuccess }: Props) {
  const [useCam, setUseCam] = useState(true)
  const canCam = isSecureContextForCamera()
  const [link] = useState(
    () => (typeof window !== 'undefined' ? buildFaceVerifyLink() : ''),
  )
  const [err, setErr] = useState<string | null>(null)
  const [camReady, setCamReady] = useState(false)
  const [lightOk, setLightOk] = useState(false)
  const [contrastOk, setContrastOk] = useState(false)
  const [copyDone, setCopyDone] = useState(false)
  const [canConfirm, setCanConfirm] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const okStreak = useRef(0)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!useCam || !canCam) return
    let dead = false
    ;(async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
          audio: false,
        })
        if (dead) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = s
        const v = videoRef.current
        if (v) {
          v.srcObject = s
          v.setAttribute('playsinline', 'true')
          v.muted = true
          await v.play()
          setCamReady(true)
          setErr(null)
        }
      } catch {
        if (!dead) {
          setErr(
            'Geen toestemming voor de camera, of de camera is niet beschikbaar. Controleer je instellingen.',
          )
        }
      }
    })()
    return () => {
      dead = true
      stopStream()
    }
  }, [useCam, canCam, stopStream])

  useEffect(() => {
    if (!useCam || !camReady || !canCam) return
    let raf = 0
    const w = 160
    const h = 200
    const cvs = document.createElement('canvas')
    cvs.width = w
    cvs.height = h
    const ctx = cvs.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const tick = () => {
      const v = videoRef.current
      if (!v || v.readyState < 2) {
        raf = requestAnimationFrame(tick)
        return
      }
      const vw = v.videoWidth
      const vh = v.videoHeight
      if (vw < 2 || vh < 2) {
        raf = requestAnimationFrame(tick)
        return
      }
      ctx.drawImage(v, 0, 0, vw, vh, 0, 0, w, h)
      const { avg, spread } = sampleOvalLuma(ctx, w, h)
      const l = avg > LUMA_LO && avg < LUMA_HI
      const c = spread > SPREAD_MIN
      setLightOk(l)
      setContrastOk(c)
      if (l && c) {
        okStreak.current += 1
        if (okStreak.current >= OK_STREAK_TO_CONFIRM) {
          setCanConfirm(true)
        }
      } else {
        okStreak.current = 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [useCam, camReady, canCam])

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      setCopyDone(false)
    }
  }

  const allOk = canConfirm
  const canShowReadyHint = lightOk && contrastOk
  const finishWithSuccess = useCallback(() => {
    const shouldContinueBack = onIdVerificationSuccess?.()
    if (shouldContinueBack !== false) onBack()
  }, [onIdVerificationSuccess, onBack])

  if (!useCam) {
    return (
      <div
        className="yubo-screen-chat face-page"
        style={{ minHeight: '100dvh' }}
      >
        <header className="yubo-top compact" style={{ background: '#fff' }}>
          <button
            className="yubo-back"
            type="button"
            onClick={onBack}
            aria-label="Terug"
          >
            ‹
          </button>
          <h1 className="yubo-title face-title">Face-check</h1>
          <span style={{ width: 40 }} aria-hidden />
        </header>
        <div
          className="face-desktop with-tabbar"
          role="region"
          aria-label="QR-code"
        >
          <p className="face-desk__lead">
            Je kunt de controle op deze computer doen of de QR-code gebruiken
            op je telefoon.
          </p>
          <button type="button" className="face-copy face-copy--camera" onClick={() => setUseCam(true)}>
            Gebruik computercamera
          </button>
          {link && (
            <div className="face-qr">
              <QRCode
                value={link}
                size={220}
                style={{ maxWidth: '100%', height: 'auto' }}
                fgColor="#0f0f0f"
                bgColor="#ffffff"
              />
            </div>
          )}
          <button type="button" className="face-copy" onClick={copy}>
            {copyDone ? 'Gekopieërd' : 'Link kopiëren'}
          </button>
          <p className="face-desk__hint">
            Ondersteuning: <code>localhost</code> of <strong>https</strong>{' '}
            voor de camera. Geen camera op onveilige http (behalve lokaal).
          </p>
          <div className="face-verify-alt-box" role="region" aria-label="Alternatieve controle">
            <h2 className="face-verify-alt-box__h">Controle handmatig voltooien</h2>
            <p className="face-verify-alt-box__p">
              Gebruik je geen telefoon of camera? Dan kun je de status hier afronden.
            </p>
            <button
              type="button"
              className="face-verify-alt-cta"
              onClick={finishWithSuccess}
            >
              ID-check voltooid
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!canCam) {
    return (
      <div className="yubo-screen-chat face-page">
        <header className="yubo-top compact" style={{ background: '#fff' }}>
          <button className="yubo-back" type="button" onClick={onBack}>
            ‹
          </button>
          <h1 className="yubo-title face-title">Gezichtscontrole</h1>
          <span style={{ width: 40 }} aria-hidden />
        </header>
        <p className="face-secure-warn with-tabbar">
          Camera is alleen beschikbaar via <strong>https</strong> of op{' '}
          <code>localhost</code>. Open de app in een beveiligde context.
        </p>
        <div className="face-verify-alt-box face-verify-alt-box--tight" role="region" aria-label="Alternatieve controle">
          <h2 className="face-verify-alt-box__h">Controle handmatig voltooien</h2>
          <p className="face-verify-alt-box__p">
            Geen live camera? Rond de controle hier af.
          </p>
          <button
            type="button"
            className="face-verify-alt-cta"
            onClick={finishWithSuccess}
          >
            ID-check voltooid
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="yubo-screen-chat face-page"
      style={{ minHeight: '100dvh', maxHeight: '100dvh' }}
    >
      <header className="yubo-top compact" style={{ background: '#fff' }}>
        <button
          className="yubo-back"
          type="button"
          onClick={() => { stopStream(); onBack() }}
          aria-label="Terug"
        >
          ‹
        </button>
        <h1 className="yubo-title face-title" style={{ fontSize: '0.78rem' }}>
          Zet je gezicht in het ovaal
        </h1>
        <span style={{ width: 40 }} aria-hidden />
      </header>

      <div
        className="verify-stage with-tabbar face-cam"
      >
        <div
          className="verify-feed verify-feed--live"
          aria-label="Camerastream"
        >
          {err ? (
            <p className="face-err" role="alert">
              {err}
            </p>
          ) : null}
          <video
            ref={videoRef}
            className="face-video"
            autoPlay
            playsInline
            muted
            aria-label="Camerapreview"
          />
          <div className="verify-mask" aria-hidden />
          {allOk && !err && (
            <div className="verify-badge" aria-label="Geldig beeld herkend">
              ✓
            </div>
          )}
        </div>
        <div className="face-bottom">
          <p
            className={
              'verify-tip' +
              (allOk
                ? ' verify-tip--ok'
                : canShowReadyHint
                  ? ' verify-tip--hold'
                  : '')
            }
            role="status"
            aria-live="polite"
          >
            <span className="tip-ico" aria-hidden>
              💡
            </span>
            {allOk
              ? 'Klaar — tik op de knop Bevestigen om verder te gaan.'
              : canShowReadyHint
                ? 'Beeld is goed. Nog even vasthouden, dan activeert de knop Bevestigen…'
                : lightOk
                  ? 'Beweeg iets of kantel je hoofd, zodat we beweging of structuur zien.'
                  : 'Zorg voor voldoende (maar niet te fel) licht; gezicht in het ovaal.'}
          </p>
          <div className="face-done-row">
            <button
              type="button"
              className="face-confirm"
              disabled={!allOk}
              onClick={() => {
                if (!allOk) return
                stopStream()
                const shouldContinueBack = onIdVerificationSuccess?.()
                if (shouldContinueBack !== false) onBack()
              }}
              aria-label={allOk ? 'Bevestigen' : 'Bevestigen, nog even wachten op stabiel beeld'}
            >
              {allOk ? 'Bevestigen' : 'Bevestigen (zo meteen)'}
            </button>
          </div>
          {err ? (
            <div className="face-verify-alt-box face-verify-alt-box--inline" role="region" aria-label="Alternatieve controle">
              <p className="face-verify-alt-box__p">
                Camera lukt niet op deze computer? Rond de controle hier af.
              </p>
              <button
                type="button"
                className="face-verify-alt-cta"
                onClick={() => {
                  stopStream()
                  finishWithSuccess()
                }}
              >
                ID-check voltooid
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
