import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { ChevronRight, XIcon } from './Icons';

// TrialBanner — thin strip across the top of the app for trial users.
// Shows days remaining + tap-to-manage CTA. Color shifts more urgent as
// trial gets close to expiring (yellow ≤3 days, red ≤1 day).
//
// Renders nothing for non-trial users, so it's safe to mount globally.
export default function TrialBanner({
  trialActive,
  trialDaysLeft,
  onManage,
  onDismiss,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!trialActive) return null;

  // Color tier based on urgency
  const isUrgent = trialDaysLeft != null && trialDaysLeft <= 1;
  const isWarning = trialDaysLeft != null && trialDaysLeft <= 3 && !isUrgent;

  const bg = isUrgent ? theme.bgRed : isWarning ? theme.bgWarn || (theme.warn + '22') : theme.bgAc;
  const fg = isUrgent ? theme.red : isWarning ? theme.warn : theme.ac;
  const border = isUrgent ? theme.brdRed : isWarning ? theme.warn + '50' : theme.brdAc;

  // Build the message
  let message;
  if (trialDaysLeft == null) {
    message = 'Trial active';
  } else if (trialDaysLeft <= 0) {
    message = 'Trial ends today';
  } else if (trialDaysLeft === 1) {
    message = '1 day left in trial';
  } else {
    message = trialDaysLeft + ' days left in trial';
  }

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: bg,
        borderBottomWidth: 1,
        borderBottomColor: border,
      }}
    >
      <TouchableOpacity
        onPress={onManage}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 9,
          gap: 8,
        }}
      >
        <View
          style={{
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: fg,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>
            PRO TRIAL
          </Text>
        </View>
        <Text style={{ flex: 1, color: fg, fontSize: 12, fontWeight: '600' }}>
          {message}
        </Text>
        <Text style={{ color: fg, fontSize: 11, fontWeight: '600' }}>Manage</Text>
        <ChevronRight size={12} color={fg} />
      </TouchableOpacity>
    </View>
  );
}