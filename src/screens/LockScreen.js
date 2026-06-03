import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../styles/theme';
import { LockIcon } from '../components/Icons';

export default function LockScreen({
  hasPin,
  onVerifyPin,
  faceIdEnabled,
  onUnlock,
  onLockout,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [entered, setEntered] = useState('');
  const [wrong, setWrong] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricAttempting, setBiometricAttempting] = useState(false);
  // Guard so we only auto-prompt once per mount. Manual taps on the button
  // re-trigger via tryBiometric() and don't touch this ref.
  const autoPromptedRef = useRef(false);

  // Detect whether the device actually supports biometrics + is enrolled.
  // hasHardwareAsync covers "no Face/Touch ID sensor" (e.g. older iPad).
  // isEnrolledAsync covers "sensor exists but no face/finger registered."
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!cancelled) setBiometricSupported(hasHw && enrolled);
      } catch (_) {
        if (!cancelled) setBiometricSupported(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function tryBiometric() {
    if (biometricAttempting) return;
    setBiometricAttempting(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Veery',
        cancelLabel: 'Use PIN',
        // Don't auto-fallback to device passcode — we have our own PIN.
        disableDeviceFallback: true,
      });
      if (result.success) {
        onUnlock();
      }
    } catch (_) {
      // Any error -> just fall back to PIN entry.
    } finally {
      setBiometricAttempting(false);
    }
  }

  // Auto-prompt Face ID once, when biometrics are supported + the user has
  // opted in. If they cancel or it fails, they can tap the button to retry
  // or just enter the PIN.
  useEffect(() => {
    if (!faceIdEnabled || !biometricSupported || autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceIdEnabled, biometricSupported]);

  // If the user backgrounded the app mid-prompt and then came back, iOS may
  // dismiss the system biometric sheet. Re-arm so the next time the lock
  // screen mounts (or the app returns to foreground while still locked) we
  // can prompt again. We don't auto-retry on every foreground here because
  // it would feel pushy; the manual button covers it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') autoPromptedRef.current = false;
    });
    return () => sub.remove();
  }, []);

  async function press(n) {
    if (entered.length >= 4 || verifying || lockedOut || !hasPin) return;
    const next = entered + n;
    setEntered(next);
    setWrong(false);
    if (next.length === 4) {
      setVerifying(true);
      let result;
      try {
        result = await onVerifyPin(next);
      } catch (_) {
        result = { ok: false, lockedOut: false, attemptsRemaining: null };
      }
      setVerifying(false);
      if (result.ok) {
        onUnlock();
        return;
      }
      setEntered('');
      setWrong(true);
      if (typeof result.attemptsRemaining === 'number') {
        setAttemptsRemaining(result.attemptsRemaining);
      }
      if (result.lockedOut) {
        setLockedOut(true);
        // Tell App.js to sign the user out so they can re-auth and reset
        // the PIN. Defer one tick so the lockout UI renders first.
        if (onLockout) setTimeout(onLockout, 1500);
      }
    }
  }

  function backspace() {
    if (verifying || lockedOut) return;
    setEntered((p) => p.slice(0, -1));
    setWrong(false);
  }

  const showBiometricButton = faceIdEnabled && biometricSupported;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 70,
          height: 70,
          borderRadius: 35,
          backgroundColor: theme.bgWarn2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <LockIcon size={32} color={theme.warn} strokeWidth={1.5} />
      </View>
      <Text
        style={{
          fontSize: 24,
          color: theme.t1,
          fontWeight: '600',
          marginBottom: 8,
          fontFamily: theme.fontDisplay,
        }}
      >
        Enter PIN
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: lockedOut || wrong ? theme.red : theme.t5,
          marginBottom: 30,
          textAlign: 'center',
          paddingHorizontal: 24,
        }}
      >
        {lockedOut
          ? 'Too many wrong PINs. Signing out…'
          : wrong && attemptsRemaining != null && attemptsRemaining <= 3
            ? `Wrong PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} left.`
            : wrong
              ? 'Wrong PIN. Try again.'
              : verifying
                ? 'Checking…'
                : '4 digits'}
      </Text>

      {/* Dots */}
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 30 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: entered.length > i ? theme.ac : 'transparent',
              borderWidth: 2,
              borderColor: entered.length > i ? theme.ac : theme.brd2,
            }}
          />
        ))}
      </View>

      {showBiometricButton && (
        <TouchableOpacity
          onPress={tryBiometric}
          disabled={biometricAttempting}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.brd2,
            marginBottom: 20,
            opacity: biometricAttempting ? 0.5 : 1,
          }}
        >
          <Text style={{ color: theme.t3, fontSize: 13, fontWeight: '500' }}>
            {biometricAttempting ? 'Authenticating...' : 'Use Face ID'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Numpad */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 240, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <PadKey key={n} label={String(n)} onPress={() => press(String(n))} />
        ))}
        <View style={{ width: 70, height: 70, margin: 5 }} />
        <PadKey label="0" onPress={() => press('0')} />
        <PadKey label="←" onPress={backspace} small />
      </View>
    </View>
  );
}

function PadKey({ label, onPress, small }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: theme.bg2,
        borderWidth: 1,
        borderColor: theme.brd,
        alignItems: 'center',
        justifyContent: 'center',
        margin: 5,
      }}
    >
      <Text
        style={{
          color: theme.t1,
          fontSize: small ? 18 : 26,
          fontWeight: '500',
          fontFamily: theme.fontDisplay,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
