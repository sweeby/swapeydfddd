import type { SwipeProfile } from '../yubo/discoverData'

export type SharedSwipeState = {
  outgoingTargetIds: string[]
  incomingProfiles: SwipeProfile[]
  matchProfiles: SwipeProfile[]
}

const EMPTY: SharedSwipeState = {
  outgoingTargetIds: [],
  incomingProfiles: [],
  matchProfiles: [],
}

function normalizeState(value: Partial<SharedSwipeState> | null | undefined): SharedSwipeState {
  return {
    outgoingTargetIds: Array.isArray(value?.outgoingTargetIds)
      ? value.outgoingTargetIds.map(String).filter(Boolean)
      : [],
    incomingProfiles: Array.isArray(value?.incomingProfiles) ? value.incomingProfiles : [],
    matchProfiles: Array.isArray(value?.matchProfiles) ? value.matchProfiles : [],
  }
}

export async function fetchSharedSwipeState(userId: string): Promise<SharedSwipeState> {
  if (!userId) return EMPTY
  try {
    const res = await fetch(`/api/swipes?userId=${encodeURIComponent(userId)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return EMPTY
    return normalizeState(await res.json().catch(() => ({})))
  } catch {
    return EMPTY
  }
}

export async function recordSharedSwipe(args: {
  fromUserId: string
  toUserId: string
  direction: 'left' | 'right'
}): Promise<SharedSwipeState> {
  try {
    const res = await fetch('/api/swipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!res.ok) return EMPTY
    return normalizeState(await res.json().catch(() => ({})))
  } catch {
    return EMPTY
  }
}
