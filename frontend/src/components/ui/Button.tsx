import { Pressable, type PressableProps } from 'react-native'

import { useTheme } from '@/theme'
import { Text } from './Text'

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string
  /** `secondary` is the quiet outlined style V1 used for Cancel / Sign out. */
  variant?: 'primary' | 'secondary'
}

export function Button({ label, variant = 'primary', disabled, ...rest }: ButtonProps) {
  const { colors, radius, spacing } = useTheme()
  const isPrimary = variant === 'primary'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        paddingVertical: spacing.md + 2,
        paddingHorizontal: spacing.xl,
        backgroundColor: isPrimary ? colors.primary : 'transparent',
        borderWidth: isPrimary ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
      {...rest}
    >
      <Text
        variant="label"
        style={{ color: isPrimary ? colors.onPrimary : colors.inkMuted }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
