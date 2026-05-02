import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { UserIcon, CalendarIcon, ChartIcon, SettingsIcon, PlusIcon } from './Icons';

export default function NavBar({ tab, setTab, onAddPress, overdueN }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const items = [
    { key: 'contacts', label: 'Contacts', Icon: UserIcon },
    { key: 'nextup', label: 'Next Up', Icon: CalendarIcon, badge: overdueN },
  ];
  const itemsRight = [
    { key: 'stats', label: 'Stats', Icon: ChartIcon },
    { key: 'settings', label: 'Settings', Icon: SettingsIcon },
  ];

  const renderTab = (item) => {
    const active = tab === item.key;
    const color = active ? theme.ac : theme.t6;
    return (
      <TouchableOpacity
        key={item.key}
        onPress={() => setTab(item.key)}
        activeOpacity={0.7}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          height: '100%',
        }}
      >
        <View style={{ position: 'relative' }}>
          <item.Icon size={20} color={color} />
          {item.badge > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -8,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: theme.red,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{item.badge}</Text>
            </View>
          )}
        </View>
        <Text
          style={{
            fontSize: 9,
            fontWeight: '600',
            color,
            marginTop: 3,
            fontFamily: theme.fontBodySemi,
          }}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 72 + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: theme.navBg,
        borderTopWidth: 1,
        borderTopColor: theme.brd,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 100,
      }}
    >
      {items.map(renderTab)}
      {/* Center add button */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TouchableOpacity
          onPress={onAddPress}
          activeOpacity={0.85}
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: theme.ac,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateY: -12 }],
            shadowColor: theme.ac,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <PlusIcon size={26} color={theme.bg} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      {itemsRight.map(renderTab)}
    </View>
  );
}
