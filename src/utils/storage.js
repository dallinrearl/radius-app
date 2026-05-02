import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async get(key) {
    try {
      const v = await AsyncStorage.getItem(key);
      return v == null ? null : { value: v };
    } catch (_) {
      return null;
    }
  },
  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  },
  async delete(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  },
};
