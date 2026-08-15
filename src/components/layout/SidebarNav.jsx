import bunnyMark from '../../assets/Lunelle bunny.png'
import { exploreNavItems, primaryNavItems, profileNavItem } from '../../lib/navItems'
import NavItem from './NavItem'
import NavList from './NavList'

function SidebarNav({ onNavigate }) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <nav className="flex-1 space-y-6 px-4 pt-5">
        <NavList items={primaryNavItems} onNavigate={onNavigate} />

        <div>
          <p className="px-3.5 pb-2 text-xs font-semibold text-ink-muted">Explore</p>
          <NavList items={exploreNavItems} onNavigate={onNavigate} />
        </div>
      </nav>

      <div className="px-4 pt-4">
        <NavItem item={profileNavItem} onNavigate={onNavigate} />
      </div>

      <div className="mt-4 flex items-center gap-2.5 border-t border-border px-6 py-5">
        <img
          src={bunnyMark}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover"
        />
        <p className="text-xs text-ink-muted">You&rsquo;re doing beautifully today.</p>
      </div>
    </div>
  )
}

export default SidebarNav
