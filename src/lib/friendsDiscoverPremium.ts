/** Friends → Discover: premium-ontgrendeling. */
const LS = 'swipey-friends-discover-premium-v1'

export function isFriendsDiscoverUnlocked(): boolean {
  try {
    return localStorage.getItem(LS) === '1'
  } catch {
    return false
  }
}

export function setFriendsDiscoverUnlocked(unlocked: boolean) {
  try {
    if (unlocked) localStorage.setItem(LS, '1')
    else localStorage.removeItem(LS)
  } catch {
    /* */
  }
}
