import { Text } from 'react-native'

// Emoji stand-ins for tab icons, in keeping with V1's playful tone and to avoid
// adding an icon-library dependency to the foundation. Swap for real icons
// when the tab bar is designed.
export function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text accessible={false} style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>
      {glyph}
    </Text>
  )
}
