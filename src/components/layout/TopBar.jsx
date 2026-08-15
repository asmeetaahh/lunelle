import { Bell, Menu } from 'lucide-react'
import BrandMark from '../ui/BrandMark'
import IconButton from '../ui/IconButton'
import ThemeToggle from '../ui/ThemeToggle'

function TopBar({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-10 lg:py-5">
      <div className="flex items-center gap-3">
        <IconButton label="Open navigation" onClick={onMenuClick} className="lg:hidden">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <div className="lg:hidden">
          <BrandMark />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <IconButton label="Notifications">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <ThemeToggle />
      </div>
    </header>
  )
}

export default TopBar
