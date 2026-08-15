import bunnyMark from '../../assets/Lunelle bunny.png'

function MemoryCard({ symbol, isFlipped, isMatched, disabled, onClick }) {
  const revealed = isFlipped || isMatched
  const isLocked = disabled && !revealed

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || revealed}
      aria-label={revealed ? `Card: ${symbol}` : 'Hidden card'}
      className={[
        'memory-card-scene aspect-square w-full transition-transform',
        isLocked ? 'cursor-wait' : revealed ? 'cursor-default' : 'cursor-pointer hover:scale-[1.04]',
      ].join(' ')}
    >
      <div className={`memory-card-flipper ${revealed ? 'is-flipped' : ''}`}>
        <div className="memory-card-face flex items-center justify-center rounded-2xl border border-border bg-surface-alt transition-colors hover:border-primary/40">
          <img src={bunnyMark} alt="" className="h-1/2 w-1/2 object-contain opacity-70" />
        </div>
        <div
          className={[
            'memory-card-face memory-card-face-back flex items-center justify-center rounded-2xl border text-3xl sm:text-4xl',
            isMatched ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
          ].join(' ')}
        >
          <span aria-hidden="true">{symbol}</span>
        </div>
      </div>
    </button>
  )
}

export default MemoryCard
