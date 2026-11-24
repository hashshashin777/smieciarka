import { Alert, Linking, Platform } from 'react-native';

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { value: number; formatted: string } {
  const R = 6371; // Promień Ziemi w km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return { value: distanceKm, formatted: `${meters} m stąd` };
  }
  return { value: distanceKm, formatted: `${distanceKm.toFixed(1)} km stąd` };
}

export function formatRelativeTime(dateIso: string): string {
  const date = new Date(dateIso).getTime();
  if (!Number.isFinite(date)) {
    return 'Przed chwilą';
  }
  const now = Date.now();
  const diffInMinutes = Math.max(0, Math.floor((now - date) / (1000 * 60)));

  if (diffInMinutes < 1) return 'Przed chwilą';
  if (diffInMinutes < 60) return `${diffInMinutes} min temu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} godz. temu`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Wczoraj';
  return `${diffInDays} dni temu`;
}

export async function safeOpenUrl(
  url: string,
  errorTitle = 'Nie można otworzyć linku',
  errorBody = 'Sprawdź, czy masz zainstalowaną przeglądarkę lub odpowiednią aplikację.'
): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(errorTitle, errorBody);
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(errorTitle, errorBody);
    return false;
  }
}

export async function openNavigation(
  latitude: number,
  longitude: number,
  label: string
): Promise<void> {
  const encodedLabel = encodeURIComponent(label || 'Znalezisko');
  const scheme = Platform.select({
    ios: `maps:0,0?q=${encodedLabel}@${latitude},${longitude}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
  });
  const webFallback = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  try {
    if (scheme && (await Linking.canOpenURL(scheme))) {
      await Linking.openURL(scheme);
      return;
    }
    await Linking.openURL(webFallback);
  } catch {
    Alert.alert('Brak aplikacji map', 'Nie udało się uruchomić nawigacji dla tych współrzędnych.');
  }
}

export interface PiiDetectionResult {
  hasPhone: boolean;
  hasEmail: boolean;
  detectedTypes: string[];
}

/**
 * Wykrywa obecność numeru telefonu lub adresu e-mail w tekście opisu (HIPOTEZA-03).
 * Chroni użytkowników przed mimowolnym upublicznianiem danych osobowych.
 */
export function detectPiiInText(text: string): PiiDetectionResult {
  if (!text) return { hasPhone: false, hasEmail: false, detectedTypes: [] };

  const phoneRegex = /(?:\+48\s*)?(?:[1-9]\d{2}[-\s]?\d{3}[-\s]?\d{3}|[1-9]\d{1}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2})\b/;
  const hasPhone = phoneRegex.test(text);

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const hasEmail = emailRegex.test(text);

  const detectedTypes: string[] = [];
  if (hasPhone) detectedTypes.push('numer telefonu');
  if (hasEmail) detectedTypes.push('adres e-mail');

  return { hasPhone, hasEmail, detectedTypes };
}

export interface CountdownResult {
  formatted: string;
  shortFormatted: string;
  isExpired: boolean;
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Formatuje odliczanie czasu ważności ogłoszenia (np. dla "Oddam za darmo").
 * Przelicza czas pozostały do wygaśnięcia z dokładnością do dni, godzin i minut.
 */
export function formatRemainingCountdown(
  expiresAt?: string,
  createdAt?: string,
  durationDays?: number,
  referenceNow = Date.now()
): CountdownResult {
  let targetMs = 0;

  if (expiresAt) {
    const parsed = new Date(expiresAt).getTime();
    if (Number.isFinite(parsed)) {
      targetMs = parsed;
    }
  }

  if (targetMs === 0 && createdAt) {
    const createdMs = new Date(createdAt).getTime();
    if (Number.isFinite(createdMs)) {
      const days = typeof durationDays === 'number' && durationDays > 0 ? durationDays : 14;
      targetMs = createdMs + days * 24 * 60 * 60 * 1000;
    }
  }

  if (targetMs === 0) {
    return {
      formatted: 'Brak terminu',
      shortFormatted: 'Brak terminu',
      isExpired: false,
      totalSeconds: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const diffMs = targetMs - referenceNow;

  if (diffMs <= 0) {
    return {
      formatted: 'Wygasło (0 min)',
      shortFormatted: 'Wygasło',
      isExpired: true,
      totalSeconds: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  let formatted = '';
  if (days > 0) {
    const dayWord = days === 1 ? 'dzień' : 'dni';
    formatted = `${days} ${dayWord} ${hours} godz. ${minutes} min`;
  } else if (hours > 0) {
    formatted = `${hours} godz. ${minutes} min`;
  } else if (minutes > 0) {
    formatted = `${minutes} min`;
  } else {
    formatted = `${seconds} sek`;
  }

  let shortFormatted = '';
  if (days > 0) {
    shortFormatted = `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    shortFormatted = `${hours}h ${minutes}m`;
  } else {
    shortFormatted = `${minutes}m`;
  }

  return {
    formatted,
    shortFormatted,
    isExpired: false,
    totalSeconds,
    days,
    hours,
    minutes,
    seconds,
  };
}

