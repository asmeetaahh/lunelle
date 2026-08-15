import { Bell, HeartHandshake, Palette } from 'lucide-react'
import { useState } from 'react'
import { getProfileSettings, saveProfileSettings } from '../../lib/profileSettings'
import Card from '../ui/Card'
import ThemeToggle from '../ui/ThemeToggle'
import ToggleSwitch from '../ui/ToggleSwitch'
import PreferenceRow from './PreferenceRow'

function PreferencesCard() {
  const [settings, setSettings] = useState(() => getProfileSettings())

  const updateSetting = (key, value) => {
    const next = { ...getProfileSettings(), [key]: value }
    saveProfileSettings(next)
    setSettings(next)
  }

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Preferences</h2>

      <div className="mt-4 divide-y divide-border">
        <PreferenceRow icon={Palette} label="Appearance" description="Blossom or Moonlight look">
          <ThemeToggle />
        </PreferenceRow>
        <PreferenceRow icon={Bell} label="Notifications" description="Cycle & reminder alerts">
          <ToggleSwitch
            checked={settings.notifications}
            onChange={(checked) => updateSetting('notifications', checked)}
            label="Notifications"
          />
        </PreferenceRow>
        <PreferenceRow icon={HeartHandshake} label="Gentle reminders" description="Soft check-in nudges">
          <ToggleSwitch
            checked={settings.gentleReminders}
            onChange={(checked) => updateSetting('gentleReminders', checked)}
            label="Gentle reminders"
          />
        </PreferenceRow>
      </div>
    </Card>
  )
}

export default PreferencesCard
