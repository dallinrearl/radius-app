import React, { useRef } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTheme } from '../styles/theme';

// Three-box date input: MM / DD / YYYY. Each box is independently optional.
// Auto-tabs to the next box when the user types enough digits.
// Stores value as { month, day, year } where each is a number or null.

export default function DateInput({ value, onChange, requireYear = false, compact = false }) {
  const { theme } = useTheme();
  const dayRef = useRef(null);
  const yearRef = useRef(null);

  const v = value || {};
  const monthStr = v.month != null ? String(v.month).padStart(2, '0') : '';
  const dayStr = v.day != null ? String(v.day).padStart(2, '0') : '';
  const yearStr = v.year != null ? String(v.year) : '';

  function update(part, raw) {
    const digits = (raw || '').replace(/\D/g, '');
    let nextVal;
    if (part === 'month') {
      if (digits === '') nextVal = { ...v, month: null };
      else {
        const n = parseInt(digits.slice(0, 2), 10);
        nextVal = { ...v, month: n };
        if (digits.length >= 2 || (digits.length === 1 && parseInt(digits, 10) > 1)) {
          dayRef.current && dayRef.current.focus();
        }
      }
    } else if (part === 'day') {
      if (digits === '') nextVal = { ...v, day: null };
      else {
        const n = parseInt(digits.slice(0, 2), 10);
        nextVal = { ...v, day: n };
        if (digits.length >= 2 || (digits.length === 1 && parseInt(digits, 10) > 3)) {
          yearRef.current && yearRef.current.focus();
        }
      }
    } else if (part === 'year') {
      if (digits === '') nextVal = { ...v, year: null };
      else {
        const n = parseInt(digits.slice(0, 4), 10);
        nextVal = { ...v, year: n };
      }
    }
    onChange(nextVal);
  }

  const monthInvalid = v.month != null && (v.month < 1 || v.month > 12);
  const dayInvalid = v.day != null && (v.day < 1 || v.day > 31);
  const currentYear = new Date().getFullYear();
  const yearInvalid = v.year != null && (v.year < 1900 || v.year > currentYear);
  const yearMissingButRequired = requireYear && !v.year;

  function boxStyle(invalid, width) {
    return {
      backgroundColor: theme.bg2,
      borderWidth: 1,
      borderColor: invalid ? theme.red : theme.brd2,
      borderRadius: 10,
      color: theme.t1,
      paddingHorizontal: compact ? 8 : 10,
      paddingVertical: compact ? 8 : 10,
      fontSize: compact ? 13 : 14,
      fontFamily: theme.fontBody,
      width,
      textAlign: 'center',
    };
  }

  const labelStyle = {
    fontSize: 9,
    fontWeight: '700',
    color: theme.t5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 3,
    textAlign: 'center',
  };

  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <View>
        <Text style={labelStyle}>Month</Text>
        <TextInput
          value={monthStr}
          onChangeText={(t) => update('month', t)}
          placeholder="MM"
          placeholderTextColor={theme.t6}
          keyboardType="number-pad"
          maxLength={2}
          style={boxStyle(monthInvalid, compact ? 50 : 56)}
        />
      </View>
      <View>
        <Text style={labelStyle}>Day</Text>
        <TextInput
          ref={dayRef}
          value={dayStr}
          onChangeText={(t) => update('day', t)}
          placeholder="DD"
          placeholderTextColor={theme.t6}
          keyboardType="number-pad"
          maxLength={2}
          style={boxStyle(dayInvalid, compact ? 50 : 56)}
        />
      </View>
      <View>
        <Text style={labelStyle}>Year</Text>
        <TextInput
          ref={yearRef}
          value={yearStr}
          onChangeText={(t) => update('year', t)}
          placeholder="YYYY"
          placeholderTextColor={theme.t6}
          keyboardType="number-pad"
          maxLength={4}
          style={boxStyle(yearInvalid || yearMissingButRequired, compact ? 70 : 80)}
        />
      </View>
    </View>
  );
}