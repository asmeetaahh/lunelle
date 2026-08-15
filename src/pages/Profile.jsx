import BackgroundDecor from '../components/decorative/BackgroundDecor'
import AccountCard from '../components/profile/AccountCard'
import AppPreferencesCard from '../components/profile/AppPreferencesCard'
import CycleSettingsCard from '../components/profile/CycleSettingsCard'
import PreferencesCard from '../components/profile/PreferencesCard'
import PrivacyDataCard from '../components/profile/PrivacyDataCard'
import ProfileHeaderCard from '../components/profile/ProfileHeaderCard'

function Profile() {
  return (
    <div className="relative space-y-6">
      <BackgroundDecor />

      <div>
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Profile</h1>
        <p className="mt-2 text-base text-ink-muted">
          Manage your account, cycle settings, and preferences.
        </p>
      </div>

      <ProfileHeaderCard />
      <CycleSettingsCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PreferencesCard />
        <AppPreferencesCard />
      </div>

      <AccountCard />
      <PrivacyDataCard />
    </div>
  )
}

export default Profile
