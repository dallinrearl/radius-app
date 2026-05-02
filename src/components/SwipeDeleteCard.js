import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder, Alert } from 'react-native';
import { useTheme } from '../styles/theme';
import { ArchiveIcon, ChatIcon } from './Icons';

const THRESHOLD = 80;

export default function SwipeDeleteCard({ children, onDelete, onLog, contactName }) {
  const { theme } = useTheme();
  const tx = useRef(new Animated.Value(0)).current;
  const lock = useRef(null);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (lock.current === 'h') return true;
        return Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4;
      },
      onPanResponderGrant: () => {
        lock.current = 'h';
      },
      onPanResponderMove: (_, g) => {
        let v = g.dx;
        // Limit overshoot
        if (v < -120) v = -120 + (v + 120) * 0.2;
        if (v > 120) v = 120 + (v - 120) * 0.2;
        tx.setValue(v);
      },
      onPanResponderRelease: (_, g) => {
        lock.current = null;
        if (g.dx < -THRESHOLD) {
          // Reveal archive button (snap left)
          Animated.spring(tx, { toValue: -80, useNativeDriver: true, bounciness: 0 }).start();
        } else if (g.dx > THRESHOLD && onLog) {
          // Trigger log action
          Animated.timing(tx, { toValue: 0, duration: 180, useNativeDriver: true }).start();
          onLog();
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        lock.current = null;
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const reset = () => Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();

  const handleArchive = () => {
    Alert.alert('Archive contact', 'Archive ' + contactName + '?', [
      { text: 'Cancel', style: 'cancel', onPress: reset },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          onDelete();
          reset();
        },
      },
    ]);
  };

  return (
    <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, marginBottom: 6 }}>
      {/* Archive (right side) */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 80,
          backgroundColor: theme.warn,
          alignItems: 'center',
          justifyContent: 'center',
          borderTopRightRadius: 14,
          borderBottomRightRadius: 14,
        }}
      >
        <TouchableOpacity onPress={handleArchive} activeOpacity={0.8} style={{ alignItems: 'center', gap: 4 }}>
          <ArchiveIcon size={18} color="#fff" strokeWidth={2} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Archive</Text>
        </TouchableOpacity>
      </View>
      {/* Log (left side) */}
      {onLog && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: 80,
            backgroundColor: theme.ac,
            alignItems: 'center',
            justifyContent: 'center',
            borderTopLeftRadius: 14,
            borderBottomLeftRadius: 14,
          }}
        >
          <ChatIcon size={18} color="#fff" strokeWidth={2} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 4 }}>Log</Text>
        </View>
      )}

      <Animated.View
        {...pan.panHandlers}
        style={{
          backgroundColor: theme.bg,
          transform: [{ translateX: tx }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
