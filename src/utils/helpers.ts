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
