import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { useTheme } from '../styles/theme';
import { ArchiveIcon, ChatIcon } from './Icons';

const THRESHOLD = 60;

// Cross-platform confirm. Alert.alert is iOS/Android only — silently no-ops
// on web. We swap to window.confirm there so the destructive action can
// actually fire when the user taps Archive on a swiped card.
function confirmAction(title, message, onConfirm, onCancel) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(message || title)) onConfirm();
      else if (onCancel) onCancel();
    } else {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: 'Archive', style: 'destructive', onPress: onConfirm },
  ]);
}

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
        if (v < -120) v = -120 + (v + 120) * 0.2;
        if (v > 120) v = 120 + (v - 120) * 0.2;
        tx.setValue(v);
      },
      onPanResponderRelease: (_, g) => {
        lock.current = null;
        if (g.dx < -THRESHOLD) {
          Animated.spring(tx, { toValue: -80, useNativeDriver: true, bounciness: 0 }).start();
        } else if (g.dx > THRESHOLD && onLog) {
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
    confirmAction(
      'Archive contact',
      'Archive ' + contactName + '?',
      () => {
        onDelete();
        reset();
      },
      reset,
    );
  };

  // Long-press fallback: works everywhere, especially useful on web where
  // PanResponder swipe gestures with a mouse can be flaky. 600ms feels
  // intentional but not annoying.
  const handleLongPress = () => {
    confirmAction(
      'Archive contact',
      'Archive ' + contactName + '?',
      () => {
        onDelete();
      },
    );
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
        {/* Pressable wrapper enables long-press archive. delayLongPress at
            600ms is the platform default and feels intentional. We don't
            register an onPress so the underlying ContactRowFull TouchableOpacity
            still handles regular taps for navigation. */}
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={600}
          // Don't capture the regular press — let it bubble to the row's
          // own TouchableOpacity below.
          android_ripple={null}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}