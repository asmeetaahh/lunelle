import { useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import { useAuth } from '@/auth'

// Placeholder for onboarding + sign-in UI. The auth mechanism itself is real —
// Supabase Auth email/password, via `useAuth().signIn(email, password)` /
// `.signUp(email, password)` — only the form to collect them isn't built yet.
export default function WelcomeScreen() {
  const { startPreviewSession } = useAuth()
  const router = useRouter()

  const enterPreview = () => {
    startPreviewSession()
    router.replace('/today')
  }

  return (
    <Screen
      title="Welcome to Lunelle 🌸"
      subtitle="A gentle, cycle-aware companion."
      edges={['top', 'bottom', 'left', 'right']}
    >
      <Card>
        <Text variant="title">Sign-in isn&rsquo;t connected yet</Text>
        <Text tone="muted">
          Onboarding and account sign-in will appear here once they are wired to the Lunelle backend.
        </Text>
      </Card>

      {__DEV__ ? (
        <Button label="Continue without an account (dev preview)" onPress={enterPreview} />
      ) : null}
    </Screen>
  )
}
