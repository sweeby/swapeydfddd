const LS = 'swipey-likes-inbox-v1'

export function isLikesInboxUnlocked(): boolean {
  try {
    return localStorage.getItem(LS) === '1'
  } catch {
    return false
  }
}

export function setLikesInboxUnlocked(unlocked: boolean) {
  try {
    if (unlocked) {
      localStorage.setItem(LS, '1')
    } else {
      localStorage.removeItem(LS)
    }
  } catch {
    /* */
  }
}
