export type MatchGenderPreference = 'man' | 'vrouw' | 'iedereen'

export type MatchPreferences = {
  gender: MatchGenderPreference
  minAge: number
  maxAge: number
  flexibleAge: boolean
  nearbyOnly: boolean
  locationEnabled: boolean
  locationLabel?: string
  maxDistanceKm: number
}

const KEY = 'swipey-match-preferences-v1'

export const DEFAULT_MATCH_PREFERENCES: MatchPreferences = {
  gender: 'vrouw',
  minAge: 16,
  maxAge: 19,
  flexibleAge: false,
  nearbyOnly: true,
  locationEnabled: false,
  locationLabel: '',
  maxDistanceKm: 100,
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function normalizeMatchPreferences(value: Partial<MatchPreferences> | null | undefined): MatchPreferences {
  const minAge = clamp(Number(value?.minAge ?? DEFAULT_MATCH_PREFERENCES.minAge), 13, 99)
  const maxAge = clamp(Number(value?.maxAge ?? DEFAULT_MATCH_PREFERENCES.maxAge), minAge, 99)
  const gender =
    value?.gender === 'man' || value?.gender === 'iedereen' || value?.gender === 'vrouw'
      ? value.gender
      : DEFAULT_MATCH_PREFERENCES.gender
  return {
    gender,
    minAge,
    maxAge,
    flexibleAge: Boolean(value?.flexibleAge ?? DEFAULT_MATCH_PREFERENCES.flexibleAge),
    nearbyOnly: Boolean(value?.nearbyOnly ?? DEFAULT_MATCH_PREFERENCES.nearbyOnly),
    locationEnabled: Boolean(value?.locationEnabled ?? DEFAULT_MATCH_PREFERENCES.locationEnabled),
    locationLabel:
      typeof value?.locationLabel === 'string'
        ? value.locationLabel.slice(0, 80)
        : DEFAULT_MATCH_PREFERENCES.locationLabel,
    maxDistanceKm: clamp(
      Number(value?.maxDistanceKm ?? DEFAULT_MATCH_PREFERENCES.maxDistanceKm),
      1,
      500,
    ),
  }
}

export function loadMatchPreferences(): MatchPreferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_MATCH_PREFERENCES
    return normalizeMatchPreferences(JSON.parse(raw) as Partial<MatchPreferences>)
  } catch {
    return DEFAULT_MATCH_PREFERENCES
  }
}

export function saveMatchPreferences(value: MatchPreferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalizeMatchPreferences(value)))
  } catch {
    /* */
  }
}
