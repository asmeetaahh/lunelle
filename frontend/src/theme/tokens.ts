// Design tokens. Colour values are carried over verbatim from the V1 web app
// (src/index.css) so V2 keeps Lunelle's visual identity:
//   Blossom   = the light palette
//   Moonlight = the dark palette
// Spacing / radius / type sizes approximate V1's Tailwind scale (rounded-2xl
// = 16, cards ~ 24-28, text-base = 16, text-xl = 20, text-3xl = 30).

export type ThemeName = 'blossom' | 'moonlight'

export interface ColorTokens {
  canvas: string
  surface: string
  surfaceAlt: string
  border: string
  ink: string
  inkMuted: string
  primary: string
  primarySoft: string
  accent: string
  accentSoft: string
  warnBg: string
  warnText: string
  /** Text/icon colour on top of `primary` (V1 used white in both themes). */
  onPrimary: string
}

export const colors: Record<ThemeName, ColorTokens> = {
  blossom: {
    canvas: '#fdf3f8',
    surface: '#ffffff',
    surfaceAlt: '#fdf1f7',
    border: '#f4dced',
    ink: '#402138',
    inkMuted: '#8a6b85',
    primary: '#ec4899',
    primarySoft: '#fbcfe8',
    accent: '#a78bfa',
    accentSoft: '#ede9fe',
    warnBg: '#fef3c7',
    warnText: '#92400e',
    onPrimary: '#ffffff',
  },
  moonlight: {
    canvas: '#180f26',
    surface: '#241733',
    surfaceAlt: '#2c1c3d',
    border: '#3c2a52',
    ink: '#f3e8ff',
    inkMuted: '#b7a2cf',
    primary: '#f472b6',
    primarySoft: '#5b2a55',
    accent: '#c4b5fd',
    accentSoft: '#3a2a5c',
    warnBg: '#4a3a1a',
    warnText: '#fbbf24',
    onPrimary: '#ffffff',
  },
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  pill: 999,
} as const

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const

export type TypographyVariant = keyof typeof typography
