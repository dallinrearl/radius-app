import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../styles/theme';
import { signUp, signIn } from '../lib/auth';

export default function AuthScreen({ onAuthed }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'signup' && !fullName) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const result =
      mode === 'signup'
        ? await signUp(email.trim(), password, fullName.trim())
        : await signIn(email.trim(), password);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (mode === 'signup' && !result.session) {
      Alert.alert(
        'Check your email',
        'We sent you a confirmation link. Tap it, then come back and sign in.'
      );
      setMode('signin');
      setPassword('');
      return;
    }

    onAuthed?.(result.user);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        padding: 24,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 36,
          fontWeight: '700',
          color: theme.t1,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        Radius
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: theme.t4,
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        {mode === 'signin' ? 'Welcome back' : 'Create your account'}
      </Text>

      {mode === 'signup' && (
        <TextInput
          placeholder="Full name"
          placeholderTextColor={theme.t6}
          value={fullName}
          onChangeText={setFullName}
          style={{
            backgroundColor: theme.surface,
            color: theme.t1,
            padding: 14,
            borderRadius: 10,
            marginBottom: 12,
            fontSize: 16,
          }}
        />
      )}

      <TextInput
        placeholder="Email"
        placeholderTextColor={theme.t6}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          backgroundColor: theme.surface,
          color: theme.t1,
          padding: 14,
          borderRadius: 10,
          marginBottom: 12,
          fontSize: 16,
        }}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor={theme.t6}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          backgroundColor: theme.surface,
          color: theme.t1,
          padding: 14,
          borderRadius: 10,
          marginBottom: 16,
          fontSize: 16,
        }}
      />

      {error ? (
        <Text style={{ color: '#ff6b6b', marginBottom: 12, textAlign: 'center' }}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading}
        style={{
          backgroundColor: theme.t1,
          padding: 16,
          borderRadius: 10,
          alignItems: 'center',
          marginBottom: 16,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={theme.bg} />
        ) : (
          <Text style={{ color: theme.bg, fontWeight: '700', fontSize: 16 }}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
        <Text style={{ color: theme.t4, textAlign: 'center', fontSize: 14 }}>
          {mode === 'signin'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}