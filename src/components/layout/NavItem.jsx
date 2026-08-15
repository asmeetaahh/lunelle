import { NavLink } from 'react-router-dom'

function NavItem({ item, onNavigate }) {
  const { to, label, icon: Icon } = item

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-medium transition-colors',
          isActive
            ? 'bg-primary-soft font-semibold text-primary'
            : 'text-ink-muted hover:bg-surface-alt hover:text-ink',
        ].join(' ')
      }
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" strokeWidth={2} />
      {label}
    </NavLink>
  )
}

export default NavItem
