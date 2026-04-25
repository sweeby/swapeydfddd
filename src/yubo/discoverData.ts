/** Data voor de swipe- / ontdek-tab: zelfde soort info als "Your profile". */
export type SwipeTag = { t: string; c: string }

export type SwipeProfile = {
  id: string
  name: string
  age: number
  city: string
  username: string
  /** Grote omslagfoto (portret) */
  mainPhoto: string
  /** Extra thumbnails (voor o.a. rechterstrook / preview) */
  extraPhotos: string[]
  tags: SwipeTag[]
  bio: string
  profession: string
  company: string
  /** Lokaal tab-user-id: andere speler; ontbreekt bij vaste profielkaarten in de stack */
  liveUserId?: string
  isStreaming?: boolean
  streamTitle?: string
  streamStartedAt?: number
}

export const DISCOVER_DECK: SwipeProfile[] = [
  {
    id: '1',
    name: 'Ava',
    age: 21,
    city: 'Antwerpen',
    username: 'ava.creates',
    mainPhoto:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=900&fit=crop&q=80',
    extraPhotos: [
      'https://images.unsplash.com/photo-1502823403499-6ccfcf4fbdb7?w=200&h=200&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&q=80',
    ],
    tags: [
      { t: 'GYM RAT', c: '#2d7ce8' },
      { t: 'BASKETBALL', c: '#f5a224' },
      { t: 'SPANISH', c: '#ec4899' },
    ],
    bio: 'Tattoo queen from the south, kinda sweet, mostly savage',
    profession: 'Tattoo artist',
    company: 'Inkspire Studio',
  },
  {
    id: '2',
    name: 'Liam',
    age: 20,
    city: 'Gent',
    username: 'liam.be',
    mainPhoto:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=900&fit=crop&q=80',
    extraPhotos: [
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&q=80',
    ],
    tags: [
      { t: 'MINECRAFT', c: '#7c3aed' },
      { t: 'PLAYING MUSIC', c: '#3bb6e8' },
    ],
    bio: 'Producer by night, coffee by day. DM je fav track.',
    profession: 'Muzikant',
    company: 'Studio Noord',
  },
  {
    id: '3',
    name: 'Mila',
    age: 19,
    city: 'Leuven',
    username: 'mila.rose',
    mainPhoto:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=900&fit=crop&q=80',
    extraPhotos: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&q=80',
    ],
    tags: [
      { t: 'EMINEM', c: '#22a855' },
      { t: 'BASKETBALL', c: '#f5a224' },
    ],
    bio: 'Art school + late runs. HMU voor collabs',
    profession: 'Illustrator',
    company: 'Freelance',
  },
  {
    id: '4',
    name: 'Noa',
    age: 22,
    city: 'Brussel',
    username: 'noa.skates',
    mainPhoto:
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=900&fit=crop&q=80',
    extraPhotos: [],
    tags: [
      { t: 'GYM RAT', c: '#2d7ce8' },
      { t: 'PLAYING MUSIC', c: '#3bb6e8' },
    ],
    bio: 'Skate, beats, no drama',
    profession: 'Trainer',
    company: 'City Gym',
  },
  {
    id: '5',
    name: 'Sam',
    age: 23,
    city: 'Hasselt',
    username: 'sam.cooks',
    mainPhoto:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=900&fit=crop&q=80',
    extraPhotos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&q=80',
    ],
    tags: [
      { t: 'SPANISH', c: '#ec4899' },
      { t: 'BASKETBALL', c: '#f5a224' },
      { t: 'MINECRAFT', c: '#7c3aed' },
    ],
    bio: 'Cooking is my love language. Vegan-friendly kitchen.',
    profession: 'Chef',
    company: 'Pop-up Lab',
  },
  {
    id: '6',
    name: 'Ivy',
    age: 20,
    city: 'Kortrijk',
    username: 'ivy.ivy',
    mainPhoto:
      'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=600&h=900&fit=crop&q=80',
    extraPhotos: [],
    tags: [{ t: 'PLAYING MUSIC', c: '#3bb6e8' }, { t: 'EMINEM', c: '#22a855' }],
    bio: 'Gigs in de weekenden, altijd op zoek naar nieuwe sounds',
    profession: 'Zangeres',
    company: 'indie',
  },
]

const MAX_FRIENDS_DISCOVER_SUGGESTIONS = 12

/**
 * Suggesties voor Friends → Discover+: alleen echte spelers in de live-pool
 * (geen vaste voorbeeldkaarten).
 */
export function getDiscoverPlusSuggestions(
  fromLivePool: SwipeProfile[],
): SwipeProfile[] {
  const seen = new Set<string>()
  const out: SwipeProfile[] = []
  for (const p of fromLivePool) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
    if (out.length >= MAX_FRIENDS_DISCOVER_SUGGESTIONS) {
      return out
    }
  }
  return out
}
