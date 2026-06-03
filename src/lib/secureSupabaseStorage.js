import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEYCHAIN_OPTS } from './secureMigration';

// Reads prefer SecureStore but fall through to AsyncStorage so a user whose
// migration hasn't run yet (or failed) still stays signed in. Writes go to
// SecureStore and best-effort scrub the AsyncStorage copy so we don't drift
// back to duplicate plaintext on disk after every token refresh.
export const secureSupabaseStorage = {
  async getItem(key) {
    try {
      const fromSecure = await SecureStore.getItemAsync(key);
      if (fromSecure != null) return fromSecure;
    } catch (_) {}
    try {
      return await AsyncStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },

  async setItem(key, value) {
    try {
      await SecureStore.setItemAsync(key, value, TOKEN_KEYCHAIN_OPTS);
      try {
        await AsyncStorage.removeItem(key);
      } catch (_) {}
    } catch (e) {
      // SecureStore write failed (Android Keystore size limits, locked
      // device, etc). Falling back to AsyncStorage keeps the user signed in
      // — a security regression but a functional app beats a brick.
      console.warn(
        '[secureSupabaseStorage] SecureStore write failed, using AsyncStorage:',
        e?.message,
      );
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (_) {}
    try {
      await AsyncStorage.removeItem(key);
    } catch (_) {}
  },
};
