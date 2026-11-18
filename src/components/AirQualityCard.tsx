import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_FONT } from '../constants/categories';
import { AirQualityData, fetchAirQuality, evaluateEuropeanAqi } from '../services/airQuality';

interface AirQualityCardProps {
  userCoords?: { latitude: number; longitude: number } | null;
  locationName?: string | null;
  style?: StyleProp<ViewStyle>;
  isDark?: boolean;
}

export const AirQualityCard: React.FC<AirQualityCardProps> = ({
  userCoords,
  locationName,
  style,
  isDark = false,
}) => {
  const [data, setData] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  // Fallback to central Poland / Lublin if no coords available
  const lat = userCoords?.latitude ?? 51.2465;
  const lon = userCoords?.longitude ?? 22.5684;
  const placeName = locationName?.trim() || (userCoords ? 'Twoja lokalizacja (GPS)' : 'Lublin (centrum)');

  const loadAirQuality = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetchAirQuality(lat, lon, placeName);
      if (res) {
        setData(res);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, placeName]);

  useEffect(() => {
    loadAirQuality();
  }, [loadAirQuality]);

  const evalInfo = data ? evaluateEuropeanAqi(data.aqi) : null;

  const showDetailsAlert = () => {
    if (!data) return;
    Alert.alert(
      `Czystość powietrza: ${data.locationName}`,
      `Indeks jakości (EAQI): ${data.aqi} / 100 (${data.aqiLabel})\n\n` +
        `• Pył zawieszony PM2.5: ${data.pm25} µg/m³ (norma do 15)\n` +
        `• Pył zawieszony PM10: ${data.pm10} µg/m³ (norma do 45)\n` +
        (data.no2 !== undefined ? `• Dwutlenek azotu NO₂: ${data.no2} µg/m³\n\n` : '\n') +
        `${data.aqiDescription}\n\nDane pobrane na żywo ze stacji Open-Meteo.`,
      [{ text: 'Rozumiem', style: 'default' }]
    );
  };

  return (
    <LinearGradient
      colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, isDark && styles.containerDark, style]}
    >
      {/* Nagłówek modułu */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <View style={styles.headerIconCircle}>
            <MaterialCommunityIcons
              name="weather-windy"
              size={20}
              color="#047857"
            />
          </View>
          <View>
            <View style={styles.titleBadgeRow}>
              <Text style={[styles.title, isDark && styles.titleDark]}>Czyste powietrze</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>GPS NA ŻYWO</Text>
              </View>
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>
              {placeName}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={loadAirQuality}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.refreshBtn}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#047857" />
          ) : (
            <MaterialCommunityIcons name="refresh" size={19} color="#047857" />
          )}
        </TouchableOpacity>
      </View>

      {/* Główna zawartość w karcie w stylu serii i mapy */}
      {data && evalInfo ? (
        <TouchableOpacity activeOpacity={0.85} onPress={showDetailsAlert} style={styles.contentWrap}>
          <LinearGradient
            colors={isDark ? ['#0F2922', '#091815'] : ['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakStyleContainer}
          >
            {/* Duży wskaźnik AQI i status w stylu serii */}
            <View style={styles.streakTopRow}>
              <View style={styles.flameIconBox}>
                <MaterialCommunityIcons name="weather-windy" size={22} color="#FBBF24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.streakTitle}>
                  Jakość: <Text style={styles.streakHighlight}>{data.aqiLabel}</Text>
                </Text>
                <Text style={styles.streakSub} numberOfLines={2}>
                  {data.aqiDescription}
                </Text>
              </View>
              <View style={styles.calendarDateBadge}>
                <Text style={styles.aqiNumberVal}>{data.aqi}</Text>
                <Text style={styles.aqiNumberLabel}>AQI</Text>
              </View>
            </View>

            {/* Kafelki parametrów: PM2.5, PM10, Czas */}
            <View style={styles.weekCalendarRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>PM2.5</Text>
                <Text style={styles.metricValue}>
                  {data.pm25} <Text style={styles.metricUnit}>µg/m³</Text>
                </Text>
                <Text style={[styles.metricStatus, { color: data.pm25 <= 15 ? '#6EE7B7' : data.pm25 <= 50 ? '#FDE68A' : '#FCA5A5' }]}>
                  {data.pm25 <= 15 ? 'W normie' : data.pm25 <= 50 ? 'Podwyższone' : 'Wysokie'}
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>PM10</Text>
                <Text style={styles.metricValue}>
                  {data.pm10} <Text style={styles.metricUnit}>µg/m³</Text>
                </Text>
                <Text style={[styles.metricStatus, { color: data.pm10 <= 45 ? '#6EE7B7' : data.pm10 <= 120 ? '#FDE68A' : '#FCA5A5' }]}>
                  {data.pm10 <= 45 ? 'W normie' : data.pm10 <= 120 ? 'Podwyższone' : 'Wysokie'}
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Aktualizacja</Text>
                <Text style={styles.metricValue}>{data.updatedAt}</Text>
                <Text style={styles.metricHint}>Dotknij po detale</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#059669" />
          <Text style={styles.loadingText}>Pobieram dane o jakości powietrza...</Text>
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error ? 'Nie udało się pobrać danych o smogu' : 'Brak danych'}
          </Text>
          <TouchableOpacity onPress={loadAirQuality} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(62, 240, 196, 0.15)',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: APP_FONT,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  titleDark: {
    color: '#F8FAFC',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontFamily: APP_FONT,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  contentWrap: {
    marginTop: 2,
  },
  streakStyleContainer: {
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  flameIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  streakTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#ECFDF5',
  },
  streakHighlight: {
    color: '#FDE68A',
    fontWeight: '900',
  },
  streakSub: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#A7F3D0',
    marginTop: 1,
    lineHeight: 15,
  },
  calendarDateBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.35)',
  },
  aqiNumberVal: {
    fontFamily: APP_FONT,
    fontSize: 16,
    fontWeight: '900',
    color: '#FEF3C7',
    lineHeight: 18,
  },
  aqiNumberLabel: {
    fontFamily: APP_FONT,
    fontSize: 9,
    fontWeight: '800',
    color: '#A7F3D0',
  },
  weekCalendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  metricLabel: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#A7F3D0',
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ECFDF5',
  },
  metricUnit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(236, 253, 245, 0.75)',
  },
  metricStatus: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  metricHint: {
    fontFamily: APP_FONT,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FDE68A',
    marginTop: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#64748B',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  errorText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#94A3B8',
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  retryBtnText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
});
