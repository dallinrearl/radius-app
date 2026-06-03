import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';
import { TOKEN_KEYCHAIN_OPTS } from './secureMigration';

// LargeSecureStore pattern (recommended by Supabase docs for RN). The
// Supabase session blob is 2-3KB and exceeds the Android Keystore 2KB
// soft-cap that triggers a write warning. Instead of storing the blob
// directly in SecureStore, we generate a fresh per-write AES-256 key,
// keep that tiny key in SecureStore (well under any limit), and put the
// ciphertext in AsyncStorage (no size cap). An offline attacker with
// disk access still needs to compromise SecureStore to decrypt — same
// threat boundary as storing the blob there directly.

function encKeyFor(key) {
  return `${key}-enckey`;
}

async function encrypt(plaintext) {
  const encryptionKey = await Crypto.getRandomBytesAsync(32);
  const cipher = new aesjs.ModeOfOperation.ctr(
    encryptionKey,
    new aesjs.Counter(1),
  );
  const ciphertext = cipher.encrypt(aesjs.utils.utf8.toBytes(plaintext));
  return {
    keyHex: aesjs.utils.hex.fromBytes(encryptionKey),
    ciphertextHex: aesjs.utils.hex.fromBytes(ciphertext),
  };
}

function decrypt(ciphertextHex, keyHex) {
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(keyHex),
    new aesjs.Counter(1),
  );
  const plaintext = cipher.decrypt(aesjs.utils.hex.toBytes(ciphertextHex));
  return aesjs.utils.utf8.fromBytes(plaintext);
}

export const secureSupabaseStorage = {
  async getItem(key) {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (stored != null) {
        // Supabase sessions are JSON, so a `{` prefix means it's legacy
        // plaintext we wrote before the LargeSecureStore switch. Hand it
        // back as-is; the next setItem will re-store it encrypted.
        if (stored.startsWith('{')) return stored;
        const keyHex = await SecureStore.getItemAsync(encKeyFor(key));
        if (keyHex) {
          try {
            return decrypt(stored, keyHex);
          } catch (_) {
            // Ciphertext/key mismatch — treat as missing, force re-auth.
            return null;
          }
        }
        return null;
      }
      // Legacy migration v1 wrote the raw token into SecureStore. Read it
      // back so existing users stay signed in; setItem on the next token
      // refresh moves them onto the new format.
      const legacy = await SecureStore.getItemAsync(key);
      if (legacy != null) return legacy;
      return null;
    } catch (_) {
      return null;
    }
  },

  async setItem(key, value) {
    try {
      const { keyHex, ciphertextHex } = await encrypt(value);
      await SecureStore.setItemAsync(encKeyFor(key), keyHex, TOKEN_KEYCHAIN_OPTS);
      await AsyncStorage.setItem(key, ciphertextHex);
      // Clear out anywhere the token might have lived in plaintext before
      // this write, so we don't keep stale copies on disk.
      try { await SecureStore.deleteItemAsync(key); } catch (_) {}
    } catch (e) {
      console.warn(
        '[secureSupabaseStorage] encrypted write failed, falling back to plaintext AsyncStorage:',
        e?.message,
      );
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key) {
    try { await AsyncStorage.removeItem(key); } catch (_) {}
    try { await SecureStore.deleteItemAsync(encKeyFor(key)); } catch (_) {}
    try { await SecureStore.deleteItemAsync(key); } catch (_) {}
  },
};
