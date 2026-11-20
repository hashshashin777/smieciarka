import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PostItem, ItemType, BoardPost, UserProfile } from '../types';
import { CATEGORIES, THEME } from '../constants/categories';
import { CityOption, getCityDisplayLabel } from '../constants/cities';
import { calculateDistance, formatRelativeTime, safeOpenUrl } from '../utils/helpers';
import { EcoStats, AdminSettings } from '../services/storageCache';
import { resolveBannerSource } from '../constants/banners';
import { fetchAirQuality, AirQualityData } from '../services/airQuality';

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const MONTHS_SHORT_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function getCalendarWeekDays(streakDays: number = 3) {
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7; // 0 = Pn .. 6 = Nd
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - todayIndex);

  const days = WEEKDAYS.map((label, idx) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + idx);
    const isToday = idx === todayIndex;
    const isCompleted = idx <= todayIndex && todayIndex - idx < Math.max(streakDays, 1);
    const isFuture = idx > todayIndex;

    return {
      label,
      dayNumber: date.getDate(),
      isToday,
      isCompleted,
      isFuture,
    };
  });

  const todayFormatted = `${WEEKDAYS[todayIndex]}, ${now.getDate()} ${MONTHS_SHORT_PL[now.getMonth()]}`;
  return { days, todayFormatted };
}

interface DesktopWebLayoutProps {
  items: PostItem[];
  boardPosts: BoardPost[];
  savedItemIds: string[];
  savedBoardPostIds: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterType: 'all' | ItemType;
  onSelectFilterType: (type: 'all' | ItemType) => void;
  filterCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  selectedCity: CityOption | null;
  gpsCityName: string | null;
  onOpenCityPicker: () => void;
  onOpenDetail: (item: PostItem) => void;
  onOpenAddModal: () => void;
  onOpenBoardModal: () => void;
  onToggleSaveItem: (item: PostItem) => void;
  onToggleSaveBoardPost: (post: BoardPost) => void;
  onStillThere: (itemId: string) => void;
  onTakeItem: (item: PostItem) => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  ecoStats: EcoStats;
  usersCount: number;
  userCoords?: { latitude: number; longitude: number } | null;
  adminSettings: AdminSettings;
  streakDays?: number;
}

type DesktopTab = 'all' | 'wystawka' | 'oddam' | 'board' | 'map' | 'saved';

export const DesktopWebLayout: React.FC<DesktopWebLayoutProps> = ({
  items,
  boardPosts,
  savedItemIds,
  savedBoardPostIds,
  searchQuery,
  onSearchChange,
  filterType,
  onSelectFilterType,
  filterCategory,
  onSelectCategory,
  selectedCity,
  gpsCityName,
  onOpenCityPicker,
  onOpenDetail,
  onOpenAddModal,
  onOpenBoardModal,
  onToggleSaveItem,
  onToggleSaveBoardPost,
  onStillThere,
  onTakeItem,
  currentUser,
  onOpenAuth,
  onOpenAdmin,
  ecoStats,
  usersCount,
  userCoords,
  adminSettings,
  streakDays = 3,
}) => {
  // Strona główna domyślnie otwiera się z widokiem mapy zgodnie z ustaleniami
  const [activeTab, setActiveTab] = useState<DesktopTab>('map');
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const { days: calendarDays, todayFormatted } = useMemo(
    () => getCalendarWeekDays(streakDays),
    [streakDays]
  );

  const [airData, setAirData] = useState<AirQualityData | null>(null);
  const [airLoading, setAirLoading] = useState<boolean>(false);

  const cityLabel = getCityDisplayLabel(selectedCity, gpsCityName);
  const airLat = selectedCity?.latitude ?? userCoords?.latitude ?? 51.2465;
  const airLon = selectedCity?.longitude ?? userCoords?.longitude ?? 22.5684;

  const loadAirQuality = useCallback(async () => {
    setAirLoading(true);
    try {
      const res = await fetchAirQuality(airLat, airLon, cityLabel);
      if (res) {
        setAirData(res);
      }
    } catch {
      // fallback
    } finally {
      setAirLoading(false);
    }
  }, [airLat, airLon, cityLabel]);

  useEffect(() => {
    loadAirQuality();
  }, [loadAirQuality]);

  // Widoczność modułów serii i czystego powietrza pod górną nawigacją (domyślnie ukryte)
  const showTopStatusWidgets = false;

  const handleSearchSubmit = () => {
    onSearchChange(localSearch);
  };

  // Sync tab change with filterType
  const handleTabChange = (tab: DesktopTab) => {
    setActiveTab(tab);
    if (tab === 'wystawka') {
      onSelectFilterType('wystawka');
    } else if (tab === 'oddam') {
      onSelectFilterType('oddam');
    } else if (tab === 'all') {
      onSelectFilterType('all');
    }
  };

  // Filtered items based on tab, category, search
  const displayedItems = useMemo(() => {
    let result = [...items];

    if (activeTab === 'wystawka') {
      result = result.filter((i) => i.type === 'wystawka');
    } else if (activeTab === 'oddam') {
      result = result.filter((i) => i.type === 'oddam');
    } else if (activeTab === 'saved') {
      result = result.filter((i) => savedItemIds.includes(i.id));
    }

    if (filterCategory) {
      result = result.filter((i) => i.category === filterCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.location.address && i.location.address.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, activeTab, filterCategory, searchQuery, savedItemIds]);

  // Filtered board posts for board or saved tabs
  const displayedBoardPosts = useMemo(() => {
    let result = [...boardPosts];
    if (activeTab === 'saved') {
      result = result.filter((p) => savedBoardPostIds.includes(p.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          (p.locationArea && p.locationArea.toLowerCase().includes(q))
      );
    }
    return result;
  }, [boardPosts, activeTab, savedBoardPostIds, searchQuery]);

  // Dynamic OpenStreetMap viewport calculation
  const mapCenterLat = selectedCity?.latitude || 51.2465;
  const mapCenterLng = selectedCity?.longitude || 22.5684;
  const osmBbox = `${(mapCenterLng - 0.09).toFixed(4)}%2C${(mapCenterLat - 0.05).toFixed(4)}%2C${(mapCenterLng + 0.09).toFixed(4)}%2C${(mapCenterLat + 0.05).toFixed(4)}`;

  return (
    <ScrollView
      style={styles.pageContainer}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={true}
    >
      {/* 1. TOP NAVBAR (Ciemny petrol #002F34 ze spójnym podświetleniem #23E5DB) */}
      <header style={{ width: '100%' } as any}>
        <View style={styles.topNavbar}>
          <View style={styles.topNavbarInner}>
            {/* Logo */}
            <TouchableOpacity
              style={styles.logoContainer}
              onPress={() => {
                handleTabChange('map');
                onSelectCategory(null);
                onSearchChange('');
                setLocalSearch('');
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Wystawka Zero-Waste - Strona główna"
            >
              <Image
                source={require('../assets/web_logo.webp')}
                style={styles.webLogoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Right Action Menu */}
            <View style={styles.topNavActions}>
              {/* Ogłoszenia */}
              <TouchableOpacity
                style={[
                  styles.navLink,
                  (activeTab === 'all' || activeTab === 'wystawka' || activeTab === 'oddam') &&
                    styles.navLinkActive,
                ]}
                onPress={() => handleTabChange('all')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Przejdź do ogłoszeń"
              >
                <MaterialCommunityIcons
                  name="format-list-bulleted"
                  size={20}
                  color={
                    activeTab === 'all' || activeTab === 'wystawka' || activeTab === 'oddam'
                      ? '#23E5DB'
                      : '#FFFFFF'
                  }
                />
                <Text
                  style={[
                    styles.navLinkText,
                    (activeTab === 'all' || activeTab === 'wystawka' || activeTab === 'oddam') &&
                      styles.navLinkTextActive,
                  ]}
                >
                  Ogłoszenia
                </Text>
              </TouchableOpacity>

              {/* Widok mapy */}
              <TouchableOpacity
                style={[styles.navLink, activeTab === 'map' && styles.navLinkActive]}
                onPress={() => handleTabChange('map')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Przejdź do widoku mapy"
              >
                <MaterialCommunityIcons
                  name="map-outline"
                  size={20}
                  color={activeTab === 'map' ? '#23E5DB' : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.navLinkText,
                    activeTab === 'map' && styles.navLinkTextActive,
                  ]}
                >
                  Widok mapy
                </Text>
              </TouchableOpacity>

              {/* Tablica sąsiedzka */}
              <TouchableOpacity
                style={[styles.navLink, activeTab === 'board' && styles.navLinkActive]}
                onPress={() => handleTabChange('board')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Przejdź do tablicy sąsiedzkiej"
              >
                <MaterialCommunityIcons
                  name="forum-outline"
                  size={20}
                  color={activeTab === 'board' ? '#23E5DB' : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.navLinkText,
                    activeTab === 'board' && styles.navLinkTextActive,
                  ]}
                >
                  Tablica sąsiedzka
                </Text>
              </TouchableOpacity>

              {/* Zapisane */}
              <TouchableOpacity
                style={[styles.navLink, activeTab === 'saved' && styles.navLinkActive]}
                onPress={() => handleTabChange('saved')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Zapisane ogłoszenia (${savedItemIds.length + savedBoardPostIds.length})`}
              >
                <MaterialCommunityIcons
                  name={savedItemIds.length > 0 ? 'heart' : 'heart-outline'}
                  size={20}
                  color={
                    savedItemIds.length > 0
                      ? '#EF4444'
                      : activeTab === 'saved'
                      ? '#23E5DB'
                      : '#FFFFFF'
                  }
                />
                <Text
                  style={[
                    styles.navLinkText,
                    activeTab === 'saved' && styles.navLinkTextActive,
                  ]}
                >
                  Zapisane ({savedItemIds.length + savedBoardPostIds.length})
                </Text>
              </TouchableOpacity>

              {/* Twoje konto (jeśli zalogowany) */}
              {currentUser && (
                <TouchableOpacity
                  style={styles.navLink}
                  onPress={onOpenAuth}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Profil użytkownika"
                >
                  <MaterialCommunityIcons name="account-circle-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.navLinkText}>
                    {currentUser.name || 'Twoje konto'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Admin Pill (dla roli admin) */}
              {currentUser?.role === 'admin' && (
                <TouchableOpacity
                  style={[styles.navLink, styles.adminPill]}
                  onPress={onOpenAdmin}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Panel Administratora"
                >
                  <MaterialCommunityIcons name="shield-crown-outline" size={18} color="#FBBF24" />
                  <Text style={[styles.navLinkText, { color: '#FBBF24', fontWeight: '700' }]}>Admin</Text>
                </TouchableOpacity>
              )}

              {/* Przycisk akcji CTA "Dodaj ogłoszenie" */}
              <TouchableOpacity
                style={styles.addCtaButton}
                onPress={onOpenAddModal}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Dodaj nowe ogłoszenie"
              >
                <MaterialCommunityIcons name="plus" size={20} color="#064E3B" />
                <Text style={styles.addCtaButtonText}>Dodaj ogłoszenie</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* MODUŁY WIDGETÓW GÓRNYCH (UKRYTE NA ŻYCZENIE) */}
        {showTopStatusWidgets && (
          <View style={styles.topWidgetsSection}>
            <View style={styles.topWidgetsInner}>
              {/* 1. KARTA: MODUŁ SERII ZERO-WASTE */}
              <LinearGradient
                colors={['#064E3B', '#022C22']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.widgetCard}
              >
                <View style={styles.widgetHeaderRow}>
                  <View style={styles.flameIconBox}>
                    <MaterialCommunityIcons name="fire" size={24} color="#FBBF24" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.widgetTitle}>
                      Seria: <Text style={styles.widgetHighlight}>{streakDays} {streakDays === 1 ? 'dzień' : 'dni'} z rzędu</Text>
                    </Text>
                    <Text style={styles.widgetSub}>
                      {streakDays >= 5 ? 'Świetna regularność Zero-Waste!' : 'Odwiedzaj nas codziennie, by ratować przedmioty'}
                    </Text>
                  </View>
                  <View style={styles.calendarDateBadge}>
                    <MaterialCommunityIcons name="calendar-today" size={12} color="#FDE68A" style={{ marginRight: 4 }} />
                    <Text style={styles.calendarDateText}>{todayFormatted}</Text>
                  </View>
                </View>

                {/* Tydzień kalendarzowy Pn - Nd */}
                <View style={styles.weekCalendarRow}>
                  {calendarDays.map((day) => (
                    <View key={day.label} style={styles.calendarDayCol}>
                      <Text
                        style={[
                          styles.calendarWeekdayLabel,
                          day.isToday && styles.calendarWeekdayLabelToday,
                          day.isFuture && styles.calendarWeekdayLabelFuture,
                        ]}
                      >
                        {day.label}
                      </Text>
                      <View
                        style={[
                          styles.calendarCircle,
                          day.isCompleted && !day.isToday && styles.calendarCircleDone,
                          day.isToday && styles.calendarCircleToday,
                          day.isFuture && styles.calendarCircleFuture,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarDayNumber,
                            day.isCompleted && !day.isToday && styles.calendarDayNumberDone,
                            day.isToday && styles.calendarDayNumberToday,
                            day.isFuture && styles.calendarDayNumberFuture,
                          ]}
                        >
                          {day.dayNumber}
                        </Text>
                        {day.isCompleted && !day.isToday && (
                          <View style={styles.calendarDoneDot}>
                            <MaterialCommunityIcons name="check" size={9} color="#064E3B" />
                          </View>
                        )}
                      </View>
                      {day.isToday ? (
                        <View style={styles.todayPill}>
                          <Text style={styles.todayPillText}>DZIŚ</Text>
                        </View>
                      ) : (
                        <View style={styles.todayPillSpacer} />
                      )}
                    </View>
                  ))}
                </View>
              </LinearGradient>

              {/* 2. KARTA: MODUŁ CZYSTEGO POWIETRZA */}
              <LinearGradient
                colors={['#00383F', '#002227']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.widgetCard}
              >
                <View style={styles.widgetHeaderRow}>
                  <View style={[styles.flameIconBox, { backgroundColor: 'rgba(35, 229, 219, 0.15)', borderColor: 'rgba(35, 229, 219, 0.3)' }]}>
                    <MaterialCommunityIcons name="weather-windy" size={24} color="#23E5DB" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.widgetTitle}>Czyste powietrze</Text>
                      <View style={styles.liveGpsPill}>
                        <View style={styles.liveGpsDot} />
                        <Text style={styles.liveGpsText}>GPS NA ŻYWO</Text>
                      </View>
                    </View>
                    <Text style={styles.widgetSub} numberOfLines={1}>
                      {cityLabel} • {airData?.aqiDescription || 'Monitorowanie jakości powietrza'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={loadAirQuality}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.airRefreshBtn}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Odśwież jakość powietrza"
                  >
                    {airLoading ? (
                      <ActivityIndicator size="small" color="#23E5DB" />
                    ) : (
                      <MaterialCommunityIcons name="refresh" size={18} color="#23E5DB" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Parametry czystości powietrza */}
                <View style={styles.airMetricsRow}>
                  {/* Wskaźnik AQI */}
                  <View style={styles.airAqiBadgeBox}>
                    <Text style={styles.airAqiVal}>{airData?.aqi ?? 30}</Text>
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.airAqiLabel}>INDEKS AQI</Text>
                      <Text style={[styles.airAqiStatusText, { color: airData?.aqiColor || '#34D399' }]}>
                        {airData?.aqiLabel || 'Dobra'}
                      </Text>
                    </View>
                  </View>

                  {/* Rozbicie na cząstki pyłu PM2.5, PM10, NO2 */}
                  <View style={styles.airPillsContainer}>
                    <View style={styles.airPillItem}>
                      <Text style={styles.airPillKey}>PM2.5</Text>
                      <Text style={styles.airPillVal}>{airData?.pm25 ?? 9.9} <Text style={styles.airPillUnit}>µg/m³</Text></Text>
                    </View>
                    <View style={styles.airPillDivider} />
                    <View style={styles.airPillItem}>
                      <Text style={styles.airPillKey}>PM10</Text>
                      <Text style={styles.airPillVal}>{airData?.pm10 ?? 11} <Text style={styles.airPillUnit}>µg/m³</Text></Text>
                    </View>
                    {airData?.no2 !== undefined && (
                      <>
                        <View style={styles.airPillDivider} />
                        <View style={styles.airPillItem}>
                          <Text style={styles.airPillKey}>NO₂</Text>
                          <Text style={styles.airPillVal}>{airData.no2} <Text style={styles.airPillUnit}>µg/m³</Text></Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* 2. HERO SEARCH SECTION (Białe czyste tło z panoramicznym banerem i wyszukiwarką) */}
        <View style={styles.heroSearchSection}>
          <View style={styles.heroSearchInner}>
            {/* Panoramiczny Baner WWW (1024x200, zoptymalizowany WebP, niezależny slot admina 'web') */}
            {adminSettings?.adsEnabled !== false && (
              <View style={styles.bannerWrapper}>
                <Image
                  source={resolveBannerSource('web', adminSettings?.customBanners)}
                  style={styles.heroBannerImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Pasek wyszukiwania z ramką w kolorze morsa */}
            <View style={styles.searchBarBox}>
              {/* Pole 1: Wyszukiwana fraza */}
              <View style={styles.searchInputWrapper}>
                <MaterialCommunityIcons name="magnify" size={24} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Czego szukasz? (np. szafa, fotel, pralka, rower, książki...)"
                  placeholderTextColor="#94A3B8"
                  value={localSearch}
                  onChangeText={setLocalSearch}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                  accessibilityLabel="Wpisz szukany przedmiot"
                />
                {localSearch.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setLocalSearch('');
                      onSearchChange('');
                    }}
                    style={styles.clearSearchBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Wyczyść tekst wyszukiwania"
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Pionowy separator */}
              <View style={styles.searchDivider} />

              {/* Pole 2: Lokalizacja / Miasto */}
              <TouchableOpacity
                style={styles.searchLocationWrapper}
                onPress={onOpenCityPicker}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Zmień miasto, aktualnie wybrano: ${cityLabel}`}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={22} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.searchLocationText} numberOfLines={1}>
                  {cityLabel}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              {/* Przycisk wyszukiwania */}
              <TouchableOpacity
                style={styles.searchSubmitButton}
                onPress={handleSearchSubmit}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Wykonaj wyszukiwanie"
              >
                <Text style={styles.searchSubmitButtonText}>Szukaj</Text>
                <MaterialCommunityIcons name="magnify" size={20} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>

            {/* Pasek ekologiczny i statystyki społeczności */}
            <View style={styles.heroStatsBadge}>
              <View style={styles.heroStatItem}>
                <MaterialCommunityIcons name="account-group-outline" size={16} color="#059669" />
                <Text style={styles.heroStatText}>
                  <Text style={styles.heroStatBold}>{usersCount}</Text> sąsiadów online
                </Text>
              </View>
              <View style={styles.heroStatDot} />
              <View style={styles.heroStatItem}>
                <MaterialCommunityIcons name="recycle" size={16} color="#059669" />
                <Text style={styles.heroStatText}>
                  <Text style={styles.heroStatBold}>{ecoStats.itemsRescued}</Text> uratowanych rzeczy
                </Text>
              </View>
              <View style={styles.heroStatDot} />
              <View style={styles.heroStatItem}>
                <MaterialCommunityIcons name="leaf" size={16} color="#059669" />
                <Text style={styles.heroStatText}>
                  <Text style={styles.heroStatBold}>{ecoStats.co2SavedKg} kg</Text> zaoszczędzonego CO₂
                </Text>
              </View>
            </View>
          </View>
        </View>
      </header>

      {/* 3. KATEGORIE GŁÓWNE */}
      <section style={{ width: '100%' } as any}>
        <View style={styles.categoriesContainer}>
          <View style={styles.categoriesInner}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Kategorie główne</Text>
              <Text style={styles.sectionHeaderSub}>Wybierz kategorię, aby zawęzić wyniki w wybranym mieście</Text>
            </View>

            <View style={styles.categoriesGrid}>
              {/* Kategoria: Wszystko */}
              <TouchableOpacity
                style={[
                  styles.categoryCircleCard,
                  filterCategory === null && styles.categoryCircleCardActive,
                ]}
                onPress={() => onSelectCategory(null)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Pokaż wszystkie kategorie"
              >
                <View
                  style={[
                    styles.categoryCircleIcon,
                    filterCategory === null
                      ? styles.categoryCircleIconActive
                      : styles.categoryCircleIconDefault,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="view-grid-outline"
                    size={26}
                    color={filterCategory === null ? '#FFFFFF' : '#334155'}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryCircleLabel,
                    filterCategory === null && styles.categoryCircleLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  Wszystko
                </Text>
              </TouchableOpacity>

              {/* Pozostałe kategorie */}
              {CATEGORIES.map((cat) => {
                const isSelected = filterCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCircleCard,
                      isSelected && styles.categoryCircleCardActive,
                    ]}
                    onPress={() => onSelectCategory(isSelected ? null : cat.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Kategoria: ${cat.label}`}
                  >
                    <View
                      style={[
                        styles.categoryCircleIcon,
                        { backgroundColor: isSelected ? cat.color : `${cat.color}15` },
                        isSelected && { borderWidth: 2, borderColor: cat.color },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={26}
                        color={isSelected ? '#FFFFFF' : cat.color}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryCircleLabel,
                        isSelected && { color: cat.color, fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </section>

      {/* 4. GŁÓWNY KONTENER TREŚCI (MAPA / OGŁOSZENIA / TABLICA / ZAPISANE) */}
      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' } as any}>
        <View style={styles.mainContentWrapper}>
          {/* Pasek podzakładek (Wszystkie, Wystawki, Do oddania, Tablica, Mapa) */}
          <View style={styles.tabsNavRow}>
            <View style={styles.tabsLeftGroup}>
              {/* Zakładka: Widok mapy */}
              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'map' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('map')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Widok mapy ogłoszeń"
              >
                <MaterialCommunityIcons
                  name="map-outline"
                  size={18}
                  color={activeTab === 'map' ? '#059669' : '#64748B'}
                />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'map' && styles.desktopTabTextActive,
                  ]}
                >
                  Widok mapy
                </Text>
              </TouchableOpacity>

              {/* Zakładka: Wszystkie ogłoszenia */}
              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'all' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('all')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Wszystkie ogłoszenia (${items.length})`}
              >
                <MaterialCommunityIcons
                  name="format-list-bulleted"
                  size={18}
                  color={activeTab === 'all' ? '#059669' : '#64748B'}
                />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'all' && styles.desktopTabTextActive,
                  ]}
                >
                  Wszystkie ogłoszenia
                </Text>
                <View style={[styles.tabCountPill, activeTab === 'all' && styles.tabCountPillActive]}>
                  <Text style={[styles.tabCountText, activeTab === 'all' && styles.tabCountTextActive]}>
                    {items.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Zakładka: Wystawki uliczne */}
              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'wystawka' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('wystawka')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Wystawki uliczne"
              >
                <View style={[styles.tabBadgeDot, { backgroundColor: '#F59E0B' }]} />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'wystawka' && styles.desktopTabTextActive,
                  ]}
                >
                  Wystawki uliczne
                </Text>
                <View style={[styles.tabCountPill, activeTab === 'wystawka' && styles.tabCountPillActive]}>
                  <Text style={[styles.tabCountText, activeTab === 'wystawka' && styles.tabCountTextActive]}>
                    {items.filter((i) => i.type === 'wystawka').length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Zakładka: Do oddania */}
              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'oddam' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('oddam')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Rzeczy do oddania"
              >
                <View style={[styles.tabBadgeDot, { backgroundColor: '#10B981' }]} />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'oddam' && styles.desktopTabTextActive,
                  ]}
                >
                  Do oddania
                </Text>
                <View style={[styles.tabCountPill, activeTab === 'oddam' && styles.tabCountPillActive]}>
                  <Text style={[styles.tabCountText, activeTab === 'oddam' && styles.tabCountTextActive]}>
                    {items.filter((i) => i.type === 'oddam').length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Zakładka: Tablica sąsiedzka */}
              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'board' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('board')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Tablica sąsiedzka (${boardPosts.length})`}
              >
                <MaterialCommunityIcons
                  name="bulletin-board"
                  size={18}
                  color={activeTab === 'board' ? '#059669' : '#64748B'}
                />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'board' && styles.desktopTabTextActive,
                  ]}
                >
                  Tablica sąsiedzka
                </Text>
                <View style={[styles.tabCountPill, activeTab === 'board' && styles.tabCountPillActive]}>
                  <Text style={[styles.tabCountText, activeTab === 'board' && styles.tabCountTextActive]}>
                    {boardPosts.length}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Przycisk resetowania filtrów (jeśli aktywne) */}
            {(filterCategory || searchQuery) && (
              <TouchableOpacity
                style={styles.clearFilterPill}
                onPress={() => {
                  onSelectCategory(null);
                  onSearchChange('');
                  setLocalSearch('');
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Wyczyść aktywne filtry i wyszukiwanie"
              >
                <MaterialCommunityIcons name="filter-remove-outline" size={16} color="#DC2626" />
                <Text style={styles.clearFilterText}>Wyczyść filtry</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* WIDOK: INTERAKTYWNA MAPA (Domyślny widok pulpitu WWW) */}
          {activeTab === 'map' && (
            <View style={styles.mapTabWrapper}>
              <View style={styles.mapTabHeader}>
                <View>
                  <Text style={styles.boardSectionTitle}>Interaktywna mapa wystawek i punktów odbioru</Text>
                  <Text style={styles.boardSectionSub}>
                    Przeglądaj przedmioty zaznaczone bezpośrednio w wybranej lokalizacji: <Text style={{ fontWeight: '700', color: '#002F34' }}>{cityLabel}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeCityMapBtn}
                  onPress={onOpenCityPicker}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Zmień miasto na mapie"
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#059669" />
                  <Text style={styles.changeCityMapBtnText}>Zmień miasto</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mapSplitLayout}>
                {/* Lewa strona: OpenStreetMap iframe wycentrowana na wybranym mieście */}
                <View style={styles.mapIframeContainer}>
                  {Platform.OS === 'web' ? (
                    <iframe
                      title="Interaktywna Mapa Wystawka"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${osmBbox}&layer=mapnik&marker=${mapCenterLat}%2C${mapCenterLng}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        borderRadius: 16,
                      } as any}
                    />
                  ) : null}
                </View>

                {/* Prawa strona: boczna lista pinezek i ogłoszeń w tej okolicy */}
                <View style={styles.mapItemsSidebar}>
                  <View style={styles.mapSidebarHeader}>
                    <Text style={styles.mapSidebarTitle}>Pinezki w okolicy</Text>
                    <View style={styles.mapSidebarCountBadge}>
                      <Text style={styles.mapSidebarCountText}>{displayedItems.length}</Text>
                    </View>
                  </View>

                  {displayedItems.length === 0 ? (
                    <View style={styles.emptySidebarBox}>
                      <MaterialCommunityIcons name="map-marker-off-outline" size={36} color="#94A3B8" />
                      <Text style={styles.emptySidebarTitle}>Brak pinezek w tej lokalizacji</Text>
                      <Text style={styles.emptySidebarDesc}>
                        Bądź pierwszą osobą, która doda wystawkę w mieście {cityLabel}!
                      </Text>
                    </View>
                  ) : (
                    <ScrollView style={styles.mapSidebarScroll} showsVerticalScrollIndicator={true}>
                      {displayedItems.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.mapSidebarCard}
                          onPress={() => onOpenDetail(item)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Szczegóły: ${item.title}`}
                        >
                          <Image
                            source={{ uri: item.photos?.[0] || 'https://via.placeholder.com/100' }}
                            style={styles.mapSidebarThumb}
                            resizeMode="cover"
                          />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={styles.typeBadgeRow}>
                              <View
                                style={[
                                  styles.typeBadge,
                                  item.type === 'wystawka' ? styles.typeWystawka : styles.typeOddam,
                                ]}
                              >
                                <Text style={styles.typeBadgeText}>
                                  {item.type === 'wystawka' ? 'WYSTAWKA' : 'ODDAM'}
                                </Text>
                              </View>
                              <Text style={styles.freePriceTag}>ZA DARMO</Text>
                            </View>
                            <Text style={styles.mapSidebarItemTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.mapSidebarItemAddress} numberOfLines={1}>
                              📍 {item.location.address || cityLabel}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* WIDOK: OGŁOSZENIA (WSZYSTKIE, WYSTAWKI, DO ODDANIA, ZAPISANE) */}
          {activeTab !== 'board' && activeTab !== 'map' && (
            <View style={styles.itemsSection}>
              <View style={styles.itemsSectionHeader}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>
                    {activeTab === 'saved'
                      ? 'Twoje zapisane ogłoszenia'
                      : activeTab === 'wystawka'
                      ? 'Wystawki uliczne do uratowania'
                      : activeTab === 'oddam'
                      ? 'Rzeczy do oddania od sąsiadów'
                      : 'Wszystkie darmowe rzeczy w Twojej okolicy'}
                  </Text>
                  <Text style={styles.sectionHeaderSub}>
                    Znaleziono {displayedItems.length} ogłoszeń w lokalizacji: <Text style={{ fontWeight: '700', color: '#002F34' }}>{cityLabel}</Text>
                  </Text>
                </View>
              </View>

              {displayedItems.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <MaterialCommunityIcons name="cube-outline" size={54} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>Brak ogłoszeń w tej kategorii</Text>
                  <Text style={styles.emptyStateDesc}>
                    Nie znaleźliśmy nic dla podanych kryteriów. Spróbuj wyczyścić filtry lub dodać nową wystawkę!
                  </Text>
                  <TouchableOpacity
                    style={[styles.addCtaButton, { marginTop: 18 }]}
                    onPress={onOpenAddModal}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Dodaj pierwsze ogłoszenie"
                  >
                    <MaterialCommunityIcons name="plus" size={18} color="#002F34" />
                    <Text style={styles.addCtaButtonText}>Dodaj pierwsze ogłoszenie</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* 4-KOLUMNOWA RESPONSYWNA SIATKA OGŁOSZEŃ */
                <View style={styles.itemsGrid}>
                  {displayedItems.map((item) => {
                    const isSaved = savedItemIds.includes(item.id);
                    const distance = userCoords
                      ? calculateDistance(
                          userCoords.latitude,
                          userCoords.longitude,
                          item.location.latitude,
                          item.location.longitude
                        ).formatted
                      : null;

                    return (
                      <View key={item.id} style={styles.olxCard}>
                        {/* Kontener zdjęcia */}
                        <TouchableOpacity
                          style={styles.cardImageContainer}
                          onPress={() => onOpenDetail(item)}
                          activeOpacity={0.9}
                          accessibilityRole="button"
                          accessibilityLabel={`Otwórz ogłoszenie: ${item.title}`}
                        >
                          <Image
                            source={{ uri: item.photos?.[0] || 'https://via.placeholder.com/300' }}
                            style={styles.cardImage}
                            resizeMode="cover"
                          />

                          {/* Plakietka typu w lewym górnym rogu */}
                          <View
                            style={[
                              styles.cardBadge,
                              item.type === 'wystawka' ? styles.cardBadgeWystawka : styles.cardBadgeOddam,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={item.type === 'wystawka' ? 'dump-truck' : 'gift'}
                              size={12}
                              color="#FFFFFF"
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.cardBadgeText}>
                              {item.type === 'wystawka' ? 'WYSTAWKA' : 'ODDAM'}
                            </Text>
                          </View>

                          {/* Przycisk polubienia (serduszko) */}
                          <TouchableOpacity
                            style={styles.cardFavoriteBtn}
                            onPress={() => onToggleSaveItem(item)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={isSaved ? 'Usuń z zapisanych' : 'Zapisz ogłoszenie'}
                          >
                            <MaterialCommunityIcons
                              name={isSaved ? 'heart' : 'heart-outline'}
                              size={20}
                              color={isSaved ? '#EF4444' : '#002F34'}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Szczegóły ogłoszenia */}
                        <TouchableOpacity
                          style={styles.cardDetails}
                          onPress={() => onOpenDetail(item)}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.cardTitle} numberOfLines={2}>
                            {item.title}
                          </Text>

                          {/* Etykieta ceny i odległość */}
                          <View style={styles.cardPriceRow}>
                            <Text style={styles.cardPriceText}>ZA DARMO</Text>
                            {distance && (
                              <Text style={styles.cardDistanceText}>📍 {distance}</Text>
                            )}
                          </View>

                          {/* Lokalizacja i czas dodania */}
                          <View style={styles.cardLocationRow}>
                            <Text style={styles.cardLocationText} numberOfLines={1}>
                              {item.location.address || cityLabel}
                            </Text>
                            <Text style={styles.cardTimeText}>
                              {formatRelativeTime(item.createdAt)}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Przyciski społecznościowe: Stoi / Zabierz */}
                        <View style={styles.cardActionFooter}>
                          <TouchableOpacity
                            style={styles.cardQuickActionBtn}
                            onPress={() => onStillThere(item.id)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Potwierdź, że przedmiot nadal stoi"
                          >
                            <MaterialCommunityIcons name="thumb-up-outline" size={14} color="#059669" />
                            <Text style={styles.cardQuickActionText}>
                              Stoi ({item.stillThereVotes || 0})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.cardQuickActionBtn, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                            onPress={() => onTakeItem(item)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Oznacz, że przedmiot został zabrany"
                          >
                            <MaterialCommunityIcons name="check-circle-outline" size={14} color="#EF4444" />
                            <Text style={[styles.cardQuickActionText, { color: '#EF4444' }]}>
                              Zabierz ({item.takenVotes || 0})
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* WIDOK: TABLICA OGŁOSZEŃ SĄSIEDZKICH */}
          {activeTab === 'board' && (
            <View style={styles.boardContainer}>
              <View style={styles.boardHeaderRow}>
                <View>
                  <Text style={styles.boardSectionTitle}>Tablica Ogłoszeń Sąsiedzkich</Text>
                  <Text style={styles.boardSectionSub}>
                    Zapytaj sąsiadów, zgłoś poszukiwany przedmiot lub podziel się wieściami w okolicy.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addBoardPostBtn}
                  onPress={onOpenBoardModal}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Dodaj nowy wpis na tablicę"
                >
                  <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                  <Text style={styles.addBoardPostBtnText}>Dodaj wpis na tablicę</Text>
                </TouchableOpacity>
              </View>

              {displayedBoardPosts.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <MaterialCommunityIcons name="message-text-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>Brak wpisów na tablicy</Text>
                  <Text style={styles.emptyStateDesc}>
                    Bądź pierwszą osobą, która zada pytanie lub napisze do sąsiadów!
                  </Text>
                </View>
              ) : (
                <View style={styles.boardGrid}>
                  {displayedBoardPosts.map((post) => {
                    const isSaved = savedBoardPostIds.includes(post.id);
                    return (
                      <View key={post.id} style={styles.boardCard}>
                        <View style={styles.boardCardHeader}>
                          <View style={styles.boardAuthorInfo}>
                            <View style={styles.boardAvatar}>
                              <Text style={styles.boardAvatarText}>
                                {(post.authorName || 'Sąsiad').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.boardAuthorName}>{post.authorName || 'Sąsiad'}</Text>
                              <Text style={styles.boardPostTime}>{formatRelativeTime(post.createdAt)}</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => onToggleSaveBoardPost(post)}
                            style={{ padding: 6, cursor: 'pointer' as any }}
                            accessibilityRole="button"
                            accessibilityLabel={isSaved ? 'Usuń wpis z zapisanych' : 'Zapisz wpis'}
                          >
                            <MaterialCommunityIcons
                              name={isSaved ? 'heart' : 'heart-outline'}
                              size={20}
                              color={isSaved ? '#EF4444' : '#94A3B8'}
                            />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.boardCardTitle}>{post.title}</Text>
                        <Text style={styles.boardCardContent}>{post.content}</Text>
                        {post.locationArea && (
                          <View style={styles.boardLocationRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748B" />
                            <Text style={styles.boardLocationText}>{post.locationArea}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </main>

      {/* 5. FOOTER (Elegancki granatowo-morski z logo i linkami) */}
      <footer style={{ width: '100%' } as any}>
        <View style={styles.footerContainer}>
          <View style={styles.footerInner}>
            {/* Kolumna 1: Brand & Logo */}
            <View style={styles.footerCol}>
              <View style={styles.footerLogoBadge}>
                <Image
                  source={require('../assets/web_logo.webp')}
                  style={{
                    width: 86,
                    height: 56,
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))' as any,
                  }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.footerDesc}>
                Społecznościowa platforma sąsiedzka łącząca ludzi, którzy chcą uratować rzeczy z ulicy lub oddać
                niepotrzebne przedmioty sąsiadom za darmo.
              </Text>
              <Text style={styles.footerCopyright}>
                © {new Date().getFullYear()} Wystawka Zero-Waste • Wszelkie prawa zastrzeżone
              </Text>
            </View>

            {/* Kolumna 2: Kategorie */}
            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Kategorie</Text>
              {CATEGORIES.slice(0, 5).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.footerLinkItem}
                  onPress={() => onSelectCategory(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.footerLinkText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Kolumna 3: Społeczność & Pomoc */}
            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Społeczność & Regulamin</Text>
              <TouchableOpacity
                style={styles.footerLinkItem}
                onPress={() => handleTabChange('board')}
                activeOpacity={0.8}
              >
                <Text style={styles.footerLinkText}>Tablica sąsiedzka</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerLinkItem}
                onPress={() => handleTabChange('map')}
                activeOpacity={0.8}
              >
                <Text style={styles.footerLinkText}>Mapa znalezisk</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerLinkItem}
                onPress={() => void safeOpenUrl('https://wystawka.fun/privacy')}
                activeOpacity={0.8}
              >
                <Text style={styles.footerLinkText}>Polityka Prywatności i RODO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerLinkItem}
                onPress={() => void safeOpenUrl('https://wystawka.fun/terms')}
                activeOpacity={0.8}
              >
                <Text style={styles.footerLinkText}>Regulamin serwisu</Text>
              </TouchableOpacity>
            </View>

            {/* Kolumna 4: Aplikacja */}
            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Aplikacja mobilna</Text>
              <Text style={styles.footerAppDesc}>
                Korzystaj z Wystawki także w terenie na telefonie z Androidem i iOS z powiadomieniami o wystawkach na Twojej ulicy.
              </Text>
              <TouchableOpacity
                style={styles.footerGooglePlayBtn}
                onPress={() => void safeOpenUrl('https://expo.dev/accounts/hashshashin/projects/wystawka-zero-waste')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Pobierz aplikację na Androida"
              >
                <MaterialCommunityIcons name="google-play" size={20} color="#FFFFFF" />
                <Text style={styles.footerGooglePlayText}>Pobierz na Androida</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </footer>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pageContent: {
    alignItems: 'center',
    paddingBottom: 0,
  },

  // 1. TOP NAVBAR (Głęboki szmaragd Zero-Waste #064E3B)
  topNavbar: {
    width: '100%',
    backgroundColor: '#064E3B',
    borderBottomWidth: 1,
    borderBottomColor: '#043D2E',
    paddingVertical: 12,
    minHeight: 74,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  topNavbarInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 8,
    cursor: 'pointer' as any,
  },
  webLogoImage: {
    width: 96,
    height: 64,
    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))' as any,
  },
  topNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    cursor: 'pointer' as any,
  },
  navLinkActive: {
    backgroundColor: 'rgba(35, 229, 219, 0.15)',
    borderColor: 'rgba(35, 229, 219, 0.35)',
  },
  navLinkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  navLinkTextActive: {
    color: '#23E5DB',
    fontWeight: '700',
  },
  adminPill: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  addCtaButton: {
    backgroundColor: '#23E5DB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#23E5DB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    cursor: 'pointer' as any,
  },
  addCtaButtonText: {
    color: '#064E3B',
    fontSize: 14,
    fontWeight: '700',
  },

  // TOP WIDGETS (SERIA & CZYSTE POWIETRZE)
  topWidgetsSection: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 14,
  },
  topWidgetsInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  widgetCard: {
    flex: 1,
    minWidth: 380,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    justifyContent: 'space-between',
  },
  widgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  flameIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  widgetHighlight: {
    color: '#FDE68A',
    fontWeight: '900',
  },
  widgetSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  calendarDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.25)',
  },
  calendarDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FDE68A',
  },
  weekCalendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarDayCol: {
    alignItems: 'center',
    flex: 1,
  },
  calendarWeekdayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A7F3D0',
    marginBottom: 4,
  },
  calendarWeekdayLabelToday: {
    color: '#FDE68A',
    fontWeight: '800',
  },
  calendarWeekdayLabelFuture: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  calendarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  calendarCircleDone: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
  },
  calendarCircleToday: {
    backgroundColor: '#F59E0B',
    borderColor: '#FDE68A',
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
  },
  calendarCircleFuture: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  calendarDayNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  calendarDayNumberDone: {
    color: '#FFFFFF',
  },
  calendarDayNumberToday: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  calendarDayNumberFuture: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  calendarDoneDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPill: {
    marginTop: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  todayPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FDE68A',
  },
  todayPillSpacer: {
    height: 16,
  },

  // AIR QUALITY SPECIFIC
  liveGpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    gap: 5,
  },
  liveGpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveGpsText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6EE7B7',
    letterSpacing: 0.5,
  },
  airRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(35, 229, 219, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(35, 229, 219, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  airMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  airAqiBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  airAqiVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  airAqiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  airAqiStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  airPillsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  airPillItem: {
    alignItems: 'center',
  },
  airPillKey: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  airPillVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  airPillUnit: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '400',
  },
  airPillDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  // 2. HERO SEARCH SECTION
  heroSearchSection: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  heroSearchInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bannerWrapper: {
    width: '100%',
    maxWidth: 960,
    aspectRatio: 1024 / 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
  },
  searchBarBox: {
    width: '100%',
    maxWidth: 960,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#002F34',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
    outlineWidth: 0 as any,
  },
  clearSearchBtn: {
    padding: 6,
    cursor: 'pointer' as any,
  },
  searchDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  searchLocationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    cursor: 'pointer' as any,
  },
  searchLocationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: 180,
  },
  searchSubmitButton: {
    backgroundColor: '#002F34',
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  searchSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  heroStatsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 14,
    backgroundColor: '#F0FDF4',
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#86EFAC',
  },
  heroStatText: {
    color: '#047857',
    fontSize: 13,
  },
  heroStatBold: {
    fontWeight: '700',
    color: '#064E3B',
  },

  // 3. CATEGORIES SECTION
  categoriesContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 24,
  },
  categoriesInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#002F34',
  },
  sectionHeaderSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryCircleCard: {
    alignItems: 'center',
    width: 104,
    cursor: 'pointer' as any,
  },
  categoryCircleCardActive: {
    transform: [{ scale: 1.04 }],
  },
  categoryCircleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  categoryCircleIconActive: {
    backgroundColor: '#059669',
    shadowOpacity: 0.2,
  },
  categoryCircleIconDefault: {
    backgroundColor: '#F1F5F9',
  },
  categoryCircleLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryCircleLabelActive: {
    fontWeight: '700',
    color: '#059669',
  },

  // 4. MAIN WRAPPER
  mainContentWrapper: {
    maxWidth: 1240,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },

  // TABS
  tabsNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    marginBottom: 24,
  },
  tabsLeftGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  desktopTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginBottom: -2,
    cursor: 'pointer' as any,
  },
  desktopTabItemActive: {
    borderBottomColor: '#059669',
  },
  desktopTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  desktopTabTextActive: {
    color: '#002F34',
    fontWeight: '700',
  },
  tabCountPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabCountPillActive: {
    backgroundColor: '#D1FAE5',
  },
  tabCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabCountTextActive: {
    color: '#047857',
  },
  tabBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  clearFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    cursor: 'pointer' as any,
  },
  clearFilterText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },

  // ITEMS GRID
  itemsSection: {
    width: '100%',
  },
  itemsSectionHeader: {
    marginBottom: 18,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  olxCard: {
    width: 'calc(25% - 15px)' as any,
    minWidth: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardImageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#F1F5F9',
    position: 'relative',
    cursor: 'pointer' as any,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardBadgeWystawka: {
    backgroundColor: '#D97706',
  },
  cardBadgeOddam: {
    backgroundColor: '#059669',
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardFavoriteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    cursor: 'pointer' as any,
  },
  cardDetails: {
    padding: 14,
    cursor: 'pointer' as any,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#002F34',
    lineHeight: 20,
    height: 40,
    marginBottom: 8,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardPriceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  cardDistanceText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  cardLocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  cardLocationText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  cardTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardActionFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    padding: 8,
    gap: 8,
  },
  cardQuickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
    gap: 4,
    cursor: 'pointer' as any,
  },
  cardQuickActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  // EMPTY STATE
  emptyStateBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#002F34',
    marginTop: 12,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 480,
    lineHeight: 20,
  },

  // BOARD POSTS
  boardContainer: {
    width: '100%',
  },
  boardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  boardSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#002F34',
  },
  boardSectionSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  addBoardPostBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer' as any,
  },
  addBoardPostBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  boardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  boardCard: {
    width: 'calc(33.333% - 11px)' as any,
    minWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  boardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  boardAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  boardAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  boardPostTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  boardCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#002F34',
    marginBottom: 8,
  },
  boardCardContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 12,
  },
  boardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  boardLocationText: {
    fontSize: 12,
    color: '#64748B',
  },

  // MAP TAB
  mapTabWrapper: {
    width: '100%',
  },
  mapTabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  changeCityMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    cursor: 'pointer' as any,
  },
  changeCityMapBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  mapSplitLayout: {
    flexDirection: 'row',
    height: 600,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  mapIframeContainer: {
    flex: 2,
    backgroundColor: '#E2E8F0',
  },
  mapItemsSidebar: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  mapSidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mapSidebarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#002F34',
  },
  mapSidebarCountBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mapSidebarCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  emptySidebarBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptySidebarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#002F34',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySidebarDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  mapSidebarScroll: {
    flex: 1,
  },
  mapSidebarCard: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    cursor: 'pointer' as any,
  },
  mapSidebarThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeWystawka: {
    backgroundColor: '#FEF3C7',
  },
  typeOddam: {
    backgroundColor: '#D1FAE5',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
  },
  freePriceTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  mapSidebarItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#002F34',
  },
  mapSidebarItemAddress: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // 5. FOOTER
  footerContainer: {
    width: '100%',
    backgroundColor: '#064E3B',
    borderTopWidth: 1,
    borderTopColor: '#043D2E',
    paddingTop: 48,
    paddingBottom: 36,
    marginTop: 48,
  },
  footerInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 32,
  },
  footerCol: {
    width: 'calc(25% - 24px)' as any,
    minWidth: 220,
  },
  footerLogoBadge: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  footerDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  footerCopyright: {
    fontSize: 12,
    color: '#64748B',
  },
  footerColTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  footerLinkItem: {
    marginBottom: 10,
    cursor: 'pointer' as any,
  },
  footerLinkText: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  footerAppDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  footerGooglePlayBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    cursor: 'pointer' as any,
  },
  footerGooglePlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
