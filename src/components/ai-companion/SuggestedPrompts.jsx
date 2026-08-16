import { SUGGESTED_PROMPTS } from '../../lib/aiCompanion'

function SuggestedPrompts({ onSelectPrompt, disabled }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-3">
      {SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelectPrompt(prompt)}
          className="max-w-full rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-surface disabled:hover:text-ink-muted break-words"
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}

export default SuggestedPrompts
