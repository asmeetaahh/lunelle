// Thin wrapper over expo-secure-store (iOS Keychain / Android Keystore).
// For SENSITIVE values only — auth tokens and similar. Not a general cache.
//
// Keys are namespaced; SecureStore only allows alphanumerics, ".", "-" and "_".

import * as SecureStore from 'expo-secure-store'

const PREFIX = 'lunelle.'

export const secureStorage = {
  /** Resolves `null` when the key is absent OR the keychain read fails (treated as "no value"). */
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(`${PREFIX}${key}`)
    } catch (error) {
      if (__DEV__) console.warn(`secureStorage.getItem("${key}") failed:`, error)
      return null
    }
  },

  /** Rejects if the value could not be persisted, so callers know it won't survive a restart. */
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(`${PREFIX}${key}`, value)
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(`${PREFIX}${key}`)
  },
}
