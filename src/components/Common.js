import React from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, Pressable } from 'react-native';
import { useTheme } from '../styles/theme';
import { initials, avColor, getTagColor, strengthColor } from '../utils/helpers';

export function Avatar({ contact, size = 44, onPress }) {
  const { theme } = useTheme();
  if (contact.photo) {
    const Wrap = onPress ? TouchableOpacity : View;
    return (
      <Wrap onPress={onPress} activeOpacity={0.8}>
        <Image
          source={{ uri: contact.photo }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      </Wrap>
    );
  }
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avColor(contact.name || ''),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: size * 0.34,
          fontWeight: '700',
          fontFamily: theme.fontBodyBold,
        }}
      >
        {initials(contact.name || '')}
      </Text>
    </Wrap>
  );
}

export function StrengthDot({ contact, style }) {
  const { theme } = useTheme();
  const c = strengthColor(contact.lastContacted, contact.freq, theme);
  return (
    <View
      style={[
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: c,
          borderWidth: 2,
          borderColor: theme.bg,
          position: 'absolute',
          bottom: 0,
          right: 0,
        },
        style,
      ]}
    />
  );
}

export function TagPill({ tag, small }) {
  const c = getTagColor(tag);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: c,
        borderRadius: 4,
        paddingHorizontal: small ? 6 : 8,
        paddingVertical: small ? 1 : 2,
      }}
    >
      <Text
        style={{
          color: c,
          fontSize: small ? 9 : 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        }}
      >
        {tag}
      </Text>
    </View>
  );
}

export function Section({ label, children }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: theme.ac,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          borderBottomWidth: 2,
          borderBottomColor: theme.ac + '40',
          paddingBottom: 8,
          marginBottom: 14,
          fontFamily: theme.fontBodyBold,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function Field({ label, children }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: theme.t4,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          fontFamily: theme.fontBodySemi,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function StyledInput({ value, onChangeText, placeholder, multiline, keyboardType, style, ...rest }) {
  const { theme } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.t6}
      multiline={multiline}
      keyboardType={keyboardType}
      style={[
        {
          backgroundColor: theme.bg2,
          borderWidth: 1,
          borderColor: theme.brd2,
          borderRadius: 12,
          color: theme.t1,
          paddingHorizontal: 14,
          paddingVertical: 11,
          fontSize: 14,
          fontFamily: theme.fontBody,
          minHeight: multiline ? 60 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
      {...rest}
    />
  );
}

export function PrimaryButton({ onPress, label, style, disabled }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        {
          backgroundColor: theme.ac,
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          shadowColor: theme.ac,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 6,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: 15,
          fontWeight: '700',
          fontFamily: theme.fontBodyBold,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ onPress, label, color, style }) {
  const { theme } = useTheme();
  const c = color || theme.ac;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          backgroundColor: c + '15',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c + '40',
          paddingVertical: 8,
          paddingHorizontal: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color: c, fontSize: 12, fontWeight: '600', fontFamily: theme.fontBodySemi }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function Toggle({ value, onValueChange, color }) {
  const { theme } = useTheme();
  const c = color || theme.ac;
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? c : theme.brd2,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#fff',
          marginLeft: value ? 22 : 2,
        }}
      />
    </Pressable>
  );
}

export function BackButton({ onPress, label = 'Back' }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Text
        style={{
          color: theme.t4,
          fontSize: 13,
          fontWeight: '500',
          fontFamily: theme.fontBodyMed,
          marginBottom: 16,
        }}
      >
        ← {label}
      </Text>
    </TouchableOpacity>
  );
}

export function Toast({ toast }) {
  const { theme } = useTheme();
  if (!toast) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <View
        style={{
          backgroundColor: toast.color || theme.ac,
          paddingHorizontal: 24,
          paddingVertical: 10,
          borderRadius: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 13,
            fontWeight: '600',
            fontFamily: theme.fontBodySemi,
          }}
        >
          {toast.msg}
        </Text>
      </View>
    </View>
  );
}
