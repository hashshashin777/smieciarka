import { Platform } from 'react-native';
import { CategoryMeta } from '../types';

export const CATEGORIES: CategoryMeta[] = [
  { id: 'meble', label: 'Meble', icon: 'chair-rolling', color: '#8B5CF6' },
  { id: 'elektronika', label: 'Elektronika', icon: 'laptop', color: '#3B82F6' },
  { id: 'agd', label: 'AGD', icon: 'coffee', color: '#EC4899' },
  { id: 'rosliny', label: 'Rośliny', icon: 'sprout', color: '#10B981' },
  { id: 'ksiazki', label: 'Książki', icon: 'book-open-page-variant', color: '#F59E0B' },
  { id: 'ubrania', label: 'Ubrania', icon: 'tshirt-crew', color: '#6366F1' },
  { id: 'dla_dzieci', label: 'Dla dzieci', icon: 'baby-carriage', color: '#F43F5E' },
  { id: 'inne', label: 'Inne skarby', icon: 'package-variant', color: '#64748B' },
];

export const THEME = {
  primary: '#10B981', // Szmaragdowy zielony Zero-Waste
  primaryDark: '#047857',
  primaryDeep: '#064E3B',
  primaryLight: '#D1FAE5',
  orange: '#F78F00', // Pomarańczowy jak w Yanosiku
  starYellow: '#FDC400', // Żółty gwiazdki z Yanosika
  wystawka: '#F59E0B', // Żółty dla wystawek
  wystawkaLight: '#FEF3C7',
  oddam: '#059669', // Klasyczny zielony dla oddam
  oddamDark: '#047857',
  oddamLight: '#D1FAE5',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
  success: '#10B981',
};

// Gradienty kafelków i przycisków
export const GRADIENTS = {
  mint: ['#10B981', '#059669'] as const,
  mintGlow: ['#34D399', '#059669'] as const,
  cardLight: ['#FFFFFF', '#F8FAFC'] as const,
  cardDark: ['#1E293B', '#0F172A'] as const,
  cardDarkTeal: ['#132E27', '#0F172A'] as const,
  mapTile: ['#064E3B', '#047857'] as const,
  boardBlue: ['#38BDF8', '#0284C7'] as const,
  statOrange: ['#F97316', '#C2410C'] as const,
};

export const APP_FONT = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif',
  default: 'System',
});
