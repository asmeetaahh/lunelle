import Card from '../components/ui/Card'

function PagePlaceholder({ title, icon: Icon }) {
  return (
    <Card className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
      )}
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        This space is being prepared with care. Check back soon 🌸
      </p>
    </Card>
  )
}

export default PagePlaceholder
