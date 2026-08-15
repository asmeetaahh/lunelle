const LEGEND_ITEMS = [
  { swatchClass: 'bg-primary', label: 'Logged period' },
  { swatchClass: 'border-2 border-dashed border-primary/50 bg-primary-soft/50', label: 'Predicted period' },
  { swatchClass: 'bg-accent-soft', label: 'Fertile window' },
  { swatchClass: 'bg-accent', label: 'Ovulation day' },
  { swatchClass: 'bg-transparent ring-2 ring-accent', label: 'Today' },
]

function CalendarLegend() {
  return (
    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs text-ink-muted">
          <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${item.swatchClass}`} aria-hidden="true" />
          {item.label}
        </div>
      ))}
    </div>
  )
}

export default CalendarLegend
