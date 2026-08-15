import { Bell, HeartHandshake, Palette } from 'lucide-react'
import { useState } from 'react'
import Card from '../ui/Card'
import ThemeToggle from '../ui/ThemeToggle'
import ToggleSwitch from '../ui/ToggleSwitch'
import PreferenceRow from './PreferenceRow'

function PreferencesCard() {
  const [notifications, setNotifications] = useState(true)
  const [gentleReminders, setGentleReminders] = useState(true)

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Preferences</h2>

      <div className="mt-4 divide-y divide-border">
        <PreferenceRow icon={Palette} label="Appearance" description="Blossom or Moonlight look">
          <ThemeToggle />
        </PreferenceRow>
        <PreferenceRow icon={Bell} label="Notifications" description="Cycle & reminder alerts">
          <ToggleSwitch checked={notifications} onChange={setNotifications} label="Notifications" />
        </PreferenceRow>
        <PreferenceRow icon={HeartHandshake} label="Gentle reminders" description="Soft check-in nudges">
          <ToggleSwitch
            checked={gentleReminders}
            onChange={setGentleReminders}
            label="Gentle reminders"
          />
        </PreferenceRow>
      </div>
    </Card>
  )
}

export default PreferencesCard
