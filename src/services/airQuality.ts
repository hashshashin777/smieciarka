export interface AirQualityData {
  aqi: number; // European AQI (0-100+)
  aqiLabel: string; // 'Bardzo dobra' | 'Dobra' | 'Umiarkowana' | 'Dostateczna' | 'Zła' | 'Bardzo zła'
  aqiColor: string; // Hex color
  aqiDescription: string;
  pm25: number; // µg/m³
  pm10: number; // µg/m³
  no2?: number; // µg/m³
  locationName: string;
  updatedAt: string;
}

export function evaluateEuropeanAqi(aqi: number): {
  label: string;
  color: string;
  description: string;
  iconName: string;
} {
  if (aqi <= 20) {
    return {
      label: 'Bardzo dobra',
      color: '#10B981', // green
      description: 'Czyste powietrze – idealne warunki na spacer i spacer po skarby!',
      iconName: 'weather-sunny',
    };
  }
  if (aqi <= 40) {
    return {
      label: 'Dobra',
      color: '#34D399', // emerald
      description: 'Powietrze w normie, bez ryzyka dla zdrowia.',
      iconName: 'weather-partly-cloudy',
    };
  }
  if (aqi <= 60) {
    return {
      label: 'Umiarkowana',
      color: '#F59E0B', // amber
      description: 'Jakość akceptowalna. Osoby wrażliwe mogą odczuwać dyskomfort.',
      iconName: 'weather-cloudy',
    };
  }
  if (aqi <= 80) {
    return {
      label: 'Dostateczna',
      color: '#F97316', // orange
      description: 'Zalecane ograniczenie dłuższego wysiłku na zewnątrz.',
      iconName: 'weather-dust',
    };
  }
  if (aqi <= 100) {
    return {
      label: 'Zła',
      color: '#EF4444', // red
      description: 'Zwiększone zanieczyszczenie. Lepiej ograniczyć przebywanie na zewnątrz.',
      iconName: 'weather-fog',
    };
  }
  return {
    label: 'Bardzo zła',
    color: '#9333EA', // purple
    description: 'Smog! Pozostań w pomieszczeniu, załóż maskę antysmogową.',
    iconName: 'alert-decagram',
  };
}

export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  locationName: string = 'Twoja okolica'
): Promise<AirQualityData | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude.toFixed(
      4
    )}&longitude=${longitude.toFixed(
      4
    )}&current=european_aqi,pm10,pm2_5,nitrogen_dioxide`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const current = json.current;
    if (!current) return null;

    const aqi = typeof current.european_aqi === 'number' ? Math.round(current.european_aqi) : 20;
    const { label, color, description } = evaluateEuropeanAqi(aqi);

    return {
      aqi,
      aqiLabel: label,
      aqiColor: color,
      aqiDescription: description,
      pm25: typeof current.pm2_5 === 'number' ? Math.round(current.pm2_5 * 10) / 10 : 0,
      pm10: typeof current.pm10 === 'number' ? Math.round(current.pm10 * 10) / 10 : 0,
      no2: typeof current.nitrogen_dioxide === 'number' ? Math.round(current.nitrogen_dioxide * 10) / 10 : undefined,
      locationName,
      updatedAt: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return null;
  }
}
