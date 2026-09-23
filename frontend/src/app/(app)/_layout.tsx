import { Tabs } from 'expo-router'

import { TabIcon } from '@/components/TabIcon'
import { useTheme } from '@/theme'

// The three primary areas of the authenticated app.
export default function AppLayout() {
  const { colors } = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarIcon: ({ focused }) => <TabIcon glyph="🌸" focused={focused} /> }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: 'Log', tabBarIcon: ({ focused }) => <TabIcon glyph="💧" focused={focused} /> }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: 'You', tabBarIcon: ({ focused }) => <TabIcon glyph="🌙" focused={focused} /> }}
      />
    </Tabs>
  )
}
