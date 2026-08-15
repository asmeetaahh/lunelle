import NavItem from './NavItem'

function NavList({ items, onNavigate }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.to}>
          <NavItem item={item} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  )
}

export default NavList
