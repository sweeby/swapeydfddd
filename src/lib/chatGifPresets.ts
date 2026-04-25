/**
 * Voorbeeld-GIF’s — Giphy `i.giphy.com` (geen API-key); volledige URL in chat bewaard.
 * Voor zoeken/trends: Giphy API + VITE_GIPHY_API_KEY (https://developers.giphy.com/).
 */
export type ChatGifChoice = { id: string; label: string; url: string }

export const CHAT_GIF_PRESETS: ChatGifChoice[] = [
  { id: 'a', label: 'LOL', url: 'https://i.giphy.com/26ufdipRqA2uTHXRC.gif' },
  { id: 'b', label: 'Yes!', url: 'https://i.giphy.com/l0MYC0LajbaPoEADu.gif' },
  { id: 'c', label: 'Dance', url: 'https://i.giphy.com/3o7aD2sa0T88eliqgU.gif' },
  { id: 'd', label: 'Hartjes', url: 'https://i.giphy.com/26BRuo6sLetdllBRQ.gif' },
  { id: 'e', label: 'Wow', url: 'https://i.giphy.com/3o7aCTPPm4OHfRLSH6.gif' },
  { id: 'f', label: 'Applaus', url: 'https://i.giphy.com/l0HlNQ03J5JxX6lva.gif' },
  { id: 'g', label: 'Cute', url: 'https://i.giphy.com/3o6wrebnKWmvx4s4mq.gif' },
  { id: 'h', label: 'Koffie', url: 'https://i.giphy.com/iB4PoTVK0IAmY.gif' },
  { id: 'i', label: 'Dank je', url: 'https://i.giphy.com/3ohs7JG6t7T7ZrPY64.gif' },
  { id: 'j', label: 'Nee', url: 'https://i.giphy.com/l3V0j3ytFyGHqiT7G.gif' },
  { id: 'k', label: 'Doei', url: 'https://i.giphy.com/3o7aD1qVb5U9k9uE8Y.gif' },
  { id: 'l', label: 'Shrug', url: 'https://i.giphy.com/3o7aTskHEUdgCQAXde.gif' },
]
