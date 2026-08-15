// Frontend-only sample data and canned-response logic for the AI Companion
// chat UI. There is no real AI/API call here yet — this module exists so the
// response logic is isolated from the components and can later be swapped
// for a real backend call without touching the UI.

export const SUGGESTED_PROMPTS = [
  'How am I feeling today?',
  'Tell me about my cycle',
  "I'm feeling stressed",
  'Give me a little encouragement',
  'Help me reflect on today',
]

const PROMPT_RESPONSES = {
  'How am I feeling today?':
    "I don't have access to your mood logs just yet, but I'd love to hear it from you — how are you feeling right now?",
  'Tell me about my cycle':
    "You're on day 21 of a 29-day cycle, currently in your luteal phase. Your next period is estimated in about 7-9 days. Want a few gentle tips for this phase?",
  "I'm feeling stressed":
    "I'm sorry you're feeling that way. Let's slow down for a second together. Would it help to talk through what's stressing you, or try a quick calming moment instead?",
  'Give me a little encouragement':
    "You're doing better than you think. Showing up for yourself today, even in small ways, matters more than you know. I'm proud of you. 💗",
  'Help me reflect on today':
    "Let's take a moment together. What's one thing that felt good today, and one thing that felt a little harder?",
}

const KEYWORD_RESPONSES = [
  {
    keywords: ['stress', 'anxious', 'anxiety', 'overwhelm'],
    response: "That sounds like a lot to carry. It's okay to feel this way — I'm right here with you.",
  },
  {
    keywords: ['sad', 'lonely', 'down', 'upset'],
    response: "I'm sorry you're feeling that way. You don't have to carry it alone — I'm listening, for as long as you need.",
  },
  {
    keywords: ['happy', 'good', 'great', 'excited'],
    response: "I love hearing that! Thank you for sharing a little brightness with me. 💗",
  },
  {
    keywords: ['tired', 'exhausted', 'sleep'],
    response: "Rest isn't something to earn — you deserve it simply for existing. Be gentle with yourself today.",
  },
  {
    keywords: ['angry', 'frustrated', 'mad'],
    response: "That frustration sounds real and valid. Want to tell me a bit more about what happened?",
  },
]

const FALLBACK_RESPONSES = [
  "Thank you for sharing that with me. I'm here, and I'm listening.",
  "I hear you. Whatever you're feeling right now is valid.",
  "That means a lot that you told me. Would you like to say more?",
  "I'm really glad you're here. Take all the time you need.",
]

let fallbackIndex = 0

export function getCompanionResponse(userMessage) {
  const trimmed = userMessage.trim()

  if (PROMPT_RESPONSES[trimmed]) {
    return PROMPT_RESPONSES[trimmed]
  }

  const lower = trimmed.toLowerCase()
  const keywordMatch = KEYWORD_RESPONSES.find((entry) =>
    entry.keywords.some((keyword) => lower.includes(keyword)),
  )
  if (keywordMatch) return keywordMatch.response

  const response = FALLBACK_RESPONSES[fallbackIndex % FALLBACK_RESPONSES.length]
  fallbackIndex += 1
  return response
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
    {
      id: createMessageId(),
      role: 'user',
      text: 'Honestly, a bit tired and overwhelmed.',
    },
    {
      id: createMessageId(),
      role: 'assistant',
      text: "That sounds like a lot to carry. It's okay to feel this way — would you like to talk about what's been weighing on you, or would a small moment of calm help first?",
    },
  ]
}
