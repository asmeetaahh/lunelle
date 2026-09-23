import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

import { colors, radius, spacing, typography, type ColorTokens, type ThemeName } from './tokens'

export interface Theme {
  name: ThemeName
  colors: ColorTokens
  spacing: typeof spacing
  radius: typeof radius
  typography: typeof typography
}

const ThemeContext = createContext<Theme | null>(null)

// Follows the OS appearance: light = Blossom, dark = Moonlight. V1 also had a
// manual toggle persisted in localStorage; that is a later, deliberate
// addition (it needs local persistence), so it is intentionally absent here.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const name: ThemeName = scheme === 'dark' ? 'moonlight' : 'blossom'

  const theme = useMemo<Theme>(
    () => ({ name, colors: colors[name], spacing, radius, typography }),
    [name],
  )

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('useTheme must be used within a <ThemeProvider>.')
  return theme
}
