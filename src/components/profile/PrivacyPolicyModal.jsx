import ProfileModal from './ProfileModal'

function PrivacyPolicyModal({ onClose }) {
  return (
    <ProfileModal title="Privacy & how your data is used" onClose={onClose}>
      <div className="space-y-3 text-sm text-ink-muted">
        <p>Lunelle is currently a demo build, so here&rsquo;s honestly what&rsquo;s stored and how:</p>
        <p>
          Journal entries you write &mdash; including any title, mood, symptoms, and the cycle day/phase
          at the time &mdash; are saved to Lunelle&rsquo;s Supabase database so they can be shown back to
          you and used to generate AI reflections.
        </p>
        <p>
          When you message the AI Companion, your message and relevant journal/cycle context are sent to
          Featherless AI to generate a response. That&rsquo;s the only third party your journal content is
          shared with.
        </p>
        <p>
          Lunelle doesn&rsquo;t have user accounts yet, so entries aren&rsquo;t tied to a personal login
          &mdash; this demo uses one shared data store rather than per-person accounts.
        </p>
        <p>
          Cycle settings, your daily mood check-in, and app preferences (like this profile) are stored
          only in your browser&rsquo;s local storage and never leave your device.
        </p>
      </div>
    </ProfileModal>
  )
}

export default PrivacyPolicyModal
