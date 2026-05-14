import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTheme } from '../styles/theme';

// Three-box date input: MM / DD / YYYY. Each box is independently optional.
// Auto-tabs to the next box when the user types enough digits.
// Stores value as { month, day, year } where each is a number or null.
//
// Bug fix: previously we derived the displayed string from the parsed
// number every render and re-padded with leading zeros. That made it
// impossible to type a second digit, since after "6" the field would
// immediately re-render as "06" and the cursor would land after the zero.
//
// New approach: hold the raw typed string in local state. Only sync FROM
// props when the prop changes from outside (e.g. parent reset). Only emit
// padded/parsed values upward. On blur, normalize what's shown to the
// padded form so a saved "6" displays as "06".

export default function DateInput({ value, onChange, requireYear = false, compact = false }) {
  const { theme } = useTheme();
  const dayRef = useRef(null);
  const yearRef = useRef(null);

  const v = value || {};

  // Local typed strings. Initialized from props, but the user's typing
  // wins until they blur or the parent resets the value externally.
  const [monthStr, setMonthStr] = useState(
    v.month != null ? String(v.month).padStart(2, '0') : '',
  );
  const [dayStr, setDayStr] = useState(
    v.day != null ? String(v.day).padStart(2, '0') : '',
  );
  const [yearStr, setYearStr] = useState(v.year != null ? String(v.year) : '');

  // Sync down when the parent value changes from outside. Compare parsed
  // numbers vs current local string so a user mid-type isn't yanked.
  useEffect(() => {
    const propMonth = v.month != null ? String(v.month).padStart(2, '0') : '';
    if (parseInt(monthStr, 10) !== v.month && monthStr !== propMonth) {
      setMonthStr(propMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.month]);
  useEffect(() => {
    const propDay = v.day != null ? String(v.day).padStart(2, '0') : '';
    if (parseInt(dayStr, 10) !== v.day && dayStr !== propDay) {
      setDayStr(propDay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.day]);
  useEffect(() => {
    const propYear = v.year != null ? String(v.year) : '';
    if (parseInt(yearStr, 10) !== v.year && yearStr !== propYear) {
      setYearStr(propYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.year]);

  function emitChange(part, parsed) {
    const next = { ...v, [part]: parsed };
    onChange(next);
  }

  function onMonthChange(raw) {
    const digits = (raw || '').replace(/\D/g, '').slice(0, 2);
    setMonthStr(digits);
    if (digits === '') {
      emitChange('month', null);
      return;
    }
    const n = parseInt(digits, 10);
    emitChange('month', n);
    // Auto-advance: 2 digits typed, or a leading digit > 1 (can't start a month with 2-9).
    if (digits.length >= 2 || (digits.length === 1 && n > 1)) {
      dayRef.current && dayRef.current.focus();
    }
  }

  function onDayChange(raw) {
    const digits = (raw || '').replace(/\D/g, '').slice(0, 2);
    setDayStr(digits);
    if (digits === '') {
      emitChange('day', null);
      return;
    }
    const n = parseInt(digits, 10);
    emitChange('day', n);
    if (digits.length >= 2 || (digits.length === 1 && n > 3)) {
      yearRef.current && yearRef.current.focus();
    }
  }

  function onYearChange(raw) {
    const digits = (raw || '').replace(/\D/g, '').slice(0, 4);
    setYearStr(digits);
    if (digits === '') {
      emitChange('year', null);
      return;
    }
    emitChange('year', parseInt(digits, 10));
  }

  // On blur, normalize the displayed string to the padded form so a saved
  // single-digit month visually shows as "06". Doesn't change the stored
  // value, just the local display string.
  function onMonthBlur() {
    if (v.month != null) setMonthStr(String(v.month).padStart(2, '0'));
  }
  function onDayBlur() {
    if (v.day != null) setDayStr(String(v.day).padStart(2, '0'));
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
          onChangeText={onMonthChange}
          onBlur={onMonthBlur}
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
          onChangeText={onDayChange}
          onBlur={onDayBlur}
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
          onChangeText={onYearChange}
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