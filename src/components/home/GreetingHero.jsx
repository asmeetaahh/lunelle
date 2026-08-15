import girlBlossom from '../../assets/lunelle-blossom.jpeg'
import girlMoonlight from '../../assets/lunelle-moonlight.jpeg'
import { useTheme } from '../../theme/useTheme'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function GreetingHero() {
  const { theme } = useTheme()
  const illustration = theme === 'moonlight' ? girlMoonlight : girlBlossom

  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">
          {getGreeting()} <span aria-hidden="true">🌸</span>
        </h1>
        <p className="mt-2 text-base text-ink-muted">
          Here&rsquo;s a gentle look at how things are going today.
        </p>
      </div>

      <div className="relative hidden h-36 w-36 shrink-0 sm:block sm:h-44 sm:w-44">
        <div className="absolute inset-0 rounded-full bg-primary-soft/70 blur-2xl" />
        <div className="relative h-full w-full overflow-hidden rounded-full ring-4 ring-surface">
          <img src={illustration} alt="" className="h-full w-full object-cover" />
        </div>
      </div>
    </div>
  )
}

export default GreetingHero
