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
import { Avatar, BackButton } from '../components/Common';
import {
  ChevronDown,
  TrashIcon,
  DownloadIcon,
  XIcon,
} from '../components/Icons';

// Mailing List Detail screen.
//
// Shows:
//   - List name (with contact count)
//   - Each contact on the list, with their selected address shown.
//     Tap to expand and change address selection if they have multiple.
//   - Remove from list (X icon)
//   - Export CSV button (placeholder for Chunk 3)
//
// `mailingList`        - the list object { id, name, addressOverrides, ... }
// `contacts`           - all contacts (filtered to active + on this list)
// `onSetAddressOverride(listId, contactId, addressIndex)`
// `onRemoveFromList(contact)`  - convenience wrapper around toggleContactOnList
// `onPickContact(contact)`     - tap into the contact's detail page
// `onExport(list, contactsOnList)` - placeholder, wired in Chunk 3
// `onBack`             - back to mailing lists screen

export default function MailingListDetailScreen({
  mailingList,
  contacts,
  onSetAddressOverride,
  onRemoveFromList,
  onPickContact,
  onExport,
  onBack,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState(null);

  if (!mailingList) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 20, paddingTop: insets.top + 12 }}>
        <BackButton onPress={onBack} />
        <Text style={{ color: theme.t4, fontSize: 14, marginTop: 12 }}>List not found.</Text>
      </View>
    );
  }

  const onList = contacts.filter(
    (c) => !c.archived && Array.isArray(c.mailingLists) && c.mailingLists.includes(mailingList.id),
  );

  const overrides = mailingList.addressOverrides || {};

  function chosenAddressIndex(contact) {
    const override = overrides[contact.id];
    if (typeof override === 'number') return override;
    return 0;
  }

  function chosenAddress(contact) {
    const list = Array.isArray(contact.addresses) ? contact.addresses : [];
    if (list.length === 0) return null;
    const idx = chosenAddressIndex(contact);
    return list[idx] || list[0];
  }

  function confirmRemove(contact) {
    Alert.alert(
      'Remove from list',
      `Remove ${contact.name || 'this contact'} from "${mailingList.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveFromList(contact) },
      ],
    );
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
          {mailingList.name}
        </Text>
        <Text style={{ fontSize: 12, color: theme.t5, marginBottom: 18 }}>
          {onList.length} {onList.length === 1 ? 'contact' : 'contacts'}
        </Text>

        {/* Export button */}
        <TouchableOpacity
          onPress={() => onExport && onExport(mailingList, onList)}
          disabled={onList.length === 0}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.brdAc,
            backgroundColor: theme.bgAc,
            marginBottom: 18,
            opacity: onList.length === 0 ? 0.4 : 1,
          }}
        >
          <DownloadIcon size={16} color={theme.ac} strokeWidth={2} />
          <Text style={{ color: theme.ac, fontSize: 13, fontWeight: '600' }}>
            Export as CSV
          </Text>
        </TouchableOpacity>

        {onList.length === 0 && (
          <View
            style={{
              padding: 20,
              borderRadius: 14,
              backgroundColor: theme.bg2,
              borderWidth: 1,
              borderColor: theme.brd,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, color: theme.t4, textAlign: 'center' }}>
              No contacts on this list yet.
            </Text>
            <Text style={{ fontSize: 11, color: theme.t5, marginTop: 6, textAlign: 'center' }}>
              Add a contact to this list from their contact card.
            </Text>
          </View>
        )}

        {onList.map((contact) => {
          const addr = chosenAddress(contact);
          const expanded = expandedId === contact.id;
          const recipient = (contact.recipientName && contact.recipientName.trim()) || contact.name;
          const addresses = Array.isArray(contact.addresses) ? contact.addresses : [];
          const hasMultiple = addresses.length > 1;
          const noAddress = addresses.length === 0;

          return (
            <View
              key={contact.id}
              style={{
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: noAddress ? theme.brdWarn2 : theme.brd,
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
              }}
            >
              {/* Header row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar contact={contact} size={36} />
                <TouchableOpacity
                  onPress={() => onPickContact && onPickContact(contact)}
                  activeOpacity={0.7}
                  style={{ flex: 1 }}
                >
                  <Text style={{ color: theme.t1, fontSize: 13, fontWeight: '600' }}>
                    {recipient}
                  </Text>
                  {recipient !== contact.name && (
                    <Text style={{ color: theme.t5, fontSize: 11 }}>
                      ({contact.name})
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmRemove(contact)} style={{ padding: 6 }}>
                  <TrashIcon size={14} color={theme.red} />
                </TouchableOpacity>
              </View>

              {/* Address summary */}
              <View style={{ marginTop: 10, paddingLeft: 46 }}>
                {noAddress ? (
                  <Text style={{ fontSize: 11, color: theme.warn, fontStyle: 'italic' }}>
                    No address on file. Add one in this contact's card.
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={() => hasMultiple && setExpandedId(expanded ? null : contact.id)}
                    activeOpacity={hasMultiple ? 0.7 : 1}
                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: theme.t5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 }}>
                        {addr.label || 'Address'}
                        {hasMultiple ? ` · ${addresses.length} on file` : ''}
                      </Text>
                      {formatAddressLines(addr).map((line, i) => (
                        <Text key={i} style={{ fontSize: 12, color: theme.t3, lineHeight: 17 }}>
                          {line}
                        </Text>
                      ))}
                    </View>
                    {hasMultiple && (
                      <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }], paddingTop: 2 }}>
                        <ChevronDown size={14} color={theme.t5} />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Expanded: address picker */}
              {expanded && hasMultiple && (
                <View style={{ marginTop: 10, paddingLeft: 46, gap: 6 }}>
                  {addresses.map((a, i) => {
                    const selected = i === chosenAddressIndex(contact);
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          onSetAddressOverride(mailingList.id, contact.id, i);
                          setExpandedId(null);
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          backgroundColor: selected ? theme.bgAc : theme.bg3,
                          borderColor: selected ? theme.ac : theme.brd2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            color: selected ? theme.ac : theme.t5,
                            fontWeight: '700',
                            letterSpacing: 0.4,
                            textTransform: 'uppercase',
                            marginBottom: 2,
                          }}
                        >
                          {a.label || 'Address'}
                        </Text>
                        {formatAddressLines(a).map((line, idx) => (
                          <Text
                            key={idx}
                            style={{
                              fontSize: 12,
                              color: selected ? theme.t2 : theme.t4,
                              lineHeight: 17,
                            }}
                          >
                            {line}
                          </Text>
                        ))}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Format an address into displayable lines, skipping empties.
function formatAddressLines(addr) {
  if (!addr) return [];
  const cityState = [addr.city, addr.state].filter(Boolean).join(', ');
  const cityStateZip =
    cityState + (addr.zip ? (cityState ? ' ' : '') + addr.zip : '');
  return [addr.line1, addr.line2, cityStateZip, addr.country].filter(
    (l) => l && l.trim(),
  );
}