export type PushPreferences = {
  newFriends: boolean
  friendRequests: boolean
  reactions: boolean
  friendsLive: boolean
  messages: boolean
}

const KEY = 'swipey-push-preferences-v1'

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  newFriends: true,
  friendRequests: true,
  reactions: true,
  friendsLive: true,
  messages: true,
}

export function normalizePushPreferences(value: Partial<PushPreferences> | null | undefined): PushPreferences {
  return {
    newFriends: Boolean(value?.newFriends ?? DEFAULT_PUSH_PREFERENCES.newFriends),
    friendRequests: Boolean(value?.friendRequests ?? DEFAULT_PUSH_PREFERENCES.friendRequests),
    reactions: Boolean(value?.reactions ?? DEFAULT_PUSH_PREFERENCES.reactions),
    friendsLive: Boolean(value?.friendsLive ?? DEFAULT_PUSH_PREFERENCES.friendsLive),
    messages: Boolean(value?.messages ?? DEFAULT_PUSH_PREFERENCES.messages),
  }
}

export function loadPushPreferences(): PushPreferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PUSH_PREFERENCES
    return normalizePushPreferences(JSON.parse(raw) as Partial<PushPreferences>)
  } catch {
    return DEFAULT_PUSH_PREFERENCES
  }
}

export function savePushPreferences(value: PushPreferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalizePushPreferences(value)))
  } catch {
    /* */
  }
}
