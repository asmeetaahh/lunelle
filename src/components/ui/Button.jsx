function Button({ children, icon: Icon, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-transform hover:brightness-105 active:scale-[0.98] ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  )
}

export default Button
