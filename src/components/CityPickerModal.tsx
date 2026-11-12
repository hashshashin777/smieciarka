import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_FONT } from '../constants/categories';
import { CityOption, POLISH_CITIES, normalizePolishText } from '../constants/cities';
import { PostItem } from '../types';
import { calculateDistance } from '../utils/helpers';

interface CityPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCity: CityOption | null;
  onSelectCity: (city: CityOption | null) => void;
  gpsCityName?: string | null;
  items?: PostItem[];
}

export const CityPickerModal: React.FC<CityPickerModalProps> = ({
  visible,
  onClose,
  selectedCity,
  onSelectCity,
  gpsCityName,
  items = [],
}) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const popularCities = useMemo(
    () => POLISH_CITIES.filter((c) => c.isPopular),
    []
  );

  const cityItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (items.length === 0) return counts;

    for (const city of POLISH_CITIES) {
      let count = 0;
      for (const item of items) {
        const dist = calculateDistance(
          city.latitude,
          city.longitude,
          item.location.latitude,
          item.location.longitude
        ).value;
        if (dist <= 20) {
          count += 1;
        }
      }
      if (count > 0) {
        counts[city.id] = count;
      }
    }
    return counts;
  }, [items]);

  const filteredCities = useMemo(() => {
    const normalizedQuery = normalizePolishText(query);
    if (!normalizedQuery) {
      return [...POLISH_CITIES].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    }
    return POLISH_CITIES.filter((city) => {
      const matchName = normalizePolishText(city.name).includes(normalizedQuery);
      const matchVoivodeship = normalizePolishText(city.voivodeship).includes(normalizedQuery);
      return matchName || matchVoivodeship;
    }).sort((a, b) => {
      const aStarts = normalizePolishText(a.name).startsWith(normalizedQuery) ? 0 : 1;
      const bStarts = normalizePolishText(b.name).startsWith(normalizedQuery) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name, 'pl');
    });
  }, [query]);

  const trimmedQuery = query.trim();
  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    const norm = normalizePolishText(trimmedQuery);
    return POLISH_CITIES.some((c) => normalizePolishText(c.name) === norm);
  }, [trimmedQuery]);

  const handleClose = () => {
    setQuery('');
    setIsGeocoding(false);
    onClose();
  };

  const handleChooseCity = (city: CityOption | null) => {
    setQuery('');
    setIsGeocoding(false);
    onSelectCity(city);
    onClose();
  };

  const handleGeocodeCustomCity = async () => {
    if (!trimmedQuery) return;
    if (Platform.OS === 'web') {
      Alert.alert(
        'Wybierz miasto z listy',
        'Wyszukiwanie dowolnej miejscowości spoza listy jest dostępne na urządzeniach mobilnych (Android / iOS).'
      );
      return;
    }

    setIsGeocoding(true);
    try {
      const results = await Location.geocodeAsync(`${trimmedQuery}, Polska`);
      if (results.length > 0) {
        const first = results[0];
        let resolvedName = trimmedQuery;
        let resolvedVoivodeship = 'Polska';

        try {
          const reverse = await Location.reverseGeocodeAsync({
            latitude: first.latitude,
            longitude: first.longitude,
          });
          if (reverse.length > 0) {
            resolvedName = reverse[0].city || reverse[0].subregion || trimmedQuery;
            resolvedVoivodeship = reverse[0].region || 'Polska';
          }
        } catch {
          // Zostawiamy nazwę wpisaną przez użytkownika
        }

        const customCity: CityOption = {
          id: `custom-${normalizePolishText(resolvedName)}`,
          name: resolvedName,
          voivodeship: resolvedVoivodeship,
          latitude: first.latitude,
          longitude: first.longitude,
        };
        handleChooseCity(customCity);
      } else {
        Alert.alert(
          'Nie znaleziono miejscowości',
          `Nie udało się znaleźć lokalizacji „${trimmedQuery}”. Sprawdź pisownię lub wybierz najbliższe miasto z listy.`
        );
      }
    } catch {
      Alert.alert(
        'Błąd wyszukiwania',
        'Nie udało się wyszukać miejscowości. Upewnij się, że masz połączenie z internetem.'
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.sheetContainer, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="city-variant-outline" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Wybierz miasto</Text>
                <Text style={styles.subtitle}>
                  Przeglądaj wystawki na pulpicie i mapie w wybranej miejscowości
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Wpisz nazwę miasta (np. Kraków, Gdańsk)..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Option: Use GPS */}
          <TouchableOpacity
            style={[styles.gpsCard, selectedCity === null && styles.gpsCardSelected]}
            onPress={() => handleChooseCity(null)}
            activeOpacity={0.8}
          >
            <View style={[styles.gpsIconCircle, selectedCity === null && styles.gpsIconCircleSelected]}>
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={20}
                color={selectedCity === null ? '#FFFFFF' : '#059669'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.gpsTitle, selectedCity === null && styles.gpsTitleSelected]}>
                Moja aktualna lokalizacja (GPS)
              </Text>
              <Text style={styles.gpsSub}>
                {gpsCityName
                  ? `Wykryto w pobliżu: ${gpsCityName}`
                  : 'Automatycznie wykrywa miasto z telefonu'}
              </Text>
            </View>
            {selectedCity === null && (
              <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
            )}
          </TouchableOpacity>

          {/* Popular cities quick chips when search is empty */}
          {!trimmedQuery && (
            <View style={styles.popularSection}>
              <Text style={styles.sectionLabel}>Największe miasta:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularChipsRow}
              >
                {popularCities.map((city) => {
                  const isActive = selectedCity?.id === city.id;
                  return (
                    <TouchableOpacity
                      key={city.id}
                      style={[styles.popularChip, isActive && styles.popularChipActive]}
                      onPress={() => handleChooseCity(city)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.popularChipText, isActive && styles.popularChipTextActive]}>
                        {city.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Custom city geocoding action if user typed a locality */}
          {trimmedQuery.length >= 2 && !hasExactMatch && (
            <TouchableOpacity
              style={styles.customSearchBtn}
              onPress={handleGeocodeCustomCity}
              disabled={isGeocoding}
              activeOpacity={0.8}
            >
              {isGeocoding ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <MaterialCommunityIcons name="map-search-outline" size={18} color="#059669" />
              )}
              <Text style={styles.customSearchText} numberOfLines={1}>
                Wyszukaj miejscowość „{trimmedQuery}” na mapie
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>
            {trimmedQuery ? `Wyniki (${filteredCities.length}):` : 'Wszystkie miasta (A–Z):'}
          </Text>

          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.cityList}
            renderItem={({ item }) => {
              const isSelected = selectedCity?.id === item.id;
              const nearbyCount = cityItemCounts[item.id] ?? 0;
              return (
                <TouchableOpacity
                  style={[styles.cityRow, isSelected && styles.cityRowSelected]}
                  onPress={() => handleChooseCity(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cityRowLeft}>
                    <MaterialCommunityIcons
                      name={isSelected ? 'map-marker-check' : 'map-marker-outline'}
                      size={20}
                      color={isSelected ? '#059669' : '#64748B'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cityName, isSelected && styles.cityNameSelected]}>
                        {item.name}
                      </Text>
                      <Text style={styles.cityVoivodeship}>woj. {item.voivodeship}</Text>
                    </View>
                  </View>
                  <View style={styles.cityRowRight}>
                    {nearbyCount > 0 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{nearbyCount} ogł.</Text>
                      </View>
                    )}
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="city-variant-outline" size={34} color="#94A3B8" />
                <Text style={styles.emptyTitle}>Brak miasta na liście</Text>
                <Text style={styles.emptySub}>
                  Użyj przycisku powyżej, aby wyszukać miejscowość na mapie.
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 30, 38, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 24,
    height: '82%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  title: {
    fontFamily: APP_FONT,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  gpsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  gpsCardSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  gpsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsIconCircleSelected: {
    backgroundColor: '#10B981',
  },
  gpsTitle: {
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  gpsTitleSelected: {
    color: '#047857',
  },
  gpsSub: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  popularSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  popularChipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  popularChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  popularChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  popularChipText: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  popularChipTextActive: {
    color: '#FFFFFF',
  },
  customSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  customSearchText: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  cityList: {
    flex: 1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cityRowSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  cityRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cityName: {
    fontFamily: APP_FONT,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  cityNameSelected: {
    color: '#047857',
  },
  cityVoivodeship: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  cityRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontFamily: APP_FONT,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptySub: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
});
