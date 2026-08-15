import { Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import bunnyArtwork from '../../assets/Lunelle bunny.png'
import { RELAX_TRACKS, formatTime } from '../../lib/relax'
import Card from '../ui/Card'

function RelaxPlayer() {
  const audioRef = useRef(null)
  const [selectedTrackId, setSelectedTrackId] = useState(RELAX_TRACKS[0].id)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [mutedVolume, setMutedVolume] = useState(null)

  const track = RELAX_TRACKS.find((item) => item.id === selectedTrackId)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [isPlaying, selectedTrackId])

  const selectTrack = (trackId) => {
    if (trackId === selectedTrackId) return
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setSelectedTrackId(trackId)
  }

  const togglePlay = () => setIsPlaying((current) => !current)

  const handleTimeUpdate = () => setCurrentTime(audioRef.current.currentTime)
  const handleLoadedMetadata = () => setDuration(audioRef.current.duration)
  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleSeek = (event) => {
    const value = Number(event.target.value)
    if (audioRef.current) audioRef.current.currentTime = value
    setCurrentTime(value)
  }

  const handleVolumeChange = (event) => {
    setVolume(Number(event.target.value))
    setMutedVolume(null)
  }

  const toggleMute = () => {
    if (volume > 0) {
      setMutedVolume(volume)
      setVolume(0)
    } else {
      setVolume(mutedVolume ?? 0.8)
      setMutedVolume(null)
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <audio
        ref={audioRef}
        src={track.src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="flex flex-col items-center text-center">
        <div className="relative h-40 w-40 sm:h-48 sm:w-48">
          <div className="absolute inset-0 rounded-full bg-primary-soft/70 blur-2xl" />
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary-soft ring-4 ring-surface">
            <img src={bunnyArtwork} alt="" className="h-[72%] w-[72%] object-contain" />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {RELAX_TRACKS.map((item) => {
            const TabIcon = item.icon
            const isSelected = item.id === selectedTrackId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTrack(item.id)}
                aria-pressed={isSelected}
                className={[
                  'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  isSelected
                    ? 'bg-primary text-white'
                    : 'border border-border bg-surface text-ink-muted hover:bg-surface-alt',
                ].join(' ')}
              >
                <TabIcon className="h-4 w-4" aria-hidden="true" />
                {item.title}
              </button>
            )
          })}
        </div>

        <h2 className="mt-5 text-2xl font-bold text-ink">{track.title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{track.description}</p>

        <div className="mt-6 w-full">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-[var(--color-primary)]"
            aria-label={`Seek ${track.title}`}
          />
          <div className="mt-1 flex items-center justify-between text-xs text-ink-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          aria-pressed={isPlaying}
          className="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/25 transition-transform hover:brightness-105 active:scale-[0.98]"
        >
          {isPlaying ? (
            <Pause className="h-7 w-7" aria-hidden="true" fill="currentColor" />
          ) : (
            <Play className="h-7 w-7 translate-x-0.5" aria-hidden="true" fill="currentColor" />
          )}
        </button>

        <div className="mt-6 flex w-full items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-alt hover:text-primary"
          >
            {volume === 0 && <VolumeX className="h-4 w-4" aria-hidden="true" />}
            {volume > 0 && volume < 0.5 && <Volume1 className="h-4 w-4" aria-hidden="true" />}
            {volume >= 0.5 && <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="w-full accent-[var(--color-primary)]"
            aria-label="Volume"
          />
        </div>
      </div>
    </Card>
  )
}

export default RelaxPlayer
