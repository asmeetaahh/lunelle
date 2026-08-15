import { Flower2, MoonStar } from 'lucide-react'

export const RELAX_TRACKS = [
  {
    id: 'blossom-breeze',
    title: 'Blossom Breeze',
    description: 'Soft, warm tones to help you unwind.',
    src: '/audio/relax-track-1.mp3',
    icon: Flower2,
  },
  {
    id: 'moonlight-lullaby',
    title: 'Moonlight Lullaby',
    description: 'A gentle soundscape for winding down at night.',
    src: '/audio/relax-track-2.mp3',
    icon: MoonStar,
  },
]

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}
