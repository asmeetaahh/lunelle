import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import type { TodaySnapshot } from '@shared/types'

import { isApiError } from '@/api'
import { lunelleApi } from '@/api/lunelleApi'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import { getDeviceLocalISODate } from '@/lib/date'
import { useTheme } from '@/theme'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: TodaySnapshot }

// Renders exactly what GET /api/today returns. No cycle day, phase, forecast
// window or confidence is computed here — those are the backend engines'
// job (shared/api.ts, backend/src/engines/cycle.js); this screen only reads
// TodaySnapshot's fields and displays them, including the states the
// contract says are legitimate (no history yet, no forecast yet).
export default function TodayScreen() {
  const { colors } = useTheme()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  // Does not itself call setState synchronously — the state is already
  // `loading` on mount (its initial value above), and `retry` below sets it
  // back to `loading` before calling this, which is an event handler, not an
  // effect body.
  const fetchToday = useCallback(async () => {
    const date = getDeviceLocalISODate()
    try {
      const snapshot = await lunelleApi.today.get(date)
      setState({ status: 'ready', snapshot })
    } catch (error) {
      const message = isApiError(error)
        ? `${error.message} (${error.code})`
        : error instanceof Error
          ? error.message
          : 'Something went wrong loading Today.'
      setState({ status: 'error', message })
    }
  }, [])

  useEffect(() => {
    // This rule's recommended fix is a dedicated data-fetching hook/library
    // (React Query, SWR, `use()` + Suspense); adopting one is a real decision
    // for the whole app, not something to reach for inside one screen's fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchToday()
  }, [fetchToday])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    void fetchToday()
  }, [fetchToday])

  return (
    <Screen title="Today" subtitle="Where you are in your cycle, at a glance.">
      {state.status === 'loading' ? (
        <Card>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </Card>
      ) : state.status === 'error' ? (
        <Card>
          <Text variant="title">Couldn&rsquo;t load Today</Text>
          <Text tone="muted">{state.message}</Text>
          <Button label="Try again" onPress={retry} />
        </Card>
      ) : (
        <TodaySnapshotView snapshot={state.snapshot} onRetry={retry} />
      )}
    </Screen>
  )
}

function TodaySnapshotView({ snapshot, onRetry }: { snapshot: TodaySnapshot; onRetry: () => void }) {
  const { spacing } = useTheme()

  if (!snapshot.hasCycleSettings) {
    return (
      <Card>
        <Text variant="title">Let&rsquo;s get you set up</Text>
        <Text tone="muted">
          Cycle onboarding isn&rsquo;t built yet in this app shell — this is the state
          GET /api/today reports when hasCycleSettings is false.
        </Text>
      </Card>
    )
  }

  const { position, nextPeriod, forecastBasis, caveats, loggedDays, todayObservation } = snapshot

  return (
    <View style={{ gap: spacing.xl }}>
      <Card>
        <Text variant="label" tone="muted">
          Cycle day
        </Text>
        <Text variant="display">{position.cycleDay ?? '—'}</Text>
        <Text tone="muted">
          Phase: {position.phase}
          {position.isEstimated ? ' (estimated)' : ''}
        </Text>
      </Card>

      <Card>
        <Text variant="title">Next period</Text>
        {nextPeriod ? (
          <>
            <Text>
              {nextPeriod.earliestStart} – {nextPeriod.latestStart}
            </Text>
            <Text tone="muted">
              Expected {nextPeriod.expectedStart} · confidence: {nextPeriod.confidence}
              {forecastBasis ? ` · basis: ${forecastBasis}` : ''}
            </Text>
          </>
        ) : (
          <Text tone="muted">Not enough information yet to predict your next period.</Text>
        )}
      </Card>

      {caveats.length > 0 ? (
        <Card>
          <Text variant="label" tone="muted">
            Notes
          </Text>
          {caveats.map((caveat) => (
            <Text key={caveat} tone="muted">
              • {caveat}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text variant="label" tone="muted">
          Logged days
        </Text>
        <Text>
          {loggedDays.last30} in the last 30 days · {loggedDays.total} total
        </Text>
        <Text tone="muted">
          {todayObservation ? 'You logged something today.' : 'Nothing logged for today yet.'}
        </Text>
      </Card>

      <Button label="Refresh" variant="secondary" onPress={onRetry} />
    </View>
  )
}
