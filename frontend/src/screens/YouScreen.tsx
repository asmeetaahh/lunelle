import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import { useAuth } from '@/auth'
import { env } from '@/config/env'

// Placeholder for profile / settings / account. Sign-out is real (it clears the
// stored session); everything else is still to come.
export default function YouScreen() {
  const { signOut, isPreview } = useAuth()

  return (
    <Screen title="You" subtitle="Your account and preferences.">
      <Card>
        <Text variant="title">Coming soon</Text>
        <Text tone="muted">Profile, cycle settings and account options will appear here.</Text>
      </Card>

      {__DEV__ ? (
        <Card>
          <Text variant="label">Developer info</Text>
          <Text variant="caption" tone="muted">
            API URL: {env.apiUrl ?? 'not set (see frontend/.env.example)'}
          </Text>
          <Text variant="caption" tone="muted">
            Session: {isPreview ? 'dev preview (no token)' : 'authenticated'}
          </Text>
        </Card>
      ) : null}

      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  )
}
