import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'

// Placeholder. Everything shown here (cycle day, phase, forecast) will come
// from the backend; the app renders results and does not compute them.
export default function TodayScreen() {
  return (
    <Screen title="Today" subtitle="Where you are in your cycle, at a glance.">
      <Card>
        <Text variant="title">Coming soon</Text>
        <Text tone="muted">Your cycle overview will appear here once it is connected to Lunelle.</Text>
      </Card>
    </Screen>
  )
}
