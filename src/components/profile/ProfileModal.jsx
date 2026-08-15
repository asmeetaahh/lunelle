import { X } from 'lucide-react'
import IconButton from '../ui/IconButton'

function ProfileModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-border bg-surface p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-ink">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

export default ProfileModal
