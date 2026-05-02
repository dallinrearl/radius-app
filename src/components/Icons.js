import React from 'react';
import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg';

const I = ({ size = 20, color = '#fff', strokeWidth = 1.8, children }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
    {children}
  </Svg>
);

export const UserIcon = (p) => (
  <I {...p}>
    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </I>
);

export const CalendarIcon = (p) => (
  <I {...p}>
    <Rect x="3" y="4" width="18" height="18" rx="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </I>
);

export const ChartIcon = (p) => (
  <I {...p}>
    <Path d="M18 20V10" />
    <Path d="M12 20V4" />
    <Path d="M6 20v-6" />
  </I>
);

export const SettingsIcon = (p) => (
  <I {...p}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </I>
);

export const BellIcon = (p) => (
  <I {...p}>
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </I>
);

export const SearchIcon = (p) => (
  <I {...p}>
    <Circle cx="11" cy="11" r="8" />
    <Line x1="21" y1="21" x2="16.65" y2="16.65" />
  </I>
);

export const PhoneIcon = (p) => (
  <I {...p}>
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </I>
);

export const MailIcon = (p) => (
  <I {...p}>
    <Rect x="2" y="4" width="20" height="16" rx="2" />
    <Path d="M22 7l-10 7L2 7" />
  </I>
);

export const MicIcon = (p) => (
  <I {...p}>
    <Path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Line x1="12" y1="19" x2="12" y2="23" />
    <Line x1="8" y1="23" x2="16" y2="23" />
  </I>
);

export const CameraIcon = (p) => (
  <I {...p}>
    <Rect x="2" y="4" width="20" height="16" rx="3" />
    <Circle cx="12" cy="12" r="3" />
    <Path d="M2 8h2M20 8h2" />
  </I>
);

export const DownloadIcon = (p) => (
  <I {...p}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Polyline points="7 10 12 15 17 10" />
    <Line x1="12" y1="15" x2="12" y2="3" />
  </I>
);

export const UploadIcon = (p) => (
  <I {...p}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Polyline points="17 8 12 3 7 8" />
    <Line x1="12" y1="3" x2="12" y2="15" />
  </I>
);

export const ChevronDown = (p) => (
  <I {...p} strokeWidth={2.5}>
    <Polyline points="6 9 12 15 18 9" />
  </I>
);

export const ChevronRight = (p) => (
  <I {...p} strokeWidth={2}>
    <Polyline points="9 18 15 12 9 6" />
  </I>
);

export const ChevronLeft = (p) => (
  <I {...p} strokeWidth={2}>
    <Polyline points="15 18 9 12 15 6" />
  </I>
);

export const PlusIcon = (p) => (
  <I {...p} strokeWidth={2.5}>
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </I>
);

export const XIcon = (p) => (
  <I {...p} strokeWidth={2}>
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </I>
);

export const ArchiveIcon = (p) => (
  <I {...p}>
    <Polyline points="21 8 21 21 3 21 3 8" />
    <Rect x="1" y="3" width="22" height="5" />
    <Line x1="10" y1="12" x2="14" y2="12" />
  </I>
);

export const ChatIcon = (p) => (
  <I {...p}>
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </I>
);

export const QrIcon = (p) => (
  <I {...p}>
    <Rect x="3" y="3" width="7" height="7" />
    <Rect x="14" y="3" width="7" height="7" />
    <Rect x="3" y="14" width="7" height="7" />
    <Path d="M14 14h7v7h-7z" />
  </I>
);

export const LockIcon = (p) => (
  <I {...p}>
    <Rect x="3" y="11" width="18" height="11" rx="2" />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </I>
);

export const HeartIcon = (p) => (
  <I {...p}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
  </I>
);

export const TagIcon = (p) => (
  <I {...p}>
    <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <Line x1="7" y1="7" x2="7.01" y2="7" />
  </I>
);

export const RefreshIcon = (p) => (
  <I {...p}>
    <Path d="M1 4v6h6" />
    <Path d="M23 20v-6h-6" />
    <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
  </I>
);

export const FilterIcon = (p) => (
  <I {...p} strokeWidth={2}>
    <Line x1="4" y1="6" x2="20" y2="6" />
    <Line x1="4" y1="12" x2="20" y2="12" />
    <Line x1="4" y1="18" x2="20" y2="18" />
  </I>
);

export const FileIcon = (p) => (
  <I {...p}>
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Polyline points="14 2 14 8 20 8" />
  </I>
);

export const StarIcon = (p) => (
  <I {...p}>
    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </I>
);

export const PenIcon = (p) => (
  <I {...p}>
    <Path d="M12 20h9" />
    <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </I>
);

export const UsersIcon = (p) => (
  <I {...p}>
    <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="8.5" cy="7" r="4" />
    <Path d="M20 8v6M23 11h-6" />
  </I>
);

export const CardIcon = (p) => (
  <I {...p}>
    <Rect x="2" y="3" width="20" height="18" rx="3" />
    <Line x1="2" y1="8" x2="22" y2="8" />
    <Line x1="7" y1="13" x2="17" y2="13" />
    <Line x1="7" y1="17" x2="13" y2="17" />
  </I>
);

export const SunIcon = (p) => (
  <I {...p}>
    <Circle cx="12" cy="12" r="5" />
    <Line x1="12" y1="1" x2="12" y2="3" />
    <Line x1="12" y1="21" x2="12" y2="23" />
    <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <Line x1="1" y1="12" x2="3" y2="12" />
    <Line x1="21" y1="12" x2="23" y2="12" />
    <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </I>
);

export const MoonIcon = (p) => (
  <I {...p}>
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </I>
);

export const TrashIcon = (p) => (
  <I {...p}>
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <Path d="M10 11v6M14 11v6" />
  </I>
);
