import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'

// Placeholder for daily logging.
export default function LogScreen() {
  return (
    <Screen title="Log" subtitle="A quick way to note how today feels.">
      <Card>
        <Text variant="title">Coming soon</Text>
        <Text tone="muted">Logging will appear here once it is connected to Lunelle.</Text>
      </Card>
    </Screen>
  )
}
