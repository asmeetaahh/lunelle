function PreferenceRow({ icon: Icon, label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default PreferenceRow
