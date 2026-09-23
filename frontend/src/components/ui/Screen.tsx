import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

import { useTheme } from '@/theme'
import { Text } from './Text'

interface ScreenProps {
  title: string
  subtitle?: string
  children?: ReactNode
  /**
   * Safe-area edges to pad. Tab screens leave the bottom to the tab bar;
   * screens outside the tab bar (e.g. Welcome) should pass all four.
   */
  edges?: readonly Edge[]
}

export function Screen({ title, subtitle, children, edges = ['top'] }: ScreenProps) {
  const { colors, spacing } = useTheme()

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.xl,
          gap: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.sm }}>
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text tone="muted">{subtitle}</Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
