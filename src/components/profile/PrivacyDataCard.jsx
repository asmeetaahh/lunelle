import { Database, Lock, Trash2 } from 'lucide-react'
import Card from '../ui/Card'
import PreferenceRow from './PreferenceRow'

function ActionButton({ children }) {
  return (
    <button
      type="button"
      className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
    >
      {children}
    </button>
  )
}

function PrivacyDataCard() {
  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Privacy &amp; data</h2>
      <p className="mt-1 text-sm text-ink-muted">You&rsquo;re always in control of your information.</p>

      <div className="mt-4 divide-y divide-border">
        <PreferenceRow
          icon={Lock}
          label="Privacy policy"
          description="Learn how your data is used and protected."
        >
          <ActionButton>View</ActionButton>
        </PreferenceRow>
        <PreferenceRow
          icon={Database}
          label="Manage cycle data"
          description="Export or review your logged entries."
        >
          <ActionButton>Manage</ActionButton>
        </PreferenceRow>
        <PreferenceRow
          icon={Trash2}
          label="Delete my data"
          description="Permanently remove your cycle history."
        >
          <ActionButton>Delete</ActionButton>
        </PreferenceRow>
      </div>
    </Card>
  )
}

export default PrivacyDataCard
