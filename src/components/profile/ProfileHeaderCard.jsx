import { Pencil } from 'lucide-react'
import { useState } from 'react'
import bunnyMark from '../../assets/Lunelle bunny.png'
import Button from '../ui/Button'
import Card from '../ui/Card'

function ProfileHeaderCard() {
  const [name, setName] = useState('Asmita')
  const [subtitle, setSubtitle] = useState('Tracking my cycle, one gentle day at a time. 🌸')
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle)

  const startEditing = () => {
    setDraftName(name)
    setDraftSubtitle(subtitle)
    setIsEditing(true)
  }

  const cancelEditing = () => setIsEditing(false)

  const saveEditing = () => {
    setName(draftName.trim() || name)
    setSubtitle(draftSubtitle.trim() || subtitle)
    setIsEditing(false)
  }

  return (
    <Card className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
      <div className="relative h-24 w-24 shrink-0">
        <div className="absolute inset-0 rounded-full bg-primary-soft/70 blur-xl" />
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary-soft ring-4 ring-surface">
          <img src={bunnyMark} alt="" className="h-[72%] w-[72%] object-contain" />
        </div>
      </div>

      {isEditing ? (
        <div className="w-full flex-1 space-y-3">
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Display name"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-base font-semibold text-ink placeholder:font-normal placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            value={draftSubtitle}
            onChange={(event) => setDraftSubtitle(event.target.value)}
            placeholder="Short subtitle"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
          />
          <div className="flex justify-center gap-3 sm:justify-start">
            <Button onClick={saveEditing}>Save</Button>
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-2xl border border-border px-6 py-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-alt"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-ink">{name}</h2>
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
          <button
            type="button"
            onClick={startEditing}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit profile
          </button>
        </div>
      )}
    </Card>
  )
}

export default ProfileHeaderCard
