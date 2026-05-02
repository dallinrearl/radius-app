import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../styles/theme';
import { CITIES } from '../constants';
import { StyledInput } from './Common';

export function CityInput({ value, onChange }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || '');

  useEffect(() => {
    setQ(value || '');
  }, [value]);

  const filtered =
    q.length >= 2 ? CITIES.filter((c) => c.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  return (
    <View>
      <StyledInput
        value={q}
        placeholder="e.g. Dallas, TX"
        onChangeText={(v) => {
          setQ(v);
          setOpen(true);
          onChange(v);
        }}
        onFocus={() => q.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <View
          style={{
            backgroundColor: theme.bg4,
            borderWidth: 1,
            borderColor: theme.brd2,
            borderRadius: 10,
            marginTop: 4,
            maxHeight: 200,
          }}
        >
          {filtered.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => {
                setQ(c);
                onChange(c);
                setOpen(false);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme.brd,
              }}
            >
              <Text style={{ fontSize: 13, color: theme.t2 }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function CompanyInput({ value, onChange, contacts }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || '');

  useEffect(() => {
    setQ(value || '');
  }, [value]);

  const companies =
    q.length >= 1
      ? [
          ...new Set(
            (contacts || [])
              .map((c) => (c.company || '').trim())
              .filter((c) => c && c.toLowerCase().includes(q.toLowerCase())),
          ),
        ].slice(0, 6)
      : [];

  return (
    <View>
      <StyledInput
        value={q}
        placeholder="Company name"
        onChangeText={(v) => {
          setQ(v);
          setOpen(true);
          onChange(v);
        }}
        onFocus={() => q.length >= 1 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && companies.length > 0 && (
        <View
          style={{
            backgroundColor: theme.bg4,
            borderWidth: 1,
            borderColor: theme.brd2,
            borderRadius: 10,
            marginTop: 4,
            maxHeight: 200,
          }}
        >
          {companies.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => {
                setQ(c);
                onChange(c);
                setOpen(false);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme.brd,
              }}
            >
              <Text style={{ fontSize: 13, color: theme.t2 }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
