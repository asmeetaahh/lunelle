import BrandMark from '../ui/BrandMark'
import SidebarNav from './SidebarNav'

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border bg-surface/80 backdrop-blur-sm lg:flex">
      <div className="border-b border-border px-6 py-5">
        <BrandMark />
      </div>
      <SidebarNav />
    </aside>
  )
}

export default Sidebar
