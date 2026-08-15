import { LogOut, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import Card from '../ui/Card'
import GoogleIcon from './GoogleIcon'

function AccountCard() {
  const [signedOut, setSignedOut] = useState(false)
  const [googleClicked, setGoogleClicked] = useState(false)

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Account</h2>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-alt px-4 py-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-ink">Sign-in not connected yet</p>
          <p className="text-xs text-ink-muted">
            Account details will appear here once sign-in is set up.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setGoogleClicked(true)}
          className="inline-flex items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-alt"
        >
          <GoogleIcon className="h-5 w-5 shrink-0" />
          Continue with Google
        </button>
        {googleClicked && (
          <p className="mt-2 text-xs text-ink-muted">
            Google sign-in isn&rsquo;t connected yet &mdash; check back soon!
          </p>
        )}
      </div>

      {signedOut ? (
        <p className="mt-5 text-sm text-ink-muted">You&rsquo;ve been signed out. (demo only)</p>
      ) : (
        <button
          type="button"
          onClick={() => setSignedOut(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-border px-6 py-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      )}
    </Card>
  )
}

export default AccountCard
