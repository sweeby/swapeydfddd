import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { ageFromBirthdate, isAgeEligible, MIN_AGE } from './lib/age'
import {
  applyStoredSessionToTabUser,
  clearAppSession,
  loadAppSession,
  loadSavedAccounts,
  restoreSavedAccount,
  type IdCheckPayload,
  type SavedAppAccount,
  saveAppSession,
} from './lib/appSession'
import {
  ensureNameClaimedIfMissing,
  isClaimedName,
  normNickname,
  releaseClaimedName,
  tryRegisterClaimedName,
} from './lib/claimedNames'
import { clearTabUserId, getOrCreateUserId } from './lib/realChatSync'
import { clearAdminLocalData } from './lib/incomingSwipes'
import {
  hasFaceVerifyParam,
  hasQuickParam,
  stripFaceVerifyParamsFromUrl,
} from './lib/faceEnv'
import { OnboardingLayout } from './OnboardingLayout'
import { FaceVerifyScreen } from './yubo/FaceVerifyScreen'
import { YuboApp } from './yubo/YuboApp'
import './App.css'

type Screen = 'landing' | 'profile' | 'age' | 'id_verify' | 'face_verify' | 'age_blocked' | 'home'

type AppBoot = {
  screen: Screen
  name: string
  birthdate: string
  idV: boolean
  openFace: boolean
  trustedLogin: boolean
}

type LoginProvider = 'Google'

const DEFAULT_GOOGLE_CLIENT_ID =
  '954108778469-e6f6a00t0np6h3t4sjpkm2tpvsm5iab8.apps.googleusercontent.com'
const TRUSTED_AUTH_KEY = 'swipey-trusted-auth-provider-v1'

function makeLoginState(provider: LoginProvider) {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${provider.toLowerCase()}:${raw}`
}

function currentOriginRedirect(path: string) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${path}`
}

function markTrustedAuth(provider: LoginProvider) {
  try {
    sessionStorage.setItem(TRUSTED_AUTH_KEY, provider)
  } catch {
    /* */
  }
}

function hasTrustedAuth(): boolean {
  try {
    return sessionStorage.getItem(TRUSTED_AUTH_KEY) === 'Google'
  } catch {
    return false
  }
}

function clearTrustedAuth() {
  try {
    sessionStorage.removeItem(TRUSTED_AUTH_KEY)
  } catch {
    /* */
  }
}

function consumeAuthCallback(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  const params = new URLSearchParams(window.location.search)
  const hasSuccess = params.has('code') || params.has('credential')
  const state = params.get('state') || ''
  const isAuthCallback =
    path === '/auth/google/callback' ||
    (hasSuccess && state.toLowerCase().startsWith('google:'))
  if (!isAuthCallback) return false
  if (!hasSuccess) return false
  markTrustedAuth('Google')
  window.history.replaceState({}, '', '/')
  return true
}

function consumeClearProfilesParam(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('clearProfiles') !== '1') return false
  clearAdminLocalData()
  clearAppSession()
  clearTabUserId()
  params.delete('clearProfiles')
  const query = params.toString()
  window.history.replaceState(
    {},
    '',
    window.location.pathname + (query ? `?${query}` : '') + window.location.hash,
  )
  return true
}

function getInitialState(): AppBoot {
  if (typeof window === 'undefined') {
    return {
      screen: 'landing',
      name: '',
      birthdate: '',
      idV: false,
      openFace: false,
      trustedLogin: false,
    }
  }
  /* Zodat matches/chats/shop dezelfde `userId` houden als in opgeslagen account (ook nieuw tabblad). */
  if (consumeClearProfilesParam()) {
    return {
      screen: 'landing',
      name: '',
      birthdate: '',
      idV: false,
      openFace: false,
      trustedLogin: false,
    }
  }
  applyStoredSessionToTabUser()
  if (consumeAuthCallback()) {
    const current = loadAppSession()
    if (current?.idVerified) {
      applyStoredSessionToTabUser()
      return {
        screen: 'home',
        name: current.name,
        birthdate: current.birthdate,
        idV: true,
        openFace: false,
        trustedLogin: false,
      }
    }
    const accounts = loadSavedAccounts()
    if (accounts.length > 0) {
      const restored = restoreSavedAccount(accounts[0])
      applyStoredSessionToTabUser()
      return {
        screen: 'home',
        name: restored.name,
        birthdate: restored.birthdate,
        idV: true,
        openFace: false,
        trustedLogin: false,
      }
    }
    return {
      screen: 'profile',
      name: '',
      birthdate: '',
      idV: false,
      openFace: false,
      trustedLogin: true,
    }
  }
  const fromFace = hasFaceVerifyParam()
  const q = hasQuickParam()
  if (fromFace) {
    const s = loadAppSession()
    return {
      screen: 'home',
      name: q ? 'Gast' : (s?.name ?? ''),
      birthdate: s?.birthdate ?? '',
      idV: q || !!s?.idVerified,
      openFace: true,
      trustedLogin: false,
    }
  }
  if (q) {
    const s = loadAppSession()
    if (s?.idVerified) {
      return {
        screen: 'home',
        name: s.name || 'Gast',
        birthdate: s.birthdate,
        idV: true,
        openFace: false,
        trustedLogin: false,
      }
    }
    saveAppSession({
      v: 1,
      name: 'Gast',
      birthdate: '2000-01-01',
      idVerified: true,
      userId: getOrCreateUserId(),
    })
    return {
      screen: 'home',
      name: 'Gast',
      birthdate: '2000-01-01',
      idV: true,
      openFace: false,
      trustedLogin: false,
    }
  }
  if (hasTrustedAuth()) {
    return {
      screen: 'profile',
      name: '',
      birthdate: '',
      idV: false,
      openFace: false,
      trustedLogin: true,
    }
  }
  const s = loadAppSession()
  if (s?.birthdate) {
    const a = ageFromBirthdate(s.birthdate)
    if (!isAgeEligible(a)) {
      const name = s.name
      const birthdate = s.birthdate
      clearAppSession()
      return {
        screen: 'age_blocked',
        name,
        birthdate,
        idV: false,
        openFace: false,
        trustedLogin: false,
      }
    }
  }
  if (s?.idVerified) {
    return {
      screen: 'home',
      name: s.name,
      birthdate: s.birthdate,
      idV: true,
      openFace: false,
      trustedLogin: false,
    }
  }
  return {
    screen: 'landing',
    name: '',
    birthdate: '',
    idV: false,
    openFace: false,
    trustedLogin: false,
  }
}

const _init = getInitialState()

export default function App() {
  const [screen, setScreen] = useState<Screen>(_init.screen)
  const [name, setName] = useState(_init.name)
  const [birthdate, setBirthdate] = useState(_init.birthdate)
  const [ageError, setAgeError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [savedAccounts, setSavedAccounts] = useState<SavedAppAccount[]>(() =>
    typeof window === 'undefined' ? [] : loadSavedAccounts(),
  )
  const [showSavedAccounts, setShowSavedAccounts] = useState(false)
  const [idVerified, setIdVerified] = useState(_init.idV)
  const [faceFromQr, setFaceFromQr] = useState(_init.openFace)
  const [trustedLogin, setTrustedLogin] = useState(_init.trustedLogin)
  const [idCheckSubmitting, setIdCheckSubmitting] = useState(false)
  const [idDocType, setIdDocType] = useState<'passport' | 'id_card'>('passport')
  const [idFirstName, setIdFirstName] = useState('')
  const [idLastName, setIdLastName] = useState('')
  const [idBirthdate, setIdBirthdate] = useState('')
  const [idFrontImage, setIdFrontImage] = useState<File | null>(null)
  const [idBackImage, setIdBackImage] = useState<File | null>(null)
  const [idExpiry, setIdExpiry] = useState('')
  const [idNationality, setIdNationality] = useState('')
  const [idVerifyError, setIdVerifyError] = useState<string | null>(null)
  const [pendingIdCheck, setPendingIdCheck] = useState<IdCheckPayload | null>(null)
  const nameFieldId = useId()
  const dateFieldId = useId()
  const idFormBase = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const idFirstNameInputRef = useRef<HTMLInputElement>(null)
  const idCheckBtnRef = useRef<HTMLButtonElement>(null)
  const idCheckSubmittingRef = useRef(false)

  const age = birthdate ? ageFromBirthdate(birthdate) : -1
  const canProceedAge = Boolean(birthdate) && isAgeEligible(age)

  const nameTrim = name.trim()
  const nameTooLong = nameTrim.length > 32
  const nameTaken = nameTrim.length > 0 && !nameTooLong && isClaimedName(name)

  useEffect(() => {
    stripFaceVerifyParamsFromUrl()
  }, [])

  useEffect(() => {
    const s = loadAppSession()
    if (s?.idVerified) ensureNameClaimedIfMissing(s.name)
  }, [])

  useEffect(() => {
    const s = loadAppSession()
    if (s?.idVerified && !s.userId) {
      applyStoredSessionToTabUser()
      saveAppSession({ ...s, userId: getOrCreateUserId() })
    }
  }, [])

  useEffect(() => {
    if (screen !== 'profile') return
    const id = requestAnimationFrame(() => nameInputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [screen])

  useEffect(() => {
    if (screen !== 'id_verify') return
    const t = requestAnimationFrame(() => idFirstNameInputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [screen])

  function goProfileToAge(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (n.length === 0) {
      setProfileError('Vul een bijnaam in (minstens 1 teken).')
      nameInputRef.current?.focus()
      return
    }
    if (n.length > 32) {
      setProfileError('Bijnaam is te lang (max. 32 tekens).')
      return
    }
    if (isClaimedName(n)) {
      setProfileError('Deze bijnaam is al in gebruik. Kies een andere.')
      nameInputRef.current?.focus()
      return
    }
    setProfileError(null)
    setScreen('age')
  }

  function startProviderLogin(provider: LoginProvider) {
    setLoginError(null)
    setShowSavedAccounts(false)
    const state = makeLoginState(provider)
    try {
      sessionStorage.setItem('swipey-auth-state', state)
    } catch {
      /* Auth blijft werken; state-check kan dan alleen server-side. */
    }

    if (provider === 'Google') {
      const clientId =
        import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || DEFAULT_GOOGLE_CLIENT_ID
      const redirectUri =
        import.meta.env.VITE_GOOGLE_REDIRECT_URI?.trim() ||
        currentOriginRedirect('/auth/google/callback')
      if (!clientId) {
        setLoginError('Google login is nog niet ingesteld. Zet VITE_GOOGLE_CLIENT_ID en een Google OAuth callback-URL.')
        return
      }
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'openid profile email')
      url.searchParams.set('prompt', 'select_account')
      url.searchParams.set('state', state)
      window.location.assign(url.toString())
      return
    }

  }

  function loginExistingAccount(account: SavedAppAccount) {
    const s = restoreSavedAccount(account)
    applyStoredSessionToTabUser()
    ensureNameClaimedIfMissing(s.name)
    setName(s.name)
    setBirthdate(s.birthdate)
    setIdVerified(true)
    setFaceFromQr(false)
    setTrustedLogin(false)
    setLoginError(null)
    setShowSavedAccounts(false)
    setScreen('home')
  }

  function openExistingLogin() {
    const accounts = loadSavedAccounts()
    setSavedAccounts(accounts)
    setLoginError(null)
    if (accounts.length === 0) {
      setShowSavedAccounts(false)
      setLoginError('Geen bestaand account gevonden op dit apparaat.')
      return
    }
    if (accounts.length === 1) {
      loginExistingAccount(accounts[0])
      return
    }
    setShowSavedAccounts((v) => !v)
  }

  function submitAgeForm(e: FormEvent) {
    e.preventDefault()
    setAgeError(null)
    if (!birthdate) {
      setAgeError('Kies je geboortedatum.')
      return
    }
    if (!isAgeEligible(age)) {
      setScreen('age_blocked')
      return
    }
    if (trustedLogin) {
      const n = (name || '').trim() || 'Gast'
      ensureNameClaimedIfMissing(n)
      saveAppSession({
        v: 1,
        name: n,
        birthdate,
        idVerified: true,
        userId: getOrCreateUserId(),
      })
      setIdVerified(true)
      setFaceFromQr(false)
      setTrustedLogin(false)
      clearTrustedAuth()
      setScreen('home')
      return
    }
    setScreen('id_verify')
  }

  function leaveAgeBlocked() {
    setName('')
    setBirthdate('')
    setAgeError(null)
    setProfileError(null)
    setTrustedLogin(false)
    clearTrustedAuth()
    setScreen('landing')
  }

  function markIdVerifiedInSession() {
    setIdVerified(true)
    const s = loadAppSession()
    if (s) {
      saveAppSession({
        ...s,
        idVerified: true,
        userId: s.userId ?? getOrCreateUserId(),
      })
      return
    }
    const n = (name || '').trim() || 'Gast'
    if (birthdate) {
      saveAppSession({
        v: 1,
        name: n,
        birthdate,
        idVerified: true,
        userId: getOrCreateUserId(),
      })
      ensureNameClaimedIfMissing(n)
    }
  }

  function validateIdImageFile(file: File | null, sideLabel: string): string | null {
    if (!file) return `Voeg een foto of bestand toe van de ${sideLabel} van je document.`
    if (!file.type.startsWith('image/')) {
      return `Gebruik een foto/afbeelding voor de ${sideLabel} van je document.`
    }
    if (file.size < 35 * 1024) {
      return `De foto van de ${sideLabel} lijkt te klein of onduidelijk. Zorg dat het hele paspoort/document scherp in beeld staat.`
    }
    if (file.size > 10 * 1024 * 1024) {
      return `De foto van de ${sideLabel} is te groot. Gebruik maximaal 10 MB.`
    }
    return null
  }

  function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      const done = (value: { width: number; height: number } | null) => {
        URL.revokeObjectURL(url)
        resolve(value)
      }
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => done(null)
      img.src = url
    })
  }

  async function validateIdImageQuality(file: File | null, sideLabel: string): Promise<string | null> {
    const basic = validateIdImageFile(file, sideLabel)
    if (basic) return basic
    if (!file) return `Voeg een foto of bestand toe van de ${sideLabel} van je document.`
    const size = await getImageDimensions(file)
    if (!size) {
      return `De foto van de ${sideLabel} kon niet worden gecontroleerd. Maak opnieuw een foto.`
    }
    if (Math.max(size.width, size.height) < 900 || Math.min(size.width, size.height) < 500) {
      return `De foto van de ${sideLabel} is te klein. Zet het hele paspoort/document in beeld en maak opnieuw een scherpe foto.`
    }
    return null
  }

  function validateIdFormFields(): { ok: true; payload: IdCheckPayload } | { ok: false; message: string } {
    const first = idFirstName.trim()
    const last = idLastName.trim()
    const nat = idNationality.trim()
    if (first.length < 1) {
      return { ok: false, message: 'Vul de voornamen in zoals op je paspoort of ID-kaart.' }
    }
    if (last.length < 1) {
      return { ok: false, message: 'Vul de achternaam in zoals op je document.' }
    }
    if (first.length > 100 || last.length > 100) {
      return { ok: false, message: 'Naam is te lang — gebruik de schrijfwijze op je document.' }
    }
    if (!idBirthdate) {
      return { ok: false, message: 'Vul de geboortedatum die op je document staat.' }
    }
    const dob = new Date(idBirthdate)
    if (Number.isNaN(dob.getTime()) || idBirthdate > new Date().toISOString().slice(0, 10)) {
      return { ok: false, message: 'Geboortedatum op document is ongeldig of in de toekomst.' }
    }
    const frontImage = idFrontImage
    const backImage = idBackImage
    const frontImageError = validateIdImageFile(frontImage, 'voorkant')
    if (frontImageError) return { ok: false, message: frontImageError }
    const backImageError = validateIdImageFile(backImage, 'achterkant')
    if (backImageError) return { ok: false, message: backImageError }
    if (!frontImage || !backImage) {
      return { ok: false, message: 'Voeg de voorkant en achterkant van je document toe.' }
    }
    if (!idExpiry) {
      return { ok: false, message: 'Kies de vervaldatum (geldig tot) van je document.' }
    }
    const ex = new Date(idExpiry)
    ex.setHours(12, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (Number.isNaN(ex.getTime()) || ex < today) {
      return { ok: false, message: 'Document is verlopen of de datum is ongeldig.' }
    }
    if (nat.length < 2) {
      return { ok: false, message: 'Vul nationaliteit of land van uitgifte in (bijv. NL of Nederland).' }
    }
    if (nat.length > 64) {
      return { ok: false, message: 'Nationaliteit/land: maximaal 64 tekens.' }
    }
    return {
      ok: true,
      payload: {
        docType: idDocType,
        firstName: first,
        lastName: last,
        birthdateOnDocument: idBirthdate,
        documentFrontImageName: frontImage.name,
        documentBackImageName: backImage.name,
        expires: idExpiry,
        nationality: nat,
      },
    }
  }

  function runIdCheckCompletion(idCheck: IdCheckPayload) {
    if (idCheckSubmittingRef.current) return
    setProfileError(null)
    setAgeError(null)
    setIdVerifyError(null)

    const n = name.trim()
    if (n.length === 0) {
      setProfileError('Geen bijnaam. Ga terug en kies een bijnaam.')
      setScreen('profile')
      return
    }
    if (!birthdate) {
      setAgeError('Kies je geboortedatum op de vorige stap.')
      setScreen('age')
      return
    }
    const ag = ageFromBirthdate(birthdate)
    if (!isAgeEligible(ag)) {
      setScreen('age_blocked')
      return
    }
    const agDoc = ageFromBirthdate(idCheck.birthdateOnDocument)
    if (agDoc < 0 || !isAgeEligible(agDoc)) {
      setBirthdate(idCheck.birthdateOnDocument)
      setScreen('age_blocked')
      return
    }

    const already = loadAppSession()
    if (
      already?.idVerified &&
      normNickname(already.name) === normNickname(n) &&
      already.birthdate === birthdate
    ) {
      setIdVerified(true)
      setScreen('home')
      return
    }

    idCheckSubmittingRef.current = true
    setIdCheckSubmitting(true)

    const goHome = () => {
      setIdVerified(true)
      setScreen('home')
    }

    try {
      if (!tryRegisterClaimedName(n)) {
        const s = loadAppSession()
        if (s?.idVerified && normNickname(s.name) === normNickname(n)) {
          saveAppSession({ ...s, idCheck: idCheck, userId: s.userId ?? getOrCreateUserId() })
          goHome()
          return
        }
        setProfileError(
          'Deze bijnaam is inmiddels door iemand anders in gebruik. Kies een andere op de vorige stap.',
        )
        setScreen('profile')
        return
      }

      saveAppSession({
        v: 1,
        name: n,
        birthdate,
        idVerified: true,
        idCheck,
        userId: getOrCreateUserId(),
      })
      goHome()
    } finally {
      idCheckSubmittingRef.current = false
      setIdCheckSubmitting(false)
    }
  }

  async function submitIdVerifyForm(e: FormEvent) {
    e.preventDefault()
    const v = validateIdFormFields()
    if (v.ok === false) {
      setIdVerifyError(v.message)
      return
    }
    const frontQualityError = await validateIdImageQuality(idFrontImage, 'voorkant')
    if (frontQualityError) {
      setIdVerifyError(frontQualityError)
      return
    }
    const backQualityError = await validateIdImageQuality(idBackImage, 'achterkant')
    if (backQualityError) {
      setIdVerifyError(backQualityError)
      return
    }
    const ageOnDoc = ageFromBirthdate(v.payload.birthdateOnDocument)
    if (!isAgeEligible(ageOnDoc)) {
      setIdVerifyError(null)
      setBirthdate(v.payload.birthdateOnDocument)
      setScreen('age_blocked')
      return
    }
    if (v.payload.birthdateOnDocument !== birthdate) {
      setBirthdate(v.payload.birthdateOnDocument)
    }
    setIdVerifyError(null)
    setPendingIdCheck(v.payload)
    setScreen('face_verify')
  }

  const isOnboard =
    screen === 'profile' || screen === 'age' || screen === 'id_verify'

  return (
    <div
      className={
        screen === 'home' || screen === 'face_verify'
          ? 'app-shell app-shell--yubo'
          : screen === 'landing'
            ? 'app-shell app-shell--login'
            : screen === 'age_blocked'
              ? 'app-shell app-shell--age-blocked'
            : isOnboard
              ? 'app-shell app-shell--onboard'
              : 'app-shell'
      }
    >
      {screen === 'landing' && (
        <section
          className="login-hero"
          aria-label="Swipey: starten of inloggen"
        >
          <div className="login-bg" role="img" aria-hidden>
            <img
              className="login-bg__img"
              src="/banner.png"
              alt=""
              width={1600}
              height={600}
              fetchPriority="high"
              decoding="async"
            />
          </div>
          <div className="login-ambient" aria-hidden />
          <div className="login-scrim" aria-hidden />
          <div className="login-vignette" aria-hidden />
          <div className="login-content">
            <div className="login-card" role="region" aria-label="Aan de slag">
              <p className="login-logo" aria-label="Swipey">
                <img
                  className="login-logo__img"
                  src="/logo.png"
                  alt="Swipey"
                  width={220}
                  height={88}
                  decoding="async"
                />
              </p>
              <h1 className="login-title">
                <span className="login-title__meet">Meet.</span>{' '}
                <span className="login-title__match">Match.</span>{' '}
                <span className="login-title__vibe">Vibe.</span>
              </h1>
              <p className="login-strapline">
                Swipe right, maak échte connecties. Nieuwe mensen, nieuwe vibes,
                op jouw manier.
              </p>
              <p className="login-cta-words">
                Be yourself.{' '}
                <span className="login-cta-words__accent">
                  Find your people.
                </span>
              </p>
              <button
                type="button"
                className="btn primary btn-cta"
                onClick={() => setScreen('profile')}
              >
                Aan de slag
              </button>
              <button
                type="button"
                className="login-existing"
                onClick={openExistingLogin}
              >
                Inloggen op bestaand account
              </button>
              {loginError ? (
                <p className="login-error" role="alert">
                  {loginError}
                </p>
              ) : null}
              {showSavedAccounts ? (
                <div className="login-saved-accounts" aria-label="Bestaande accounts">
                  {savedAccounts.map((account) => (
                    <button
                      key={account.userId || `${account.name}-${account.birthdate}`}
                      type="button"
                      className="login-saved-accounts__item"
                      onClick={() => loginExistingAccount(account)}
                    >
                      <span className="login-saved-accounts__avatar" aria-hidden>
                        {account.name.trim().slice(0, 1).toUpperCase() || 'S'}
                      </span>
                      <span>
                        <strong>{account.name}</strong>
                        <small>Swipey account</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="login-social" aria-label="Inloggen">
                <button
                  type="button"
                  className="login-social__btn"
                  onClick={() => startProviderLogin('Google')}
                >
                  <span aria-hidden>G</span>
                  Log in met Google
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {screen === 'profile' && (
        <OnboardingLayout aria-label="Bijnaam kiezen">
          <p className="onboard-brand" aria-hidden>
            <img
              className="onboard-brand__img"
              src="/logo.png"
              alt=""
              width={200}
              height={80}
              decoding="async"
            />
          </p>
          <form className="onboard-form" onSubmit={goProfileToAge} noValidate>
            <button
              type="button"
              className="link back"
              onClick={() => {
                setProfileError(null)
                setTrustedLogin(false)
                setScreen('landing')
              }}
            >
              <span className="onboard-back__chev" aria-hidden>‹</span> Terug
            </button>
            <h1 className="onboard-title">Hoe mogen we je noemen?</h1>
            <p className="onboard-mute">
              Een vriendelijke bijnaam is genoeg, geen volledige naam nodig in
              Swipey.
            </p>
            <label className="field" htmlFor={nameFieldId}>
              <span>Bijnaam</span>
              <input
                ref={nameInputRef}
                id={nameFieldId}
                name="nickname"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (profileError) setProfileError(null)
                }}
                onBlur={() => {
                  if (
                    name.trim().length > 0 &&
                    !nameTooLong &&
                    isClaimedName(name)
                  ) {
                    setProfileError(
                      'Deze bijnaam is al in gebruik. Kies een andere.',
                    )
                  }
                }}
                maxLength={32}
                placeholder="bijv. Milo"
                autoComplete="nickname"
                aria-invalid={!!(profileError || nameTaken)}
                aria-describedby={
                  profileError || nameTaken ? `${nameFieldId}-err` : undefined
                }
                className="input-elevated"
              />
            </label>
            {(profileError || nameTaken) && (
              <p id={`${nameFieldId}-err`} className="error" role="alert">
                {profileError ||
                  (nameTaken
                    ? 'Deze bijnaam is al in gebruik. Kies een andere.'
                    : null)}
              </p>
            )}
            <button
              type="submit"
              className="btn primary"
              disabled={!nameTrim || nameTooLong || nameTaken}
            >
              Volgende: leeftijd
            </button>
          </form>
        </OnboardingLayout>
      )}

      {screen === 'age' && (
        <OnboardingLayout aria-label="Geboortedatum">
          <p className="onboard-brand" aria-hidden>
            <img
              className="onboard-brand__img"
              src="/logo.png"
              alt=""
              width={200}
              height={80}
              decoding="async"
            />
          </p>
          <form className="onboard-form" onSubmit={submitAgeForm} noValidate>
            <button
              type="button"
              className="link back"
              onClick={() => setScreen('profile')}
            >
              <span className="onboard-back__chev" aria-hidden>‹</span> Terug
            </button>
            <h1 className="onboard-title">Je leeftijd</h1>
            <p className="onboard-mute">
              We gebruiken je geboortedatum om te controleren of je {MIN_AGE} jaar
              of ouder bent. Zonder geldige leeftijd geen toegang tot de app.
            </p>
            <label className="field" htmlFor={dateFieldId}>
              <span>Geboortedatum</span>
              <input
                id={dateFieldId}
                name="birthdate"
                type="date"
                value={birthdate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setBirthdate(e.target.value)
                  if (ageError) setAgeError(null)
                }}
                required
                aria-invalid={!!ageError}
                className="input-elevated input-date"
              />
            </label>
            {birthdate !== '' && !canProceedAge && (
              <p className="error" role="status">
                Je moet minimaal {MIN_AGE} zijn om verder te gaan.
              </p>
            )}
            {ageError && (
              <p className="error" role="alert">
                {ageError}
              </p>
            )}
            {canProceedAge && (
              <p className="ok" role="status">
                Geschatte leeftijd: {age} jaar. Je mag door naar de volgende stap.
              </p>
            )}
            <button
              type="submit"
              className="btn primary"
              disabled={!birthdate}
            >
              {canProceedAge ? 'Ga door' : 'Controleer leeftijd'}
            </button>
          </form>
        </OnboardingLayout>
      )}

      {screen === 'id_verify' && (
        <OnboardingLayout aria-label="ID en paspoort">
          <p className="onboard-brand" aria-hidden>
            <img
              className="onboard-brand__img"
              src="/logo.png"
              alt=""
              width={200}
              height={80}
              decoding="async"
            />
          </p>
          <form className="onboard-form onboard-form--id-verify" onSubmit={submitIdVerifyForm} noValidate>
            <button
              type="button"
              className="link back onboard-id-back"
              disabled={idCheckSubmitting}
              onClick={() => {
                setIdVerifyError(null)
                setScreen('age')
              }}
            >
              <span className="onboard-back__chev" aria-hidden>‹</span> Terug
            </button>
            <h1 className="onboard-title">Identiteitsbewijs</h1>
            <p className="onboard-mute">
              Vul je <strong>paspoort- of identiteitskaartgegevens</strong> in. In een
              productieapp zou een leverancier zoals Yoti dit verifiëren; in deze
              build wordt het alleen lokaal in je browser opgeslagen.
            </p>
            {profileError ? (
              <p className="error" role="alert" style={{ margin: '0 0 0.6rem' }}>
                {profileError}
              </p>
            ) : null}
            {idVerifyError ? (
              <p className="error" role="alert" style={{ margin: '0 0 0.5rem' }}>
                {idVerifyError}
              </p>
            ) : null}
            <div
              className="verify-box verify-box--onboard verify-box--id-cta onboard-id-form"
              role="region"
              aria-label="Documentgegevens"
            >
              <h2>Document</h2>
              <p className="onboard-mute" style={{ margin: '0 0 0.6rem' }}>
                Exacte schrijfwijze zoals in het machineleesbare deel van je paspoort/ID
                (latijnse letters).
              </p>
              <label className="field" htmlFor={`${idFormBase}-type`}>
                <span>Soort document</span>
                <select
                  id={`${idFormBase}-type`}
                  className="input-elevated onboard-id-form__select"
                  value={idDocType}
                  onChange={(e) =>
                    setIdDocType(e.target.value as 'passport' | 'id_card')
                  }
                  disabled={idCheckSubmitting}
                >
                  <option value="passport">Paspoort</option>
                  <option value="id_card">Identiteitskaart (nationale ID-kaart)</option>
                </select>
              </label>
              <div className="onboard-id-form__row">
                <label className="field" htmlFor={`${idFormBase}-first`}>
                  <span>Voornamen</span>
                  <input
                    id={`${idFormBase}-first`}
                    ref={idFirstNameInputRef}
                    name="idFirst"
                    className="input-elevated"
                    type="text"
                    autoComplete="given-name"
                    value={idFirstName}
                    onChange={(e) => {
                      setIdFirstName(e.target.value)
                      if (idVerifyError) setIdVerifyError(null)
                    }}
                    maxLength={100}
                    required
                    disabled={idCheckSubmitting}
                    placeholder="bijv. JAN PETER"
                  />
                </label>
                <label className="field" htmlFor={`${idFormBase}-last`}>
                  <span>Achternaam</span>
                  <input
                    id={`${idFormBase}-last`}
                    name="idLast"
                    className="input-elevated"
                    type="text"
                    autoComplete="family-name"
                    value={idLastName}
                    onChange={(e) => {
                      setIdLastName(e.target.value)
                      if (idVerifyError) setIdVerifyError(null)
                    }}
                    maxLength={100}
                    required
                    disabled={idCheckSubmitting}
                    placeholder="bijv. JANSEN"
                  />
                </label>
              </div>
              <label className="field" htmlFor={`${idFormBase}-dob`}>
                <span>Geboortedatum (op document)</span>
                <input
                  id={`${idFormBase}-dob`}
                  className="input-elevated input-date"
                  type="date"
                  name="dobOnDoc"
                  value={idBirthdate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setIdBirthdate(e.target.value)
                    if (idVerifyError) setIdVerifyError(null)
                  }}
                  required
                  disabled={idCheckSubmitting}
                />
              </label>
              <div className="onboard-id-form__row">
                <div className="field">
                  <span>Foto voorkant paspoort/document</span>
                  <input
                    id={`${idFormBase}-front-photo`}
                    className="onboard-id-photo-input"
                    type="file"
                    name="documentFrontPhoto"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      setIdFrontImage(e.currentTarget.files?.[0] ?? null)
                      if (idVerifyError) setIdVerifyError(null)
                    }}
                    required
                    disabled={idCheckSubmitting}
                  />
                  <label
                    className="onboard-id-photo-card"
                    htmlFor={`${idFormBase}-front-photo`}
                    aria-disabled={idCheckSubmitting}
                  >
                    <span className="onboard-id-photo-card__icon" aria-hidden>
                      📷
                    </span>
                    <span className="onboard-id-photo-card__main">Neem nu foto</span>
                    <span className="onboard-id-photo-card__sub">
                      hele document in beeld
                    </span>
                    <span className="onboard-id-photo-card__hint">
                      Leg het paspoort plat, zonder afgesneden hoeken.
                    </span>
                    <span className="onboard-id-photo-card__file">
                      {idFrontImage ? idFrontImage.name : 'Nog geen foto gekozen'}
                    </span>
                  </label>
                </div>
                <div className="field">
                  <span>Foto achterkant paspoort/document</span>
                  <input
                    id={`${idFormBase}-back-photo`}
                    className="onboard-id-photo-input"
                    type="file"
                    name="documentBackPhoto"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      setIdBackImage(e.currentTarget.files?.[0] ?? null)
                      if (idVerifyError) setIdVerifyError(null)
                    }}
                    required
                    disabled={idCheckSubmitting}
                  />
                  <label
                    className="onboard-id-photo-card"
                    htmlFor={`${idFormBase}-back-photo`}
                    aria-disabled={idCheckSubmitting}
                  >
                    <span className="onboard-id-photo-card__icon" aria-hidden>
                      📷
                    </span>
                    <span className="onboard-id-photo-card__main">Neem nu foto</span>
                    <span className="onboard-id-photo-card__sub">
                      hele document in beeld
                    </span>
                    <span className="onboard-id-photo-card__hint">
                      Zorg dat de achterkant volledig en scherp zichtbaar is.
                    </span>
                    <span className="onboard-id-photo-card__file">
                      {idBackImage ? idBackImage.name : 'Nog geen foto gekozen'}
                    </span>
                  </label>
                </div>
              </div>
              <div className="onboard-id-form__row">
                <label className="field" htmlFor={`${idFormBase}-exp`}>
                  <span>Geldig tot</span>
                  <input
                    id={`${idFormBase}-exp`}
                    className="input-elevated input-date"
                    type="date"
                    name="idExpires"
                    value={idExpiry}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      setIdExpiry(e.target.value)
                      if (idVerifyError) setIdVerifyError(null)
                    }}
                    required
                    disabled={idCheckSubmitting}
                  />
                </label>
                <label className="field" htmlFor={`${idFormBase}-nat`}>
                  <span>Nationaliteit / land</span>
                  <input
                    id={`${idFormBase}-nat`}
                    className="input-elevated"
                    type="text"
                    name="nationality"
                    value={idNationality}
                    onChange={(e) => {
                      setIdNationality(e.target.value)
                      if (idVerifyError) setIdVerifyError(null)
                    }}
                    maxLength={64}
                    required
                    disabled={idCheckSubmitting}
                    placeholder="bijv. NLD of Nederland"
                    autoComplete="country-name"
                  />
                </label>
              </div>
              <button
                ref={idCheckBtnRef}
                type="submit"
                className="btn btn--id-verify"
                disabled={idCheckSubmitting}
                aria-busy={idCheckSubmitting}
              >
                {idCheckSubmitting ? 'Bezig met opslaan…' : 'ID-check voltooien'}
              </button>
            </div>
          </form>
        </OnboardingLayout>
      )}

      {screen === 'age_blocked' && (
        <section
          className="age-blocked"
          role="document"
          aria-labelledby="age-blocked-title"
        >
          <header className="age-blocked__top">
            <span className="age-blocked__spacer" aria-hidden />
            <h1 id="age-blocked-title" className="age-blocked__title">
              Leeftijdsgrens
            </h1>
            <span className="age-blocked__spacer" aria-hidden>
              <span className="age-blocked__gear" aria-hidden>
                ⚙
              </span>
            </span>
          </header>
          <p className="age-blocked__text">
            Je moet {MIN_AGE} zijn om Swipey te gebruiken. Zonder geldige leeftijd
            kun je niet verder: je profiel en chats zijn niet beschikbaar totdat je
            oud genoeg bent.
          </p>
          <div className="age-blocked__art" aria-hidden>
            <svg
              className="age-blocked__illu"
              viewBox="0 0 100 100"
              width={120}
              height={120}
            >
              <path
                d="M50 90 C20 70 4 50 4 36 C4 20 20 8 36 12 C44 2 50 0 50 0 C50 0 56 2 64 12 C80 8 96 20 96 36 C96 50 80 70 50 90 Z"
                fill="#f5d000"
                stroke="#0a0a0a"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="50" cy="40" r="12" fill="none" stroke="#0a0a0a" strokeWidth="2" />
              <line
                x1="50"
                y1="40"
                x2="50"
                y2="32"
                stroke="#0a0a0a"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="50"
                y1="40"
                x2="57"
                y2="44"
                stroke="#0a0a0a"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="age-blocked__linkline">
            <a
              className="age-blocked__link"
              href="https://www.rijksoverheid.nl/onderwerpen/jeugd"
              target="_blank"
              rel="noreferrer"
            >
              Lees voor meer informatie de community-richtlijnen
            </a>
            .
          </p>
          <div className="age-blocked__actions">
            <a
              className="age-blocked__btn"
              href="https://www.rijksoverheid.nl/onderwerpen/jeugd"
              target="_blank"
              rel="noreferrer"
            >
              Meer informatie
            </a>
            <button
              type="button"
              className="age-blocked__back"
              onClick={leaveAgeBlocked}
            >
              <span className="age-blocked__back__chev" aria-hidden>‹</span>
              {' '}
              Terug naar start
            </button>
          </div>
        </section>
      )}

      {screen === 'face_verify' && (
        <FaceVerifyScreen
          onBack={() => {
            setScreen('id_verify')
          }}
          onIdVerificationSuccess={() => {
            if (!pendingIdCheck) {
              setIdVerifyError('Gezichtscontrole mist ID-gegevens. Vul de ID-check opnieuw in.')
              setScreen('id_verify')
              return false
            }
            runIdCheckCompletion(pendingIdCheck)
            setPendingIdCheck(null)
            return false
          }}
        />
      )}

      {screen === 'home' && (
        <YuboApp
          displayName={name.trim() || 'there'}
          didCompleteAgeFlow={idVerified}
          faceVerifyOnLaunch={faceFromQr}
          onIdVerificationSuccess={markIdVerifiedInSession}
          onBackToOnboarding={() => {
            const s = loadAppSession()
            if (s) {
              saveAppSession(s)
              releaseClaimedName(s.name)
            }
            clearAppSession()
            clearTabUserId()
            setFaceFromQr(false)
            setName('')
            setBirthdate('')
            setIdVerified(false)
            setTrustedLogin(false)
            setScreen('landing')
          }}
        />
      )}
    </div>
  )
}
