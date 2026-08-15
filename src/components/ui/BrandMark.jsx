import bunnyMark from '../../assets/Lunelle bunny.png'

function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft ring-1 ring-border">
        <img src={bunnyMark} alt="" className="h-full w-full object-cover" />
      </span>
      {!compact && (
        <span className="text-xl font-bold tracking-tight text-primary">Lunelle</span>
      )}
    </div>
  )
}

export default BrandMark
