import { View, type ViewProps } from 'react-native'

import { useTheme } from '@/theme'

export function Card({ style, ...rest }: ViewProps) {
  const { colors, radius, spacing } = useTheme()

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.xl,
          gap: spacing.sm,
        },
        style,
      ]}
      {...rest}
    />
  )
}
