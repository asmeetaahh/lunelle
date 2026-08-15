import Card from '../ui/Card'

const PHASE_DESCRIPTIONS = {
  Period: 'Your body is shedding the uterine lining during this phase. Many people find gentle movement, extra rest, and warmth comforting around this time.',
  Follicular: 'Energy levels often start to build during this phase for many people. It can be a gentle time to ease into new activities.',
  Ovulation: 'This is typically the most fertile window in a cycle. Some people notice a lift in energy or mood around this time, though everyone is different.',
  Luteal: 'Your body is preparing for the next cycle during this phase. Some people notice shifts in energy or mood, and a little extra self-care can help.',
}

function PhaseInfoCard({ phase }) {
  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">About the {phase.toLowerCase()} phase</h2>
      <p className="mt-2 text-sm text-ink-muted">{PHASE_DESCRIPTIONS[phase]}</p>
      <p className="mt-4 text-xs text-ink-muted/80">
        This is general wellness information, not medical advice. Everyone&rsquo;s cycle is different.
      </p>
    </Card>
  )
}

export default PhaseInfoCard
