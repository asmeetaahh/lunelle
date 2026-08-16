// Local persistence for the AI Companion conversation. Mirrors the get/save
// shape used by cycleSettings.js and profileSettings.js. Kept separate from
// aiCompanion.js (which only talks to the backend) so the chat page can read
// a full prior conversation before the first message is ever sent.
const STORAGE_KEY = 'lunelle-ai-companion-messages'

function isValidMessage(message) {
  return (
    message !== null &&
    typeof message === 'object' &&
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.text === 'string'
  )
}

export function getStoredMessages() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isValidMessage)) {
      return null
    }

    return parsed
  } catch (error) {
    console.error('Could not load AI companion history:', error)
    return null
  }
}

export function saveMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch (error) {
    console.error('Could not save AI companion history:', error)
  }
}
