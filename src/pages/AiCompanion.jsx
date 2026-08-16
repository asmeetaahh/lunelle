import { useEffect, useRef, useState } from 'react'
import ChatMessage from '../components/ai-companion/ChatMessage'
import GentleReminderCard from '../components/ai-companion/GentleReminderCard'
import MessageComposer from '../components/ai-companion/MessageComposer'
import SuggestedPrompts from '../components/ai-companion/SuggestedPrompts'
import BackgroundDecor from '../components/decorative/BackgroundDecor'
import BrandMark from '../components/ui/BrandMark'
import Card from '../components/ui/Card'
import {
  createInitialMessages,
  createMessageId,
  reflectWithLunelle,
} from '../lib/aiCompanion'
import { getStoredMessages, saveMessages } from '../lib/aiCompanionHistory'

function AiCompanion() {
  const [messages, setMessages] = useState(() => getStoredMessages() ?? createInitialMessages())
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, isThinking])

  useEffect(() => {
    saveMessages(messages)
  }, [messages])

  const sendMessage = async (text) => {
  const userMessage = { id: createMessageId(), role: 'user', text }

  setMessages((current) => [...current, userMessage])
  setIsThinking(true)

  try {
    const data = await reflectWithLunelle(text)

    const assistantText = data.suggestions?.length
      ? `${data.response}\n\n${data.suggestions.map((suggestion) => `• ${suggestion}`).join('\n')}`
      : data.response

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: 'assistant',
        text: assistantText,
      },
    ])
  } catch (error) {
    console.error('Lunelle AI error:', error)

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: 'assistant',
        text:
          error.message ||
          "I'm having a little trouble connecting right now. Please try again in a moment. 💗",
      },
    ])
  } finally {
    setIsThinking(false)
  }
}


  return (
    <div className="relative space-y-6">
      <BackgroundDecor />

      <div>
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Your space to talk 💗</h1>
        <p className="mt-2 text-base text-ink-muted">
          I&rsquo;m here to listen, gently and without judgment.
        </p>
      </div>

      <Card>
        <div ref={scrollRef} className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isThinking && (
            <div className="flex items-end gap-3">
              <BrandMark compact />
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-alt px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 text-xs font-semibold text-ink-muted">Try asking</p>
          <SuggestedPrompts onSelectPrompt={sendMessage} disabled={isThinking} />
        </div>

        <div className="mt-5">
          <MessageComposer onSend={sendMessage} disabled={isThinking} />
        </div>
      </Card>

      <GentleReminderCard />
    </div>
  )
}

export default AiCompanion
