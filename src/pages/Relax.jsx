import BackgroundDecor from '../components/decorative/BackgroundDecor'
import RelaxPlayer from '../components/relax/RelaxPlayer'

function Relax() {
  return (
    <div className="relative space-y-6">
      <BackgroundDecor />

      <div>
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Relax</h1>
        <p className="mt-2 text-base text-ink-muted">Take a soft moment for yourself.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Breathe, slow down, and let the music carry you.
        </p>
      </div>

      <RelaxPlayer />
    </div>
  )
}

export default Relax
