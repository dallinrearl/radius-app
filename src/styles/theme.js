import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DARK_THEME = {
  bg: '#111923',
  bg2: '#1a2736',
  bg3: '#16202E',
  bg4: '#1F2D40',
  bg5: '#1A2536',
  brd: '#243549',
  brd2: '#344d66',
  t1: '#FFFFFF',
  t2: '#E8EFF5',
  t3: '#C8DCE8',
  t4: '#9EB5C8',
  t5: '#6F89A0',
  t6: '#4A6378',
  ac: '#7AA8D8',
  ac2: '#5A8AC0',
  red: '#E05050',
  warn: '#dbb940',
  purp: '#7B5EEA',
  info: '#7AA8D8',
  pink: '#E060A0',
  purp2: '#9DAFD8',
  gold: '#dbb940',
  goldDim: '#A88E2E',
  bgAc: '#1A2A40',
  brdAc: '#2D4666',
  bgRed: '#2A1820',
  brdRed: '#4A2230',
  brdPurp: '#2E2A50',
  brdWarn: '#3A331A',
  bgWarn: '#1F1B10',
  bgWarn2: '#1F1B10',
  brdWarn2: '#3A331A',
  bgGold: '#2A2418',
  brdGold: '#dbb940',
  navBg: 'rgba(17,25,35,0.97)',
  fontDisplay: 'InstrumentSerif_400Regular',
  fontBody: 'DMSans_400Regular',
  fontBodyMed: 'DMSans_500Medium',
  fontBodySemi: 'DMSans_600SemiBold',
  fontBodyBold: 'DMSans_700Bold',
  saveGradient: ['#7AA8D8', '#5A8AC0'],
  isDark: true,
};

export const LIGHT_THEME = {
  bg: '#FFFFFF',
  bg2: '#F4F7FB',
  bg3: '#EBF1F7',
  bg4: '#DCE6F0',
  bg5: '#F0F4F8',
  brd: '#C8DCE8',
  brd2: '#A8C0D2',
  t1: '#111923',
  t2: '#1a2736',
  t3: '#344d66',
  t4: '#5A7088',
  t5: '#7E92A8',
  t6: '#A0B0C0',
  ac: '#344d66',
  ac2: '#1a2736',
  red: '#DC2626',
  warn: '#B8992E',
  purp: '#6D28D9',
  info: '#344d66',
  pink: '#DB2777',
  purp2: '#7C3AED',
  gold: '#B8992E',
  goldDim: '#9A7E22',
  bgAc: '#EBF1F7',
  brdAc: '#A8C0D2',
  bgRed: '#FEF2F2',
  brdRed: '#FECACA',
  brdPurp: '#DDD6FE',
  brdWarn: '#FDE68A',
  bgWarn: '#FEF8E0',
  bgWarn2: '#FEF3C7',
  brdWarn2: '#FDE68A',
  bgGold: '#FEF8E0',
  brdGold: '#E8D078',
  navBg: 'rgba(255,255,255,0.97)',
  fontDisplay: 'Newsreader_400Regular',
  fontBody: 'Karla_400Regular',
  fontBodyMed: 'Karla_500Medium',
  fontBodySemi: 'Karla_600SemiBold',
  fontBodyBold: 'Karla_700Bold',
  saveGradient: ['#344d66', '#1a2736'],
  isDark: false,
};

const ThemeContext = createContext({
  theme: DARK_THEME,
  themeName: 'dark',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('dark');

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