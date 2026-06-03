import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const MIGRATION_V1_FLAG_KEY = 'crm-secure-migration-v1-done';
const MIGRATION_V2_FLAG_KEY = 'crm-secure-migration-v2-done';

// Exported so the not-yet-written secure PIN module reads from the same keys.
export const SECURE_PIN_HASH_KEY = 'crm-pin-hash-v1';
export const SECURE_PIN_SALT_KEY = 'crm-pin-salt-v1';

// AFTER_FIRST_UNLOCK lets Supabase's autoRefreshToken fire while the screen
// is off; WHEN_UNLOCKED would silently break overnight token refresh.
export const TOKEN_KEYCHAIN_OPTS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// PIN material is only read during interactive unlock, so the stricter ACL
// is fine and gives us "not readable while locked" as defense in depth.
export const PIN_KEYCHAIN_OPTS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

export async function migrateInsecureStorage() {
  const v1 = await runV1();
  const v2 = await runV2();
  const hasError = v1.status === 'error' || v2.status === 'error';
  return { status: hasError ? 'error' : 'ok', v1, v2 };
}

async function runV1() {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_V1_FLAG_KEY);
    if (done === 'true') return { status: 'already-done' };

    const details = {
      supabaseSession: await migrateSupabaseSession(),
      pin: await migratePin(),
      passwordScrubbed: await scrubPassword(),
    };

    // Commit the flag LAST. A crash before this line leaves the flag unset
    // so the next launch retries the whole batch — partial commits would
    // wedge users into an inconsistent half-migrated state.
    await AsyncStorage.setItem(MIGRATION_V1_FLAG_KEY, 'true');
    return { status: 'migrated', details };
  } catch (error) {
    return { status: 'error', error };
  }
}

async function runV2() {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_V2_FLAG_KEY);
    if (done === 'true') return { status: 'already-done' };

    // Only scrub PIN plaintext if the v1 hash made it into SecureStore.
    // Without the hash there's nothing to verify against, and removing the
    // plaintext would strand the user with no PIN. v2's flag stays unset so
    // the scrub retries on the next launch after v1 succeeds.
    const hash = await SecureStore.getItemAsync(SECURE_PIN_HASH_KEY);
    const pinPlaintext = await AsyncStorage.getItem('crm-pin');

    if (pinPlaintext != null && !hash) {
      return { status: 'aborted-no-hash' };
    }

    if (pinPlaintext != null) {
      await AsyncStorage.removeItem('crm-pin');
    }

    // Re-scrub crm-password unconditionally. v1's scrub ran before the
    // Password UI was removed, so users who installed v1 could have typed
    // into the field afterward and re-populated the key. Idempotent: noop
    // if the key isn't there.
    const passwordPlaintext = await AsyncStorage.getItem('crm-password');
    if (passwordPlaintext != null) {
      await AsyncStorage.removeItem('crm-password');
    }

    await AsyncStorage.setItem(MIGRATION_V2_FLAG_KEY, 'true');
    return {
      status: 'migrated',
      details: {
        pinPlaintextScrubbed: pinPlaintext != null,
        passwordPlaintextScrubbed: passwordPlaintext != null,
      },
    };
  } catch (error) {
    return { status: 'error', error };
  }
}

async function migrateSupabaseSession() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) return 'no-supabase-url';

  const projectRef = extractProjectRef(url);
  if (!projectRef) return 'no-project-ref';

  // Supabase v2's default storageKey when none is provided.
  const key = `sb-${projectRef}-auth-token`;
  const existing = await AsyncStorage.getItem(key);
  if (existing == null) return 'no-session-found';

  await SecureStore.setItemAsync(key, existing, TOKEN_KEYCHAIN_OPTS);
  await AsyncStorage.removeItem(key);
  return 'copied';
}

async function migratePin() {
  const plaintext = await AsyncStorage.getItem('crm-pin');
  if (plaintext == null) return 'no-pin-found';

  const saltBytes = await Crypto.getRandomBytesAsync(32);
  const salt = bytesToHex(saltBytes);
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + plaintext,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  await SecureStore.setItemAsync(SECURE_PIN_SALT_KEY, salt, PIN_KEYCHAIN_OPTS);
  await SecureStore.setItemAsync(SECURE_PIN_HASH_KEY, hash, PIN_KEYCHAIN_OPTS);

  // Plaintext scrub deferred to v2 — runs only after the hash is confirmed
  // in SecureStore so a half-finished v1 doesn't strand the user.
  return 'hashed';
}

async function scrubPassword() {
  // The `crm-password` field was decorative — never used for auth. We just
  // need it off disk for users who typed something into the old field.
  try {
    await AsyncStorage.removeItem('crm-password');
    return true;
  } catch (_) {
    return false;
  }
}

function extractProjectRef(url) {
  const m = url.match(/^https?:\/\/([^.]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}
