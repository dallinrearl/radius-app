import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import {
  BackButton,
  StyledInput,
  PrimaryButton,
} from '../components/Common';
import {
  ChevronRight,
  TrashIcon,
  PenIcon,
  XIcon,
  MailIcon,
} from '../components/Icons';

// Mailing Lists settings screen.
//
// Shows the user's lists. Each row: name, contact count, tap to drill into
// the list detail view. Inline edit by tapping the pen icon. Inline delete
// with confirmation.

export default function MailingListsScreen({
  mailingLists,
  contacts,
  onCreateList,
  onRenameList,
  onDeleteList,
  onPickList,
  onBack,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  function countOnList(listId) {
    return contacts.filter(
      (c) => !c.archived && Array.isArray(c.mailingLists) && c.mailingLists.includes(listId),
    ).length;
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onCreateList(trimmed);
    setNewName('');
    setAdding(false);
  }

  function startEdit(list) {
    setEditingId(list.id);
    setEditingName(list.name);
  }

  async function commitEdit() {
    const trimmed = editingName.trim();
    if (trimmed) {
      await onRenameList(editingId, trimmed);
    }
    setEditingId(null);
    setEditingName('');
  }

  function confirmDelete(list) {
    const count = countOnList(list.id);
    const msg =
      count > 0
        ? `Delete "${list.name}"? The list will be removed from ${count} contact${count === 1 ? '' : 's'}.`
        : `Delete "${list.name}"?`;
    Alert.alert('Delete list', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteList(list.id) },
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
            marginBottom: 6,
            fontFamily: theme.fontDisplay,
          }}
        >
          Mailing Lists
        </Text>
        <Text style={{ fontSize: 12, color: theme.t5, marginBottom: 20, lineHeight: 17 }}>
          Group contacts together for mailing labels, holiday cards, or any list you want to
          export later.
        </Text>

        {mailingLists.length === 0 && !adding && (
          <View
            style={{
              padding: 20,
              borderRadius: 14,
              backgroundColor: theme.bg2,
              borderWidth: 1,
              borderColor: theme.brd,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <MailIcon size={28} color={theme.t5} />
            <Text style={{ fontSize: 13, color: theme.t4, marginTop: 8 }}>
              No mailing lists yet.
            </Text>
          </View>
        )}

        {mailingLists.map((list) => {
          const count = countOnList(list.id);
          const isEditing = editingId === list.id;
          return (
            <View
              key={list.id}
              style={{
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: theme.brd,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {isEditing ? (
                <>
                  <StyledInput
                    value={editingName}
                    onChangeText={setEditingName}
                    autoFocus
                    onSubmitEditing={commitEdit}
                    style={{ flex: 1 }}
                  />
                  <TouchableOpacity
                    onPress={commitEdit}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: theme.ac,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingId(null);
                      setEditingName('');
                    }}
                    style={{ padding: 6 }}
                  >
                    <XIcon size={18} color={theme.t4} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => onPickList(list)}
                    activeOpacity={0.7}
                    style={{ flex: 1 }}
                  >
                    <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '600' }}>
                      {list.name}
                    </Text>
                    <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
                      {count} {count === 1 ? 'contact' : 'contacts'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => startEdit(list)} style={{ padding: 6 }}>
                    <PenIcon size={14} color={theme.t4} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(list)} style={{ padding: 6 }}>
                    <TrashIcon size={14} color={theme.red} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onPickList(list)} style={{ padding: 4 }}>
                    <ChevronRight size={16} color={theme.t5} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}

        {adding ? (
          <View
            style={{
              backgroundColor: theme.bg2,
              borderWidth: 1,
              borderColor: theme.brdAc,
              borderRadius: 14,
              padding: 12,
              marginTop: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <StyledInput
              value={newName}
              onChangeText={setNewName}
              placeholder="List name (e.g. Wedding Invites)"
              autoFocus
              onSubmitEditing={handleCreate}
              style={{ flex: 1 }}
            />
            <TouchableOpacity
              onPress={handleCreate}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: theme.ac,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setAdding(false);
                setNewName('');
              }}
              style={{ padding: 6 }}
            >
              <XIcon size={18} color={theme.t4} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setAdding(true)}
            style={{
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.brd2,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ color: theme.ac, fontSize: 13, fontWeight: '500' }}>
              + New Mailing List
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}