import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { Section, Field, StyledInput, PrimaryButton, BackButton } from '../components/Common';
import { LockIcon, UserIcon } from '../components/Icons';

export default function SecurityScreen({
  pin,
  onSavePin,
  onRemovePin,
  displayName,
  onSaveDisplayName,
  username,
  onSaveUsername,
  password,
  onSavePassword,
  onBack,
  showToast,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(displayName || '');
  const [user, setUser] = useState(username || '');
  const [pass, setPass] = useState(password || '');
  const [pinMode, setPinMode] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  function saveProfile() {
    onSaveDisplayName(name);
    onSaveUsername(user);
    onSavePassword(pass);
    showToast('Profile saved');
  }

  function startPinChange(mode) {
    setPinMode(mode);
    setNewPin('');
    setConfirmPin('');
  }

  function commitPin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Alert.alert('PIN must be 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('PINs don\'t match');
      return;
    }
    onSavePin(newPin);
    showToast('PIN saved');
    setPinMode(null);
    setNewPin('');
    setConfirmPin('');
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
          <Field label="Password">
            <StyledInput
              value={pass}
              onChangeText={setPass}
              placeholder="Optional"
              secureTextEntry
            />
          </Field>
          <PrimaryButton onPress={saveProfile} label="Save Profile" />
        </Section>

        <Section label="Lock Screen">
          {pin ? (
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
                onPress={() => startPinChange(pin ? 'change' : 'set')}
                label={pin ? 'Change PIN' : 'Set PIN'}
              />
              {pin && (
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
        </Section>
      </ScrollView>
    </View>
  );
}
