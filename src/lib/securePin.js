import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  SECURE_PIN_HASH_KEY,
  SECURE_PIN_SALT_KEY,
  PIN_KEYCHAIN_OPTS,
} from './secureMigration';

const ATTEMPTS_KEY = 'crm-pin-attempts-v1';

// After this many consecutive wrong PINs, verifyPin returns lockedOut=true
// forever (until the caller wipes the session or calls clearPin). The caller
// is responsible for sign-out / re-auth flow; this module just refuses to
// keep checking. 10 attempts is enough headroom for finger fumbles but
// keeps brute-forcing a 4-digit PIN out of reach (1-in-1000 odds at the
// lockout boundary).
export const MAX_PIN_ATTEMPTS = 10;

export async function hasPin() {
  try {
    const hash = await SecureStore.getItemAsync(SECURE_PIN_HASH_KEY);
    return hash != null;
  } catch (_) {
    return false;
  }
}

export async function setPin(rawPin) {
  if (typeof rawPin !== 'string' || rawPin.length === 0) {
    throw new Error('PIN must be a non-empty string');
  }
  const saltBytes = await Crypto.getRandomBytesAsync(32);
  const salt = bytesToHex(saltBytes);
  const hash = await hashPin(rawPin, salt);
  await SecureStore.setItemAsync(SECURE_PIN_SALT_KEY, salt, PIN_KEYCHAIN_OPTS);
  await SecureStore.setItemAsync(SECURE_PIN_HASH_KEY, hash, PIN_KEYCHAIN_OPTS);
  await resetAttempts();
}

export async function verifyPin(rawPin) {
  try {
    const attempts = await readAttempts();
    if (attempts >= MAX_PIN_ATTEMPTS) {
      return { ok: false, lockedOut: true, attemptsRemaining: 0 };
    }
    const salt = await SecureStore.getItemAsync(SECURE_PIN_SALT_KEY);
    const storedHash = await SecureStore.getItemAsync(SECURE_PIN_HASH_KEY);
    if (!salt || !storedHash) {
      return {
        ok: false,
        lockedOut: false,
        attemptsRemaining: MAX_PIN_ATTEMPTS - attempts,
      };
    }
    const candidate = await hashPin(rawPin, salt);
    if (constantTimeEqual(candidate, storedHash)) {
      await resetAttempts();
      return { ok: true, lockedOut: false, attemptsRemaining: MAX_PIN_ATTEMPTS };
    }
    const next = attempts + 1;
    await writeAttempts(next);
    return {
      ok: false,
      lockedOut: next >= MAX_PIN_ATTEMPTS,
      attemptsRemaining: Math.max(0, MAX_PIN_ATTEMPTS - next),
    };
  } catch (_) {
    // SecureStore unavailable. Fail closed: report not-ok without burning
    // an attempt, so transient errors don't lock the user out.
    return {
      ok: false,
      lockedOut: false,
      attemptsRemaining: MAX_PIN_ATTEMPTS,
    };
  }
}

export async function clearPin() {
  try { await SecureStore.deleteItemAsync(SECURE_PIN_HASH_KEY); } catch (_) {}
  try { await SecureStore.deleteItemAsync(SECURE_PIN_SALT_KEY); } catch (_) {}
  await resetAttempts();
}

// Snapshot the live PIN state to a per-userId namespace so we can restore
// it if this user signs back in later. Called before clearing/replacing
// live state during a user switch.
export async function backupForUser(userId) {
  if (!userId) return;
  for (const k of [SECURE_PIN_HASH_KEY, SECURE_PIN_SALT_KEY, ATTEMPTS_KEY]) {
    const v = await SecureStore.getItemAsync(k);
    const bk = `backup-${userId}-${k}`;
    if (v != null) {
      await SecureStore.setItemAsync(bk, v, PIN_KEYCHAIN_OPTS);
    } else {
      try { await SecureStore.deleteItemAsync(bk); } catch (_) {}
    }
  }
}

// Restore a previously-snapshotted PIN state into live keys. Caller should
// clearPin() first if they want guaranteed-empty defaults for users with
// no prior backup.
export async function restoreForUser(userId) {
  if (!userId) return;
  for (const k of [SECURE_PIN_HASH_KEY, SECURE_PIN_SALT_KEY, ATTEMPTS_KEY]) {
    const bk = `backup-${userId}-${k}`;
    const v = await SecureStore.getItemAsync(bk);
    if (v != null) {
      await SecureStore.setItemAsync(k, v, PIN_KEYCHAIN_OPTS);
    }
  }
}

export async function getAttemptsRemaining() {
  const attempts = await readAttempts();
  return Math.max(0, MAX_PIN_ATTEMPTS - attempts);
}

async function hashPin(rawPin, salt) {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + rawPin,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

async function readAttempts() {
  try {
    const v = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    const n = parseInt(v || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

async function writeAttempts(n) {
  try {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, String(n), PIN_KEYCHAIN_OPTS);
  } catch (_) {}
}

async function resetAttempts() {
  try { await SecureStore.deleteItemAsync(ATTEMPTS_KEY); } catch (_) {}
}

function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

// Constant-time string compare. SHA-256 hex is fixed-length so length leak
// isn't meaningful, but the loop still avoids early-out on first mismatch.
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
