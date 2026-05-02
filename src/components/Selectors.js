import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../styles/theme';
import { getTagColor } from '../utils/helpers';
import { StyledInput } from './Common';

export function TagSelector({ tags, allTags, onToggle, onAddTag }) {
  const { theme } = useTheme();
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');

  function doAdd() {
    if (!newTag.trim()) return;
    if (onAddTag) onAddTag(newTag.trim());
    onToggle(newTag.trim());
    setNewTag('');
    setAdding(false);
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {allTags.map((t) => {
          const on = tags.includes(t);
          const c = getTagColor(t);
          return (
            <TouchableOpacity
              key={t}
              onPress={() => onToggle(t)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                backgroundColor: on ? c + '22' : theme.bg2,
                borderColor: on ? c : theme.brd2,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: on ? c : theme.t5,
                  fontFamily: theme.fontBodyMed,
                }}
              >
                {t}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => setAdding(true)}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.brd2,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '500', color: theme.t4 }}>+</Text>
        </TouchableOpacity>
      </View>
      {adding && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <StyledInput
            value={newTag}
            onChangeText={setNewTag}
            placeholder="New tag name"
            style={{ flex: 1 }}
            autoFocus
            onSubmitEditing={doAdd}
          />
          <TouchableOpacity
            onPress={doAdd}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: theme.ac,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setAdding(false);
              setNewTag('');
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: theme.bg2,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.brd2,
            }}
          >
            <Text style={{ color: theme.t4, fontSize: 12 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function InterestSelector({ interests, allInterests, onToggle, onAddInterest }) {
  const { theme } = useTheme();
  const [adding, setAdding] = useState(false);
  const [newInt, setNewInt] = useState('');

  function doAdd() {
    if (!newInt.trim()) return;
    if (onAddInterest) onAddInterest(newInt.trim());
    onToggle(newInt.trim());
    setNewInt('');
    setAdding(false);
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {allInterests.map((t) => {
          const on = interests.includes(t);
          return (
            <TouchableOpacity
              key={t}
              onPress={() => onToggle(t)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                backgroundColor: on ? '#7B5EEA22' : theme.bg2,
                borderColor: on ? theme.purp : theme.brd2,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color: on ? theme.purp : theme.t5,
                  fontFamily: theme.fontBodyMed,
                }}
              >
                {t}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => setAdding(true)}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.brd2,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.t4 }}>+</Text>
        </TouchableOpacity>
      </View>
      {adding && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <StyledInput
            value={newInt}
            onChangeText={setNewInt}
            placeholder="New interest"
            style={{ flex: 1 }}
            autoFocus
            onSubmitEditing={doAdd}
          />
          <TouchableOpacity
            onPress={doAdd}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: theme.ac,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setAdding(false);
              setNewInt('');
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: theme.bg2,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.brd2,
            }}
          >
            <Text style={{ color: theme.t4, fontSize: 12 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
