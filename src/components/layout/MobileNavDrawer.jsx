import { X } from 'lucide-react'
import BrandMark from '../ui/BrandMark'
import IconButton from '../ui/IconButton'
import SidebarNav from './SidebarNav'

function MobileNavDrawer({ open, onClose }) {
  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <BrandMark />
          <IconButton label="Close navigation" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
        <SidebarNav onNavigate={onClose} />
      </div>
    </div>
  )
}

export default MobileNavDrawer
