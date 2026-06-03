import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../styles/theme';
import { Section, Field, StyledInput, PrimaryButton, BackButton } from '../components/Common';
import { Toggle } from '../components/Common';
import { LockIcon, UserIcon } from '../components/Icons';

export default function SecurityScreen({
  hasPin,
  onSetPin,
  onRemovePin,
  faceIdEnabled,
  onSaveFaceIdEnabled,
  displayName,
  onSaveDisplayName,
  username,
  onSaveUsername,
  onBack,
  showToast,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(displayName || '');
  const [user, setUser] = useState(username || '');
  const [pinMode, setPinMode] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Face ID');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
          ? 'Face ID'
          : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
            ? 'Touch ID'
            : 'Biometrics';
        if (!cancelled) {
          setBiometricAvailable(hasHw && enrolled);
          setBiometricLabel(label);
        }
      } catch (_) {
        if (!cancelled) setBiometricAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggleFaceId(nextValue) {
    if (!hasPin) {
      Alert.alert('Set a PIN first', 'Biometric unlock needs a PIN as the fallback.');
      return;
    }
    if (!nextValue) {
      await onSaveFaceIdEnabled(false);
      showToast && showToast(`${biometricLabel} off`);
      return;
    }
    // Re-check support at the moment of the tap (in case the user changed
    // their device biometrics since the screen mounted, or our initial
    // detection raced).
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHw) {
        Alert.alert(
          `${biometricLabel} unavailable`,
          'This device does not have biometric hardware.',
        );
        return;
      }
      if (!enrolled) {
        Alert.alert(
          `${biometricLabel} not set up`,
          `Add ${biometricLabel} in your device Settings, then try again.`,
        );
        return;
      }
    } catch (e) {
      Alert.alert('Could not check biometrics', e.message || 'Try again.');
      return;
    }
    // Verify the user is actually the device owner before enabling, so a
    // bystander with the unlocked phone can't silently enroll themselves.
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricLabel} for Veery`,
        disableDeviceFallback: true,
      });
      if (!result.success) {
        // The most common failure here in dev is Expo Go: it ignores the
        // NSFaceIDUsageDescription in our app.json (uses its own bundle id),
        // so authenticateAsync returns error: 'missing_usage_description'.
        // In a production / dev-client build this branch only fires on
        // genuine user cancel or auth failure and we stay silent.
        if (result.error === 'missing_usage_description') {
          Alert.alert(
            `${biometricLabel} needs a dev build`,
            'Expo Go cannot prompt for Face ID. This works in EAS dev clients and in App Store builds.',
          );
        }
        return;
      }
      await onSaveFaceIdEnabled(true);
      showToast && showToast(`${biometricLabel} on`);
    } catch (_) {
      Alert.alert('Could not enable', `Something went wrong verifying ${biometricLabel}.`);
    }
  }

  function saveProfile() {
    onSaveDisplayName(name);
    onSaveUsername(user);
    showToast('Profile saved');
  }

  function startPinChange(mode) {
    setPinMode(mode);
    setNewPin('');
    setConfirmPin('');
  }

  async function commitPin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Alert.alert('PIN must be 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('PINs don\'t match');
      return;
    }
    try {
      await onSetPin(newPin);
      showToast('PIN saved');
      setPinMode(null);
      setNewPin('');
      setConfirmPin('');
    } catch (e) {
      Alert.alert('Could not save PIN', e?.message || 'Try again.');
    }
  }

  function confirmRemove() {
    Alert.alert('Remove PIN', 'Disable PIN protection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          onRemovePin();
          showToast('PIN removed');
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 100,
        }}
      >
        <BackButton onPress={onBack} />
        <Text
          style={{
            fontSize: 22,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 4,
            fontFamily: theme.fontDisplay,
          }}
        >
          Security
        </Text>
        <Text style={{ fontSize: 13, color: theme.t5, marginBottom: 24 }}>
          Manage your account and lock screen.
        </Text>

        <Section label="Profile">
          <Field label="Display Name">
            <StyledInput value={name} onChangeText={setName} placeholder="Your name" />
          </Field>
          <Field label="Username">
            <StyledInput
              value={user}
              onChangeText={setUser}
              placeholder="Optional"
              autoCapitalize="none"
            />
          </Field>
          <PrimaryButton onPress={saveProfile} label="Save Profile" />
        </Section>

        <Section label="Lock Screen">
          {hasPin ? (
            <View
              style={{
                backgroundColor: theme.bgAc,
                borderWidth: 1,
                borderColor: theme.brdAc,
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <LockIcon size={20} color={theme.ac} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.ac, fontSize: 13, fontWeight: '600' }}>
                  PIN protection enabled
                </Text>
                <Text style={{ color: theme.t4, fontSize: 11 }}>
                  Your data is locked when you open the app.
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: theme.brd,
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: theme.t3, fontSize: 13 }}>
                No PIN set. Set one to lock the app.
              </Text>
            </View>
          )}

          {pinMode ? (
            <View style={{ gap: 10 }}>
              <Field label={pinMode === 'set' ? 'Set 4-digit PIN' : 'New 4-digit PIN'}>
                <StyledInput
                  value={newPin}
                  onChangeText={(v) => setNewPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
              </Field>
              <Field label="Confirm PIN">
                <StyledInput
                  value={confirmPin}
                  onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
              </Field>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setPinMode(null)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.brd2,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: theme.t4, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <PrimaryButton onPress={commitPin} label="Save PIN" />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <PrimaryButton
                onPress={() => startPinChange(hasPin ? 'change' : 'set')}
                label={hasPin ? 'Change PIN' : 'Set PIN'}
              />
              {hasPin && (
                <TouchableOpacity
                  onPress={confirmRemove}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.brdRed,
                    backgroundColor: theme.bgRed,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: theme.red, fontSize: 13, fontWeight: '600' }}>
                    Remove PIN
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Face ID / Touch ID. Requires a PIN to be set (PIN is the
              fallback when biometrics fail or aren't enrolled) and the
              device must actually support biometrics.

              We make the whole row a TouchableOpacity instead of relying
              on the embedded Toggle's Pressable — gives a bigger hit
              target and avoids a flaky-touch issue we saw on iOS. */}
          <TouchableOpacity
            onPress={() => handleToggleFaceId(!faceIdEnabled)}
            activeOpacity={0.7}
            style={{
              marginTop: 16,
              padding: 14,
              backgroundColor: theme.bg2,
              borderWidth: 1,
              borderColor: theme.brd,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: hasPin && biometricAvailable ? 1 : 0.5,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '600' }}>
                Unlock with {biometricLabel}
              </Text>
              <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
                {!hasPin
                  ? 'Set a PIN first to enable biometric unlock.'
                  : !biometricAvailable
                    ? `${biometricLabel} is not available on this device.`
                    : `Use ${biometricLabel} instead of your PIN. PIN still works as a fallback.`}
              </Text>
            </View>
            <View pointerEvents="none">
              <Toggle value={!!faceIdEnabled} onValueChange={() => {}} />
            </View>
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </View>
  );
}
