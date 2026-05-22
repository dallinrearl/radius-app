import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DARK_THEME = {
  bg: '#0B1121',
  bg2: '#111B2E',
  bg3: '#0E1525',
  bg4: '#162035',
  bg5: '#141C2E',
  brd: '#1A2838',
  brd2: '#1E2D42',
  t1: '#E8ECF4',
  t2: '#C5D0DC',
  t3: '#8AA8C0',
  t4: '#7B8BA5',
  t5: '#4A6080',
  t6: '#3D5470',
  ac: '#3B6EE6',
  ac2: '#2B5BC4',
  red: '#E05050',
  warn: '#FBBF24',
  purp: '#7B5EEA',
  info: '#48B8E0',
  pink: '#E060A0',
  purp2: '#7B8FD8',
  bgAc: '#0F1A2E',
  brdAc: '#1A3058',
  bgRed: '#2A1028',
  brdRed: '#3A1828',
  brdPurp: '#252A50',
  brdWarn: '#2A3A1A',
  bgWarn: '#1A2A10',
  bgWarn2: '#2A1A10',
  brdWarn2: '#5A3A20',
  navBg: 'rgba(11,17,33,0.97)',
  fontDisplay: 'Newsreader_400Regular',
  fontBody: 'Karla_400Regular',
  fontBodyMed: 'Karla_500Medium',
  fontBodySemi: 'Karla_600SemiBold',
  fontBodyBold: 'Karla_700Bold',
  saveGradient: ['#3B6EE6', '#2B5BC4'],
  isDark: true,
};

export const LIGHT_THEME = {
  bg: '#F6F7FA',
  bg2: '#FFFFFF',
  bg3: '#EEF0F4',
  bg4: '#E8EBF0',
  bg5: '#F0F2F6',
  brd: '#DDE1E8',
  brd2: '#D0D5DD',
  t1: '#111827',
  t2: '#374151',
  t3: '#4B5563',
  t4: '#6B7280',
  t5: '#9CA3AF',
  t6: '#B0B8C4',
  ac: '#1B3A6B',
  ac2: '#15305A',
  red: '#DC2626',
  warn: '#D97706',
  purp: '#6D28D9',
  info: '#2563EB',
  pink: '#DB2777',
  purp2: '#7C3AED',
  bgAc: '#EBF0FA',
  brdAc: '#B8CCEB',
  bgRed: '#FEF2F2',
  brdRed: '#FECACA',
  brdPurp: '#DDD6FE',
  brdWarn: '#D5DCC8',
  bgWarn: '#F0F4E4',
  bgWarn2: '#FEF3C7',
  brdWarn2: '#FDE68A',
  navBg: 'rgba(246,247,250,0.97)',
  fontDisplay: 'Newsreader_400Regular',
  fontBody: 'Karla_400Regular',
  fontBodyMed: 'Karla_500Medium',
  fontBodySemi: 'Karla_600SemiBold',
  fontBodyBold: 'Karla_700Bold',
  saveGradient: ['#1B3A6B', '#15305A'],
  isDark: false,
};

const ThemeContext = createContext({
  theme: DARK_THEME,
  themeName: 'dark',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('light');

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem('crm-theme');
        if (t === 'light' || t === 'dark') setThemeName(t);
      } catch (_) {}
    })();
  }, []);

  const toggleTheme = async () => {
    const next = themeName === 'dark' ? 'light' : 'dark';
    setThemeName(next);
    try {
      await AsyncStorage.setItem('crm-theme', next);
    } catch (_) {}
  };

  const theme = themeName === 'dark' ? DARK_THEME : LIGHT_THEME;

  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
