import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { LockIcon } from '../components/Icons';

export default function LockScreen({ pin, onUnlock }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [entered, setEntered] = useState('');
  const [wrong, setWrong] = useState(false);

  function press(n) {
    if (entered.length >= 4) return;
    const next = entered + n;
    setEntered(next);
    setWrong(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === pin) {
          onUnlock();
        } else {
          setWrong(true);
          setEntered('');
        }
      }, 150);
    }
  }

  function backspace() {
    setEntered((p) => p.slice(0, -1));
    setWrong(false);
  }

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
      <Text style={{ fontSize: 13, color: wrong ? theme.red : theme.t5, marginBottom: 30 }}>
        {wrong ? 'Wrong PIN. Try again.' : '4 digits'}
      </Text>

      {/* Dots */}
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 50 }}>
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
