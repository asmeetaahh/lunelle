import { Database, Lock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Card from '../ui/Card'
import DeleteDataModal from './DeleteDataModal'
import ManageCycleDataModal from './ManageCycleDataModal'
import PreferenceRow from './PreferenceRow'
import PrivacyPolicyModal from './PrivacyPolicyModal'

function ActionButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
    >
      {children}
    </button>
  )
}

function PrivacyDataCard() {
  const [openModal, setOpenModal] = useState(null)
  const closeModal = () => setOpenModal(null)

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
          <ActionButton onClick={() => setOpenModal('privacy')}>View</ActionButton>
        </PreferenceRow>
        <PreferenceRow
          icon={Database}
          label="Manage cycle data"
          description="Export or review your logged entries."
        >
          <ActionButton onClick={() => setOpenModal('manage')}>Manage</ActionButton>
        </PreferenceRow>
        <PreferenceRow
          icon={Trash2}
          label="Delete my data"
          description="Permanently remove your cycle history."
        >
          <ActionButton onClick={() => setOpenModal('delete')}>Delete</ActionButton>
        </PreferenceRow>
      </div>

      {openModal === 'privacy' && <PrivacyPolicyModal onClose={closeModal} />}
      {openModal === 'manage' && <ManageCycleDataModal onClose={closeModal} />}
      {openModal === 'delete' && <DeleteDataModal onClose={closeModal} />}
    </Card>
  )
}

export default PrivacyDataCard
