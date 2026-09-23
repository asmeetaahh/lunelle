import { Text as RNText, type TextProps as RNTextProps } from 'react-native'

import { useTheme, type TypographyVariant } from '@/theme'

interface TextProps extends RNTextProps {
  variant?: TypographyVariant
  /** `muted` for secondary copy, `primary` for emphasis. */
  tone?: 'default' | 'muted' | 'primary'
}

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const { colors, typography } = useTheme()
  const color = tone === 'muted' ? colors.inkMuted : tone === 'primary' ? colors.primary : colors.ink

  return <RNText style={[typography[variant], { color }, style]} {...rest} />
}
