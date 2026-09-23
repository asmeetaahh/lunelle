import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'

import { AuthProvider, useAuth } from '@/auth'
import { ThemeProvider, useTheme } from '@/theme'

function RootNavigator() {
  const { status } = useAuth()
  const { colors, name } = useTheme()

  // Only while the stored session is being read from SecureStore on launch.
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  const isSignedIn = status === 'signedIn'

  return (
    <>
      <StatusBar style={name === 'moonlight' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        {/* Route groups are gated on auth state: a signed-out user cannot reach
            (app), a signed-in user cannot reach (auth). Expo Router redirects
            automatically when a guard flips. */}
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  )
}
