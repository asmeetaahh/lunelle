import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../theme/useTheme'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isMoonlight = theme === 'moonlight'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isMoonlight ? 'Blossom' : 'Moonlight'} theme`}
      title={`Switch to ${isMoonlight ? 'Blossom' : 'Moonlight'} theme`}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {isMoonlight ? (
        <Moon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">
        {isMoonlight ? 'Moonlight' : 'Blossom'}
      </span>
    </button>
  )
}

export default ThemeToggle
