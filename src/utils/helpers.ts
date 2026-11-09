import { Linking, Platform } from 'react-native';

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
  const now = new Date().getTime();
  const date = new Date(dateIso).getTime();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) return 'Przed chwilą';
  if (diffInMinutes < 60) return `${diffInMinutes} min temu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    if (diffInHours === 1) return '1 godz. temu';
    if (diffInHours < 5) return `${diffInHours} godz. temu`;
    return `${diffInHours} godz. temu`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Wczoraj';
  return `${diffInDays} dni temu`;
}

export function openNavigation(latitude: number, longitude: number, label: string) {
  const scheme = Platform.select({
    ios: `maps:0,0?q=${encodeURIComponent(label)}@${latitude},${longitude}`,
    android: `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(label)})`,
  });
  const webFallback = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  if (scheme) {
    Linking.canOpenURL(scheme).then((supported) => {
      if (supported) {
        Linking.openURL(scheme);
      } else {
        Linking.openURL(webFallback);
      }
    }).catch(() => Linking.openURL(webFallback));
  } else {
    Linking.openURL(webFallback);
  }
}
