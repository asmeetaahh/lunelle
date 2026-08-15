import BrandMark from '../ui/BrandMark'

function ChatMessage({ message }) {
  const isAssistant = message.role === 'assistant'

  return (
    <div className={`flex items-end gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
      {isAssistant && <BrandMark compact />}
      <div
        className={[
          'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[65%]',
          isAssistant ? 'rounded-bl-sm bg-surface-alt text-ink' : 'rounded-br-sm bg-primary text-white',
        ].join(' ')}
      >
        {message.text}
      </div>
    </div>
  )
}

export default ChatMessage
