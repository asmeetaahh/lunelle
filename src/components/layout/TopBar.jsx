import { Bell, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getProfileSettings } from '../../lib/profileSettings'
import BrandMark from '../ui/BrandMark'
import IconButton from '../ui/IconButton'
import ThemeToggle from '../ui/ThemeToggle'

function TopBar({ onMenuClick }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const settings = getProfileSettings()
  const notificationsRef = useRef(null)

  useEffect(() => {
    if (!isNotificationsOpen) return undefined

    const handleOutsideClick = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isNotificationsOpen])

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
        <div className="relative" ref={notificationsRef}>
          <IconButton
            label="Notifications"
            aria-expanded={isNotificationsOpen}
            onClick={() => setIsNotificationsOpen((open) => !open)}
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </IconButton>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-bold text-ink">Reminder settings</h2>
                <IconButton label="Close" onClick={() => setIsNotificationsOpen(false)}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                These reflect your saved preferences, not a live notification inbox.
              </p>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-surface-alt px-3 py-2 text-sm">
                  <span className="text-ink">Notifications</span>
                  <span
                    className={settings.notifications ? 'font-semibold text-primary' : 'text-ink-muted'}
                  >
                    {settings.notifications ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-alt px-3 py-2 text-sm">
                  <span className="text-ink">Gentle reminders</span>
                  <span
                    className={settings.gentleReminders ? 'font-semibold text-primary' : 'text-ink-muted'}
                  >
                    {settings.gentleReminders ? 'On' : 'Off'}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-xs text-ink-muted">
                Manage these anytime in Profile &rarr; Preferences.
              </p>
            </div>
          )}
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}

export default TopBar
