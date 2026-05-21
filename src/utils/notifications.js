// Push notification setup. Handles permission request, Expo push token
// retrieval, and syncing the token + the device timezone to the user's
// Supabase profile so the server-side cron can deliver to them.
//
// Tokens only work on real devices (Apple/Google won't issue them to
// simulators). We detect that case and skip silently rather than throwing.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Foreground notification behavior. When the app is open and a push
// arrives, by default it would be silent. This makes it surface as a
// banner + sound the same way it would when the app is closed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Best-effort device timezone in IANA form (e.g. "America/Denver").
// Falls back to UTC if the platform can't resolve it.
function getDeviceTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'UTC';
  } catch (_) {
    return 'UTC';
  }
}

// Returns { token, status } where status is one of:
//   'ok' - token retrieved and stored
//   'denied' - user denied notification permission
//   'unsupported' - simulator or unsupported device (no token possible)
//   'error' - other failure (network, supabase, etc.)
//
// Safe to call repeatedly. If permission was previously granted, this
// just refreshes the stored token.
export async function registerForPushNotifications() {
  try {
    // Web push needs a VAPID key we don't configure (we only target iOS
    // and Android). Treat web like a non-device dev environment so the
    // toggle works for testing without attempting real web push.
    if (!Device.isDevice || Platform.OS === 'web') {
      // In development on web or a simulator, let the user enable
      // notifications anyway so the UI can be tested. Real device
      // builds will get a real Expo push token; this dev placeholder
      // is overwritten the next time registration runs on a device.
      const isDev =
        typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
      if (isDev) {
        const { data: userData, error: authErr } = await supabase.auth.getUser();
        if (authErr) {
          return { token: null, status: 'error', detail: 'auth: ' + authErr.message };
        }
        const userId = userData?.user?.id;
        if (!userId) {
          return { token: null, status: 'error', detail: 'no user id' };
        }
        const { error: updErr } = await supabase
          .from('profiles')
          .update({
            expo_push_token: 'dev-no-device',
            timezone: getDeviceTimezone(),
          })
          .eq('id', userId);
        if (updErr) {
          return { token: null, status: 'error', detail: 'update: ' + updErr.message };
        }
        return { token: 'dev-no-device', status: 'ok' };
      }
      return { token: null, status: 'unsupported' };
    }

    // Android requires us to set up a notification channel before
    // anything will display. iOS ignores this call.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7B5EEA',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { token: null, status: 'denied' };
    }

    // projectId comes from app.json / app.config.js under "extra.eas.projectId"
    // (it's the EAS project ID, NOT the Supabase project ID). Once you run
    // `eas init` for the first time, EAS adds it for you. If it isn't set,
    // Expo will try to infer it from the slug.
    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp?.data;
    if (!token) {
      return { token: null, status: 'error' };
    }

    const tz = getDeviceTimezone();

    // Write to the current user's profile row.
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return { token, status: 'error' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        expo_push_token: token,
        timezone: tz,
      })
      .eq('id', userId);

    if (error) {
      console.warn('Saving push token failed:', error.message);
      return { token, status: 'error' };
    }

    return { token, status: 'ok' };
  } catch (e) {
    console.warn('registerForPushNotifications failed:', e?.message);
    return { token: null, status: 'error', detail: 'threw: ' + (e?.message || String(e)) };
  }
}

// Clears the push token from the profile. Call on sign out so other
// devices the user signs in on can replace it (we only store one token
// per user for now).
export async function clearPushNotificationToken() {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .eq('id', userId);
  } catch (e) {
    console.warn('clearPushNotificationToken failed:', e?.message);
  }
}