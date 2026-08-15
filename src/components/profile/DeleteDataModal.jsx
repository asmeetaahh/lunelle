import Button from '../ui/Button'
import ProfileModal from './ProfileModal'

function DeleteDataModal({ onClose }) {
  return (
    <ProfileModal title="Delete my data" onClose={onClose}>
      <p className="text-sm text-ink-muted">
        Lunelle doesn&rsquo;t have user accounts yet, so entries aren&rsquo;t tied to a personal login
        &mdash; this demo currently uses one shared data store rather than per-person accounts.
        Permanently deleting everything here would affect that shared store, not just your own entries,
        so full deletion isn&rsquo;t available yet.
      </p>
      <p className="mt-3 text-sm text-ink-muted">
        In the meantime, you can remove individual journal entries from{' '}
        <strong className="text-ink">Manage cycle data</strong> above.
      </p>
      <Button onClick={onClose} className="mt-6 w-full justify-center">
        Got it
      </Button>
    </ProfileModal>
  )
}

export default DeleteDataModal
