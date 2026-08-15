import { useCallback, useEffect, useState } from 'react'
import { STORAGE_KEY, THEMES, ThemeContext } from './theme-context'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'blossom'

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (THEMES.includes(stored)) return stored

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'moonlight' : 'blossom'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'blossom' ? 'moonlight' : 'blossom'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
