import { Heart, Sparkle } from 'lucide-react'
import { useTheme } from '../../theme/useTheme'

// Positions are biased toward the header band and the narrow gaps between
// Home's cards (the only places a particle is not painted over), measured
// against the page's actual section layout rather than spread uniformly.
const HEARTS = [
  { top: '2%', left: '15%', size: 12, delay: '0s', duration: '5.4s', peak: 0.5, drift: 1 },
  { top: '4.7%', left: '55%', size: 16, delay: '0.9s', duration: '6s', peak: 0.65, drift: -1 },
  { top: '7.3%', left: '85%', size: 10, delay: '1.5s', duration: '4.8s', peak: 0.4, drift: 1 },
  { top: '10%', left: '35%', size: 14, delay: '0.4s', duration: '5.8s', peak: 0.55, drift: -1 },
  { top: '12.5%', left: '70%', size: 11, delay: '1.1s', duration: '5s', peak: 0.45, drift: 1 },
  { top: '14%', left: '8%', size: 9, delay: '2s', duration: '4.6s', peak: 0.35, drift: -1 },
  { top: '36.8%', left: '25%', size: 13, delay: '0.6s', duration: '6.2s', peak: 0.6, drift: 1 },
  { top: '59.6%', left: '60%', size: 10, delay: '1.7s', duration: '5.2s', peak: 0.4, drift: -1 },
  { top: '69.1%', left: '40%', size: 15, delay: '0.3s', duration: '5.6s', peak: 0.6, drift: 1 },
  { top: '84.5%', left: '80%', size: 10, delay: '1.3s', duration: '4.8s', peak: 0.45, drift: -1 },
  { top: '86%', left: '12%', size: 9, delay: '0.8s', duration: '5.4s', peak: 0.35, drift: 1 },
]

const STARS = [
  { top: '1%', left: '60%', size: 10, delay: '0s', duration: '3.2s', peak: 0.7, drift: 1 },
  { top: '3%', left: '20%', size: 7, delay: '0.5s', duration: '2.6s', peak: 0.4, drift: -1 },
  { top: '5.5%', left: '80%', size: 8, delay: '1s', duration: '3s', peak: 0.5, drift: 1 },
  { top: '8%', left: '40%', size: 6, delay: '0.3s', duration: '2.5s', peak: 0.35, drift: -1 },
  { top: '10.5%', left: '90%', size: 9, delay: '1.4s', duration: '3.4s', peak: 0.55, drift: 1 },
  { top: '12.5%', left: '65%', size: 12, delay: '0.2s', duration: '3.6s', peak: 0.75, drift: -1 },
  { top: '14%', left: '10%', size: 6, delay: '1.8s', duration: '2.7s', peak: 0.35, drift: 1 },
  { top: '36.8%', left: '30%', size: 8, delay: '0.7s', duration: '3.1s', peak: 0.5, drift: -1 },
  { top: '59.6%', left: '75%', size: 7, delay: '1.2s', duration: '2.8s', peak: 0.4, drift: 1 },
  { top: '59.6%', left: '20%', size: 7, delay: '2s', duration: '2.9s', peak: 0.4, drift: 1 },
  { top: '69.1%', left: '45%', size: 11, delay: '0.4s', duration: '3.5s', peak: 0.65, drift: -1 },
  { top: '84.5%', left: '85%', size: 6, delay: '1.6s', duration: '2.6s', peak: 0.35, drift: 1 },
  { top: '86%', left: '18%', size: 9, delay: '0.9s', duration: '3.2s', peak: 0.5, drift: -1 },
]

function BackgroundDecor() {
  const { theme } = useTheme()
  const isMoonlight = theme === 'moonlight'

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-accent-soft opacity-40 blur-3xl" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-primary-soft opacity-30 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-accent-soft opacity-20 blur-3xl" />

      {isMoonlight
        ? STARS.map((star, index) => (
            <Sparkle
              key={`star-${index}`}
              className="animate-lunelle-twinkle absolute text-accent"
              style={{
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
                animationDelay: star.delay,
                animationDuration: star.duration,
                '--decor-peak': star.peak,
                '--decor-drift': star.drift,
              }}
            />
          ))
        : HEARTS.map((heart, index) => (
            <Heart
              key={`heart-${index}`}
              className="animate-lunelle-float absolute fill-primary text-primary"
              style={{
                top: heart.top,
                left: heart.left,
                width: heart.size,
                height: heart.size,
                animationDelay: heart.delay,
                animationDuration: heart.duration,
                '--decor-peak': heart.peak,
                '--decor-drift': heart.drift,
              }}
            />
          ))}
    </div>
  )
}

export default BackgroundDecor
