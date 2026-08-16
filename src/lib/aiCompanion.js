import { getCycleDayInfo, getCyclePhase } from './cycle'
import { getCycleFromSettings, getCycleSettings } from './cycleSettings'

export const SUGGESTED_PROMPTS = [
  'Reflect on my journal',
  'How am I feeling today?',
  'Tell me about my cycle',
  "I'm feeling stressed",
  'Give me a little encouragement',
]

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function reflectWithLunelle(userMessage) {
  const settings = getCycleSettings()
  const cycle = getCycleFromSettings(settings)
  const today = new Date()

  const cycleInfo = getCycleDayInfo(today, cycle)
  const cycleDay = cycleInfo.cycleDayNumber
  const phase = getCyclePhase(cycleDay, cycle)

  const journalId = localStorage.getItem('lunelle-last-journal-id')

  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        journalId: journalId || undefined,
        message: userMessage,
        cycleDay,
        cycleLength: cycle.cycleLength,
        phase,
        mood: null,
        symptoms: [],
      }),
    })
  } catch (networkError) {
    console.error('Lunelle AI network error:', networkError)
    throw new Error(
      "We're having trouble reaching Lunelle AI right now. Please check your connection and try again. 💗",
      { cause: networkError },
    )
  }

  const data = await response.json().catch(() => null)

  if (!response.ok || !data) {
    throw new Error(data?.error || 'Lunelle AI could not respond. Please try again in a moment. 💗')
  }

  return data
}

let messageIdSequence = 0

export function createMessageId() {
  messageIdSequence += 1
  return `msg-${Date.now()}-${messageIdSequence}`
}

export function createInitialMessages() {
  return [
    {
      id: createMessageId(),
      role: 'assistant',
      text: "Hi love 💗 I'm really glad you're here. How are you feeling today?",
    },
  ]
}