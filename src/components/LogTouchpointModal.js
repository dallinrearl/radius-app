import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../styles/theme';
import { TOUCH_TYPES } from '../constants';
import { isoToday } from '../utils/helpers';
import { Avatar } from './Common';

export default function LogTouchpointModal({ visible, contact, onClose, onSave }) {
  const { theme } = useTheme();
  const [type, setType] = useState('call');
  const [text, setText] = useState('');

  function reset() {
    setType('call');
    setText('');
  }

  function save() {
    const entry = {
      id: String(Date.now()),
      date: isoToday(),
      text: text.trim() || `[${type}]`,
      type,
    };
    onSave(entry);
    reset();
  }

  if (!contact) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: theme.bg2,
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.brd,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Avatar contact={contact} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: theme.t1, fontWeight: '600' }}>
                Log touch with {contact.name}
              </Text>
              <Text style={{ fontSize: 11, color: theme.t5 }}>{isoToday()}</Text>
            </View>
          </View>

          <Text style={{ color: theme.t4, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
            TYPE
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
            {TOUCH_TYPES.map((tt) => {
              const on = type === tt.v;
              return (
                <TouchableOpacity
                  key={tt.v}
                  onPress={() => setType(tt.v)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    borderWidth: 1,
                    backgroundColor: on ? tt.c + '22' : theme.bg3,
                    borderColor: on ? tt.c : theme.brd,
                  }}
                >
                  <Text style={{ color: on ? tt.c : theme.t5, fontSize: 11, fontWeight: '600' }}>
                    {tt.l}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ color: theme.t4, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
            NOTE (OPTIONAL)
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What did you discuss?"
            placeholderTextColor={theme.t6}
            multiline
            style={{
              backgroundColor: theme.bg3,
              borderWidth: 1,
              borderColor: theme.brd2,
              borderRadius: 12,
              color: theme.t1,
              padding: 12,
              fontSize: 13,
              minHeight: 80,
              textAlignVertical: 'top',
              marginBottom: 14,
              fontFamily: theme.fontBody,
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                reset();
                onClose();
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.brd2,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.t4, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: theme.ac,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
