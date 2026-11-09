import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PostItem } from '../types';
import { THEME, CATEGORIES, APP_FONT } from '../constants/categories';
import { calculateDistance } from '../utils/helpers';
import { DARK_MAP_STYLE } from '../constants/darkMapStyle';

// Dynamically handle react-native-maps for native platforms
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Callout = Maps.Callout;
  } catch (e) {
    // Maps not loaded
  }
}

export type ThemeMode = 'light' | 'dark' | 'auto';

interface MapViewTabProps {
  items: PostItem[];
  userCoords?: { latitude: number; longitude: number } | null;
  selectedItem: PostItem | null;
  onSelectItem: (item: PostItem | null) => void;
  onOpenDetail: (item: PostItem) => void;
  onRecenterGPS: () => void;
  usersCount?: number;
  themeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
  isDark?: boolean;
}

export const MapViewTab: React.FC<MapViewTabProps> = ({
  items,
  userCoords,
  selectedItem,
  onSelectItem,
  onOpenDetail,
  onRecenterGPS,
  usersCount = 128,
  themeMode = 'auto',
  onThemeModeChange,
  isDark = false,
}) => {
  const mapRef = useRef<any>(null);

  const defaultRegion = {
    latitude: userCoords?.latitude || 51.2465,
    longitude: userCoords?.longitude || 22.5684,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };

  const [region, setRegion] = React.useState(defaultRegion);

  // Klastrowanie przestrzenne (Spatial Grid Clustering) zależne od zoomu mapy
  const clusters = React.useMemo(() => {
    // Jeśli użytkownik jest bardzo blisko (zoom wysoki), pokazujemy pojedyncze markery
    if (region.latitudeDelta < 0.02) {
      return items.map((item) => ({
        id: item.id,
        isCluster: false,
        latitude: item.location.latitude,
        longitude: item.location.longitude,
        items: [item],
        count: 1,
      }));
    }

    // Grupowanie w siatkę geograficzną
    const cellSize = region.latitudeDelta / 4.5;
    const grid: { [key: string]: { latSum: number; lngSum: number; items: PostItem[] } } = {};

    for (const item of items) {
      const gridX = Math.floor(item.location.latitude / cellSize);
      const gridY = Math.floor(item.location.longitude / cellSize);
      const key = `${gridX}_${gridY}`;

      if (!grid[key]) {
        grid[key] = { latSum: 0, lngSum: 0, items: [] };
      }
      grid[key].latSum += item.location.latitude;
      grid[key].lngSum += item.location.longitude;
      grid[key].items.push(item);
    }

    return Object.entries(grid).map(([key, data]) => {
      const count = data.items.length;
      return {
        id: `cluster_${key}`,
        isCluster: count > 1,
        latitude: data.latSum / count,
        longitude: data.lngSum / count,
        items: data.items,
        count,
      };
    });
  }, [items, region.latitudeDelta]);

  const handleClusterPress = (cluster: { latitude: number; longitude: number; count: number }) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: Math.max(region.latitudeDelta / 2.5, 0.008),
        longitudeDelta: Math.max(region.longitudeDelta / 2.5, 0.008),
      }, 400);
    }
  };

  const handleCenter = () => {
    if (mapRef.current && userCoords) {
      mapRef.current.animateToRegion({
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 500);
    }
    onRecenterGPS();
  };

  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.webFallbackContainer}>
        <MaterialCommunityIcons name="map-legend" size={54} color={THEME.primary} />
        <Text style={styles.fallbackTitle}>Mapa wystawek i znalezisk</Text>
        <Text style={styles.fallbackDesc}>
          Natywny moduł map Apple/Google Maps działa na urządzeniu mobilnym (iPhone / Android).
        </Text>
        <View style={styles.fallbackItemsList}>
          <Text style={styles.fallbackListHeader}>Pinezki aktywne w okolicy ({items.length}):</Text>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.fallbackPinItem}
              onPress={() => onOpenDetail(item)}
            >
              <View
                style={[
                  styles.markerIcon,
                  item.type === 'wystawka' ? styles.markerWystawka : styles.markerOddam,
                ]}
              >
                <MaterialCommunityIcons
                  name={item.type === 'wystawka' ? 'dump-truck' : 'gift'}
                  size={14}
                  color="#FFFFFF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fallbackItemTitle}>{item.title}</Text>
                <Text style={styles.fallbackItemSub}>{item.location.address || 'Ulica'}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={defaultRegion}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="light"
        customMapStyle={[]}
        onRegionChangeComplete={(newRegion: any) => setRegion(newRegion)}
      >
        {clusters.map((cluster) => {
          if (cluster.isCluster) {
            return (
              <Marker
                key={cluster.id}
                coordinate={{
                  latitude: cluster.latitude,
                  longitude: cluster.longitude,
                }}
                onPress={() => handleClusterPress(cluster)}
                tracksViewChanges={false}
              >
                <View style={styles.clusterMarker}>
                  <MaterialCommunityIcons name="layers-triple-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.clusterText}>{cluster.count}</Text>
                </View>
              </Marker>
            );
          }

          const item = cluster.items[0];
          const isWystawka = item.type === 'wystawka';
          return (
            <Marker
              key={item.id}
              coordinate={{
                latitude: item.location.latitude,
                longitude: item.location.longitude,
              }}
              onPress={() => onSelectItem(item)}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.customMarker,
                  isWystawka ? styles.markerWystawka : styles.markerOddam,
                  selectedItem?.id === item.id && styles.selectedMarker,
                ]}
              >
                <MaterialCommunityIcons
                  name={isWystawka ? 'dump-truck' : 'gift'}
                  size={16}
                  color="#FFFFFF"
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Informacja o braku ogłoszeń na mapie (Cold Start) */}
      {items.length === 0 && (
        <View style={[styles.emptyMapNotice, isDark && styles.emptyMapNoticeDark]}>
          <MaterialCommunityIcons name="compass-off-outline" size={24} color={THEME.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.emptyMapTitle, isDark && styles.emptyMapTitleDark]}>
              Brak wystawek w tym widoku mapy
            </Text>
            <Text style={[styles.emptyMapSub, isDark && styles.emptyMapSubDark]}>
              Przesuń mapę w stronę centrum lub dodaj pierwsze znalezisko!
            </Text>
          </View>
        </View>
      )}

      {/* Floating GPS recenter button */}
      <TouchableOpacity
        style={[styles.gpsFab, isDark && styles.gpsFabDark]}
        onPress={handleCenter}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={isDark ? '#FFFFFF' : THEME.text} />
      </TouchableOpacity>

      {/* Selected Item Preview Card at the bottom of the map */}
      {selectedItem && (
        <View style={styles.previewCardContainer}>
          <TouchableOpacity
            style={[styles.previewCard, isDark && styles.previewCardDark]}
            onPress={() => onOpenDetail(selectedItem)}
            activeOpacity={0.9}
          >
            {selectedItem.photos && selectedItem.photos.length > 0 ? (
              <Image source={{ uri: selectedItem.photos[0] }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewPlaceholder}>
                <MaterialCommunityIcons name="image-off-outline" size={24} color="#94A3B8" />
              </View>
            )}

            <View style={styles.previewInfo}>
              <View style={styles.previewBadgeRow}>
                <View
                  style={[
                    styles.typeMiniBadge,
                    selectedItem.type === 'wystawka' ? styles.wystawkaBadge : styles.oddamBadge,
                  ]}
                >
                  <Text style={styles.typeMiniBadgeText}>
                    {selectedItem.type === 'wystawka' ? 'WYSTAWKA' : 'ODDAM'}
                  </Text>
                </View>
                {userCoords && (
                  <Text style={styles.previewDistance}>
                    {calculateDistance(
                      userCoords.latitude,
                      userCoords.longitude,
                      selectedItem.location.latitude,
                      selectedItem.location.longitude
                    ).formatted}
                  </Text>
                )}
              </View>

              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedItem.title}
              </Text>

              <Text style={styles.previewAddress} numberOfLines={1}>
                {selectedItem.location.address || 'Sprawdź szczegóły'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closePreviewBtn}
              onPress={() => onSelectItem(null)}
            >
              <MaterialCommunityIcons name="close" size={16} color="#64748B" />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}
      {/* 7. OKRĄGŁY PŁYWAJĄCY PRZYCISK SPOŁECZNOŚCI (Skopiowany z pulpitu w stylu Yanosik) */}
      <TouchableOpacity
        style={[
          styles.floatingCommunityBadge,
          selectedItem ? styles.floatingCommunityBadgeWithPreview : null,
        ]}
        activeOpacity={0.85}
        onPress={() =>
          Alert.alert(
            'Społeczność Śmieciarki 👥',
            `${usersCount} użytkowników aktywnie przegląda i ratuje rzeczy w Twojej okolicy!`,
            [{ text: 'Super!', style: 'default' }]
          )
        }
      >
        <View style={styles.floatingBadgeInner}>
          <MaterialCommunityIcons name="account-multiple" size={24} color="#FFFFFF" />
          <Text style={styles.floatingBadgeCount}>{usersCount}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  containerDark: {
    backgroundColor: '#0B0F19',
  },
  // Suwak wyboru motywu i mapy (Jasny / Ciemny / Auto)
  themeSliderContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 22,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 25,
  },
  themeSliderContainerDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.94)',
    borderColor: '#334155',
  },
  themeSegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 18,
  },
  themeSegmentBtnActiveLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  themeSegmentBtnActiveDark: {
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  themeSegmentText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  themeSegmentTextDark: {
    color: '#94A3B8',
  },
  themeSegmentTextActiveLight: {
    color: '#0F172A',
    fontWeight: '800',
  },
  themeSegmentTextActiveDark: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  customMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerWystawka: {
    backgroundColor: THEME.wystawka,
  },
  markerOddam: {
    backgroundColor: THEME.oddam,
  },
  selectedMarker: {
    transform: [{ scale: 1.25 }],
    borderColor: '#0F172A',
  },
  clusterMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#021e26',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#10B981',
    gap: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 6,
  },
  clusterText: {
    fontFamily: APP_FONT,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  gpsFab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  gpsFabDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewCardContainer: {
    position: 'absolute',
    bottom: 128,
    left: 16,
    right: 16,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  previewImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
  },
  previewPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  previewBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeMiniBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  wystawkaBadge: {
    backgroundColor: THEME.wystawka,
  },
  oddamBadge: {
    backgroundColor: THEME.oddam,
  },
  typeMiniBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  previewDistance: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  previewAddress: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  closePreviewBtn: {
    padding: 6,
  },
  webFallbackContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 12,
  },
  fallbackDesc: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    maxWidth: 320,
  },
  fallbackItemsList: {
    width: '100%',
    maxWidth: 500,
  },
  fallbackListHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 10,
  },
  fallbackPinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  markerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  fallbackItemSub: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  // Floating Community Badge skopiowany z pulpitu
  floatingCommunityBadge: {
    position: 'absolute',
    bottom: 96,
    right: 18,
    zIndex: 30,
  },
  floatingCommunityBadgeWithPreview: {
    bottom: 220,
  },
  floatingBadgeInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 7,
  },
  emptyMapNotice: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 25,
  },
  emptyMapNoticeDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  emptyMapTitle: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyMapTitleDark: {
    color: '#F8FAFC',
  },
  emptyMapSub: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  emptyMapSubDark: {
    color: '#94A3B8',
  },
  floatingBadgeCount: {
    fontFamily: APP_FONT,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },
});
