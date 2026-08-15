import { SendHorizontal } from 'lucide-react'
import { useState } from 'react'
import Button from '../ui/Button'

function MessageComposer({ onSend, disabled }) {
  const [value, setValue] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Tell Lunelle what's on your mind..."
        disabled={disabled}
        className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none disabled:opacity-60"
      />
      <Button
        type="submit"
        icon={SendHorizontal}
        disabled={disabled || !value.trim()}
        className="shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </Button>
    </form>
  )
}

export default MessageComposer
