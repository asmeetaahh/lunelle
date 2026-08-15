function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-warn-bg px-3 py-1 text-xs font-semibold text-warn-text ${className}`}
    >
      {children}
    </span>
  )
}

export default Badge
