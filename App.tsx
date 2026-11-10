import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Alert,
  Image,
  Modal,
  ScrollView,
  Platform,
  LayoutAnimation,
  UIManager,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

import { PostItem, ItemType, BoardPost } from './src/types';
import { INITIAL_ITEMS } from './src/mock/items';
import { INITIAL_BOARD_POSTS } from './src/mock/boardPosts';
import { THEME, APP_FONT } from './src/constants/categories';
import { Header } from './src/components/Header';
import { ItemCard } from './src/components/ItemCard';
import { MapViewTab } from './src/components/MapViewTab';
import { BoardTab } from './src/components/BoardTab';
import { SavedTab } from './src/components/SavedTab';
import { YanosikDashboard } from './src/components/YanosikDashboard';
import { AddItemModal } from './src/components/AddItemModal';
import { AddBoardPostModal } from './src/components/AddBoardPostModal';
import { ItemDetailModal } from './src/components/ItemDetailModal';
import { NeighborhoodModal } from './src/components/NeighborhoodModal';
import { LoginScreenModal } from './src/components/LoginScreenModal';
import { ItemChatModal } from './src/components/ItemChatModal';
import { calculateDistance } from './src/utils/helpers';
import { UserProfile, AuthProvider } from './src/types';
import { AuthService } from './src/services/authService';
import { TutorialTooltip } from './src/components/TutorialTooltip';
import { TUTORIAL_STEPS } from './src/constants/tutorialSteps';
import {
  StorageCache,
  EcoStats,
  NeighborhoodSettings,
} from './src/services/storageCache';
import {
  fetchItemsFromCloud,
  insertItemToCloud,
  voteStillThereInCloud,
  voteTakenInCloud,
  supabase,
} from './src/services/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ViewMode = 'home' | 'map' | 'list' | 'board' | 'saved';

interface NavTabConfig {
  id: ViewMode;
  label: string;
  activeIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  inactiveIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  gradient: readonly [string, string];
}

const NAV_TABS: NavTabConfig[] = [
  {
    id: 'home',
    label: 'Pulpit',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
    gradient: ['#10B981', '#059669'],
  },
  {
    id: 'map',
    label: 'Mapa',
    activeIcon: 'map',
    inactiveIcon: 'map-outline',
    gradient: ['#10B981', '#0D9488'],
  },
  {
    id: 'list',
    label: 'Lista',
    activeIcon: 'format-list-bulleted-square',
    inactiveIcon: 'format-list-bulleted',
    gradient: ['#14B8A6', '#059669'],
  },
  {
    id: 'board',
    label: 'Tablica',
    activeIcon: 'clipboard-text',
    inactiveIcon: 'clipboard-text-outline',
    gradient: ['#38BDF8', '#0284C7'],
  },
  {
    id: 'saved',
    label: 'Zapisane',
    activeIcon: 'star',
    inactiveIcon: 'star-outline',
    gradient: ['#FBBF24', '#D97706'],
  },
];

export default function App() {
  const [items, setItems] = useState<PostItem[]>(INITIAL_ITEMS);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>(INITIAL_BOARD_POSTS);
  const [savedItemIds, setSavedItemIds] = useState<string[]>(['post-1']);
  const [savedBoardPostIds, setSavedBoardPostIds] = useState<string[]>(['board-1']);
  const [filterType, setFilterType] = useState<'all' | ItemType>('all');
  const [viewMode, setViewMode] = useState<'home' | 'map' | 'list' | 'board' | 'saved'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>({
    latitude: 51.2465,
    longitude: 22.5684,
  });
  const [showBetaNotice, setShowBetaNotice] = useState(true);
  const [themeMode, setThemeMode] = useState<'light'>('light');
  const [isAddTooltipVisible, setIsAddTooltipVisible] = useState(true);
  const [isBoardTooltipDismissed, setIsBoardTooltipDismissed] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);

  // Zaawansowane filtry i sortowanie (Moduł E)
  const [sortMode, setSortMode] = useState<'nearest' | 'newest'>('nearest');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(0);

  // Profil Ekologiczny Zero-Waste (Moduł D)
  const [ecoStats, setEcoStats] = useState<EcoStats>({
    itemsRescued: 2,
    co2SavedKg: 28,
    postsCreated: 1,
  });
  const [streakDays, setStreakDays] = useState<number>(3);

  // Mój Rewir & Geofencing (Moduł B)
  const [neighborhoodSettings, setNeighborhoodSettings] = useState<NeighborhoodSettings>({
    radiusKm: 2,
    alertsEnabled: true,
    label: 'Mój rewir (2 km)',
  });
  const [isNeighborhoodModalVisible, setIsNeighborhoodModalVisible] = useState(false);

  // Autoryzacja i konta (Apple, Google, Facebook) + Tryb Gość
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [isChatModalVisible, setIsChatModalVisible] = useState(false);
  const [chatItem, setChatItem] = useState<PostItem | null>(null);

  const checkAuthAfterSplash = async () => {
    setShowWelcome(false);
    try {
      const profile = await AuthService.getUserProfile();
      const isGuest = await AuthService.isGuestMode();
      if (!profile && !isGuest) {
        setIsLoginModalVisible(true);
      }
    } catch {
      // Ignore
    }
  };

  // Ekran powitalny: 5 sekund z możliwością wcześniejszego zamknięcia
  useEffect(() => {
    const timer = setTimeout(() => {
      checkAuthAfterSplash();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Aplikacja działa wyłącznie w trybie Light Mode
  const isDark = false;

  // Modals state
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isAddBoardModalVisible, setIsAddBoardModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<PostItem | null>(null);
  const [selectedMapItem, setSelectedMapItem] = useState<PostItem | null>(null);

  // Request GPS, load offline cache and fetch cloud data on startup
  useEffect(() => {
    (async () => {
      // 0. Ładowanie pamięci podręcznej (Offline Cache - Moduł C)
      try {
        const cached = await StorageCache.getCachedItems();
        if (cached && cached.length > 0) {
          const cachedIds = new Set(cached.map((c) => c.id));
          const newInitials = INITIAL_ITEMS.filter((it) => !cachedIds.has(it.id));
          const combined = [...newInitials, ...cached];
          setItems(combined);
          StorageCache.saveCachedItems(combined);
        } else {
          setItems(INITIAL_ITEMS);
          StorageCache.saveCachedItems(INITIAL_ITEMS);
        }
        const cachedSaved = await StorageCache.getSavedIds();
        if (cachedSaved && cachedSaved.length > 0) {
          setSavedItemIds(cachedSaved);
        }
        const nSettings = await StorageCache.getNeighborhoodSettings();
        setNeighborhoodSettings(nSettings);
        const stats = await StorageCache.getEcoStats();
        setEcoStats(stats);
        const activeStreak = await StorageCache.recordDailyActivity();
        setStreakDays(activeStreak);
        const profile = await AuthService.getUserProfile();
        if (profile) {
          setCurrentUser(profile);
        }
        const tutorialDone = await StorageCache.isTutorialCompleted();
        if (!tutorialDone) {
          setTutorialStepIndex(0);
        }
      } catch (cacheErr) {
        // Pomijamy błąd cache
      }

      // 1. Pobieranie GPS
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (err) {
        setUserCoords({ latitude: 51.2465, longitude: 22.5684 }); // Domyślnie Centrum Lublina
      }

      // 2. Pobieranie świeżych ogłoszeń z chmury Supabase
      try {
        const cloudItems = await fetchItemsFromCloud();
        if (cloudItems && cloudItems.length > 0) {
          setItems(cloudItems);
          StorageCache.saveCachedItems(cloudItems);
        }
      } catch (e) {
        console.log('Używam danych z pamięci podręcznej');
      }
    })();

    // 3. Nasłuchiwanie na żywo (Realtime) z bazy Supabase
    if (supabase) {
      const channel = supabase
        .channel('public:items')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'items' },
          async () => {
            const updated = await fetchItemsFromCloud();
            if (updated && updated.length > 0) {
              setItems(updated);
              StorageCache.saveCachedItems(updated);
            }
          }
        )
        .subscribe();

      return () => {
        if (supabase) {
          supabase.removeChannel(channel);
        }
      };
    }
  }, []);

  // Sprawdzanie czy wystawka wygasła (TTL = 6 godzin od wystawienia lub ostatniego potwierdzenia)
  const isItemActive = (item: PostItem): boolean => {
    if (item.status !== 'active') return false;
    if (item.type === 'wystawka') {
      const expiry = item.expiresAt
        ? new Date(item.expiresAt).getTime()
        : new Date(item.createdAt).getTime() + 6 * 60 * 60 * 1000;
      if (Date.now() > expiry) {
        return false;
      }
    }
    return true;
  };

  // Filter items (status + type + search query + TTL + distance)
  const filteredItems = items.filter((item) => {
    if (!isItemActive(item)) return false;
    if (filterType !== 'all' && item.type !== filterType) return false;

    if (maxDistanceKm > 0 && userCoords) {
      const dist = calculateDistance(userCoords.latitude, userCoords.longitude, item.location.latitude, item.location.longitude).value;
      if (dist > maxDistanceKm) return false;
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchAddress = item.location.address?.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchCategory || matchAddress;
    }

    return true;
  });

  // Sort list view items by distance or date
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortMode === 'nearest' && userCoords) {
      const distA = calculateDistance(userCoords.latitude, userCoords.longitude, a.location.latitude, a.location.longitude).value;
      const distB = calculateDistance(userCoords.latitude, userCoords.longitude, b.location.latitude, b.location.longitude).value;
      return distA - distB;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const itemsInRadiusCount = items.filter((item) => {
    if (!isItemActive(item)) return false;
    if (userCoords && neighborhoodSettings.radiusKm < 50) {
      const dist = calculateDistance(userCoords.latitude, userCoords.longitude, item.location.latitude, item.location.longitude).value;
      return dist <= neighborhoodSettings.radiusKm;
    }
    return true;
  }).length;

  const wystawkaCount = items.filter((i) => isItemActive(i) && i.type === 'wystawka').length;
  const oddamCount = items.filter((i) => isItemActive(i) && i.type === 'oddam').length;

  // Handlers
  const handleAddItem = (newItem: PostItem) => {
    setItems((prev) => [newItem, ...prev]);
    setSelectedMapItem(newItem);
    setDetailItem(newItem);
    // Zapis w chmurze
    insertItemToCloud(newItem);
    StorageCache.recordPostCreated().then((s) => setEcoStats(s)).catch(() => {});
  };

  const handleVoteStillThere = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          // Każde potwierdzenie "Jeszcze stoi" przedłuża widoczność wystawki o kolejne 2 godziny
          const currentExpiry = it.expiresAt ? new Date(it.expiresAt).getTime() : Date.now();
          const extendedExpiry = new Date(Math.max(currentExpiry, Date.now()) + 2 * 60 * 60 * 1000).toISOString();
          return {
            ...it,
            stillThereVotes: it.stillThereVotes + 1,
            takenVotes: 0, // Reset zgłoszeń o zabraniu po potwierdzeniu obecności
            expiresAt: extendedExpiry,
          };
        }
        return it;
      })
    );
    if (detailItem && detailItem.id === itemId) {
      setDetailItem((prev) => {
        if (!prev) return null;
        const currentExpiry = prev.expiresAt ? new Date(prev.expiresAt).getTime() : Date.now();
        const extendedExpiry = new Date(Math.max(currentExpiry, Date.now()) + 2 * 60 * 60 * 1000).toISOString();
        return {
          ...prev,
          stillThereVotes: prev.stillThereVotes + 1,
          takenVotes: 0,
          expiresAt: extendedExpiry,
        };
      });
    }
    voteStillThereInCloud(itemId);
    Alert.alert('Super! 👍', 'Potwierdziłeś obecność wystawki. Przedłużono jej czas widoczności o 2 godziny!');
  };

  const handleVoteTaken = async (itemId: string) => {
    let result: { newStatus: 'active' | 'taken'; takenVotes: number } = { newStatus: 'active', takenVotes: 1 };
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const newVotes = it.takenVotes + 1;
          const newStatus: 'active' | 'taken' = newVotes >= 2 ? 'taken' : 'active';
          result = { newStatus, takenVotes: newVotes };
          return { ...it, takenVotes: newVotes, status: newStatus };
        }
        return it;
      })
    );

    if (detailItem && detailItem.id === itemId) {
      setDetailItem((prev) =>
        prev
          ? {
              ...prev,
              takenVotes: prev.takenVotes + 1,
              status: prev.takenVotes + 1 >= 2 ? 'taken' : prev.status,
            }
          : null
      );
    }

    try {
      await voteTakenInCloud(itemId);
    } catch (e) {}

    if (result.newStatus === 'taken') {
      StorageCache.recordRescue().then((s) => setEcoStats(s)).catch(() => {});
      Alert.alert(
        'Ogłoszenie zarchiwizowane 📦',
        'Drugie niezależne potwierdzenie zabrania! Przedmiot został usunięty z mapy i listy.'
      );
    } else {
      Alert.alert(
        'Dziękujemy za zgłoszenie! ⚠️',
        'Oznaczono jako „Prawdopodobnie zabrane (1/2)”. Kolejne potwierdzenie od innego sąsiada zarchiwizuje ogłoszenie.'
      );
    }
  };

  // Handlers dla Tablicy Ogłoszeń
  const handleAddBoardPost = (newPost: BoardPost) => {
    setBoardPosts((prev) => [newPost, ...prev]);
  };

  const handleLikeBoardPost = (postId: string) => {
    setBoardPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likesCount: p.likesCount + 1 } : p
      )
    );
  };

  // Handlers dla Zapisanych (Gwiazdka)
  const handleToggleSaveItem = (itemId: string) => {
    setSavedItemIds((prev) => {
      const next = prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      StorageCache.saveSavedIds(next);
      return next;
    });
  };

  const handleToggleSaveBoardPost = (postId: string) => {
    setSavedBoardPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  const handleLoginProvider = async (provider: AuthProvider, customName?: string, customEmail?: string) => {
    const user = await AuthService.signInWithProvider(provider, customName, customEmail);
    setCurrentUser(user);
    setIsLoginModalVisible(false);
  };

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsLoginModalVisible(false);
  };

  const handleContinueAsGuest = async () => {
    await AuthService.continueAsGuest();
    setIsLoginModalVisible(false);
  };

  const handleSignOut = async () => {
    await AuthService.signOut();
    setCurrentUser(null);
    Alert.alert(
      'Wylogowano',
      'Przełączono do trybu Gościa. Możesz przeglądać i dodawać wystawki bez konta.'
    );
  };

  const handleOpenChat = (item: PostItem | null) => {
    if (!item) return;
    setChatItem(item);
    if (currentUser) {
      setIsChatModalVisible(true);
    } else {
      Alert.alert(
        'Wymagane logowanie 💬',
        'Konta w aplikacji służą do bezpiecznego pisania i odbierania wiadomości o wystawkach.\n\nCzy chcesz się teraz zarejestrować lub zalogować przez Apple, Google, Facebook lub adres e-mail?',
        [
          { text: 'Zarejestruj / Zaloguj', onPress: () => setIsLoginModalVisible(true) },
          { text: 'Kontynuuj jako Gość', style: 'cancel' },
        ]
      );
    }
  };

  // Obsługa samouczka krok po kroku
  const handleNextTutorialStep = async () => {
    if (tutorialStepIndex === null) return;
    const nextIdx = tutorialStepIndex + 1;
    if (nextIdx >= TUTORIAL_STEPS.length) {
      setTutorialStepIndex(null);
      await StorageCache.setTutorialCompleted(true);
    } else {
      if (nextIdx <= 3 && viewMode !== 'home') {
        setViewMode('home');
      }
      setTutorialStepIndex(nextIdx);
    }
  };

  const handleDismissTutorial = async () => {
    setTutorialStepIndex(null);
    await StorageCache.setTutorialCompleted(true);
  };

  const handleRestartTutorial = async () => {
    setViewMode('home');
    setTutorialStepIndex(0);
    await StorageCache.setTutorialCompleted(false);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />

        {/* Pomarańczowy pasek informacyjny w stylu Yanosik */}
        {showBetaNotice && (
          <View style={styles.orangeBanner}>
            <TouchableOpacity
              style={styles.bannerCloseBtn}
              onPress={() => setShowBetaNotice(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.bannerText}>
              to jest wersja beta, może zawierać błędy, z dnia na dzień staramy się ulepszać aplikację, prosimy o wyrozumiałość :)
            </Text>
            <TouchableOpacity
              style={styles.bannerChevronBtn}
              onPress={() => setShowBetaNotice(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Top Header & Filters (widoczne poza pulpitem głównym) */}
        {viewMode !== 'home' && (
          <Header
            filterType={filterType}
            onSelectFilter={setFilterType}
            viewMode={viewMode}
            wystawkaCount={wystawkaCount}
            oddamCount={oddamCount}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onGoBackToHome={() => setViewMode('home')}
            isDark={false}
          />
        )}

        {/* Main Content: Home Dashboard, Map, List, Board or Saved */}
        <View style={styles.content}>
          {viewMode === 'home' ? (
            <YanosikDashboard
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenMap={() => setViewMode('map')}
              onOpenList={(type) => {
                if (type) setFilterType(type);
                setViewMode('list');
              }}
              onOpenSaved={() => setViewMode('saved')}
              onOpenBoard={() => setViewMode('board')}
              onAddNew={() => setIsAddModalVisible(true)}
              onOpenDetail={(item) => setDetailItem(item)}
              savedCount={savedItemIds.length + savedBoardPostIds.length}
              wystawkaCount={wystawkaCount}
              oddamCount={oddamCount}
              recentItems={items}
              usersCount={128}
              ecoStats={ecoStats}
              streakDays={streakDays}
              neighborhoodSettings={neighborhoodSettings}
              onOpenNeighborhoodModal={() => setIsNeighborhoodModalVisible(true)}
              onChangeRadius={(val) => {
                const updated: NeighborhoodSettings = {
                  ...neighborhoodSettings,
                  radiusKm: val,
                  label: val >= 20 ? 'Całe miasto' : `Promień ${val} km`,
                };
                setNeighborhoodSettings(updated);
                StorageCache.saveNeighborhoodSettings(updated);
              }}
              currentUser={currentUser}
              onOpenLogin={() => setIsLoginModalVisible(true)}
              onSignOut={handleSignOut}
              isDark={false}
              tutorialStepIndex={tutorialStepIndex}
              onNextTutorialStep={handleNextTutorialStep}
              onDismissTutorial={handleDismissTutorial}
              onRestartTutorial={handleRestartTutorial}
            />
          ) : viewMode === 'map' ? (
            <MapViewTab
              items={filteredItems}
              userCoords={userCoords}
              selectedItem={selectedMapItem}
              onSelectItem={setSelectedMapItem}
              onOpenDetail={(item) => setDetailItem(item)}
              usersCount={128}
              themeMode="light"
              isDark={false}
              onRecenterGPS={async () => {
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Brak uprawnień GPS', 'Włącz dostęp do lokalizacji w ustawieniach telefonu.');
                    return;
                  }
                  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                  setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                } catch (e) {
                  Alert.alert('Błąd lokalizacji', 'Nie udało się ustalić pozycji GPS. Upewnij się, że usługa lokalizacji jest włączona w telefonie.');
                }
              }}
            />
          ) : viewMode === 'list' ? (
            <FlatList
              data={sortedItems}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <View style={styles.listFiltersContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterPillsScroll}
                  >
                      {/* Sortowanie: Najbliżej */}
                      <TouchableOpacity
                        style={[styles.filterPill, sortMode === 'nearest' && styles.filterPillActive]}
                        onPress={() => setSortMode('nearest')}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name="map-marker-distance"
                          size={14}
                          color={sortMode === 'nearest' ? '#FFFFFF' : '#475569'}
                        />
                        <Text
                          style={[
                            styles.filterPillText,
                            sortMode === 'nearest' && styles.filterPillTextActive,
                          ]}
                        >
                          Najbliżej
                        </Text>
                      </TouchableOpacity>

                      {/* Sortowanie: Najnowsze */}
                      <TouchableOpacity
                        style={[styles.filterPill, sortMode === 'newest' && styles.filterPillActive]}
                        onPress={() => setSortMode('newest')}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={14}
                          color={sortMode === 'newest' ? '#FFFFFF' : '#475569'}
                        />
                        <Text
                          style={[
                            styles.filterPillText,
                            sortMode === 'newest' && styles.filterPillTextActive,
                          ]}
                        >
                          Najnowsze
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.filterPillsDivider} />

                      {/* Filtr odległości */}
                      {[
                        { label: 'Wszystkie km', val: 0 },
                        { label: '< 1 km', val: 1 },
                        { label: '< 3 km', val: 3 },
                        { label: '< 5 km', val: 5 },
                      ].map((distOpt) => (
                        <TouchableOpacity
                          key={distOpt.val}
                          style={[
                            styles.filterPill,
                            maxDistanceKm === distOpt.val && styles.filterPillActive,
                          ]}
                          onPress={() => setMaxDistanceKm(distOpt.val)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              maxDistanceKm === distOpt.val && styles.filterPillTextActive,
                            ]}
                          >
                            {distOpt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
              }
              renderItem={({ item }) => (
                <ItemCard
                  item={item}
                  userCoords={userCoords}
                  onPress={() => setDetailItem(item)}
                  isSaved={savedItemIds.includes(item.id)}
                  onToggleSave={() => handleToggleSaveItem(item.id)}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons 
                    name={searchQuery ? 'file-search-outline' : 'emoticon-sad-outline'} 
                    size={48} 
                    color="#94A3B8" 
                  />
                  <Text style={styles.emptyTitle}>
                    {searchQuery 
                      ? `Brak wyników dla „${searchQuery}”`
                      : 'Brak ogłoszeń w tej kategorii'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {searchQuery
                      ? 'Spróbuj wpisać inną frazę lub wyczyść pasek wyszukiwania.'
                      : 'Bądź pierwszy i dodaj znalezisko z ulicy!'}
                  </Text>
                  {searchQuery ? (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      style={{
                        marginTop: 12,
                        backgroundColor: '#F1F5F9',
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.text }}>
                        Wyczyść wyszukiwanie
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              }
            />
          ) : viewMode === 'board' ? (
            <BoardTab
              posts={boardPosts}
              searchQuery={searchQuery}
              onLikeToggle={handleLikeBoardPost}
              onOpenAddPost={() => setIsAddBoardModalVisible(true)}
              savedPostIds={savedBoardPostIds}
              onToggleSavePost={handleToggleSaveBoardPost}
            />
          ) : (
            <SavedTab
              savedItems={items.filter((i) => savedItemIds.includes(i.id))}
              savedBoardPosts={boardPosts.filter((p) => savedBoardPostIds.includes(p.id))}
              userCoords={userCoords}
              onOpenItemDetail={(item) => setDetailItem(item)}
              onToggleSaveItem={handleToggleSaveItem}
              onToggleSavePost={handleToggleSaveBoardPost}
              onExplore={() => setViewMode('map')}
            />
          )}
        </View>

        {/* Dolny panel: Wyeksponowany Hero Button Dodawania ZNALEZISKA + 5 Zakładek */}
        <View style={styles.bottomNavWrapper} pointerEvents="box-none">
          {/* SAMOUCZEK - Krok 1 (Aparat): Zastępuje dawną statyczną chmurkę */}
          {tutorialStepIndex === 0 && (
            <View style={styles.tutorialStep0Container} pointerEvents="box-none">
              <TutorialTooltip
                {...TUTORIAL_STEPS[0]}
                onNext={handleNextTutorialStep}
                onDismiss={handleDismissTutorial}
              />
            </View>
          )}

          {/* SAMOUCZEK - Krok 5 (Tablica ogłoszeń): Wskazuje zakładkę Tablica */}
          {tutorialStepIndex === 4 && (
            <View style={styles.tutorialStep4Container} pointerEvents="box-none">
              <TutorialTooltip
                {...TUTORIAL_STEPS[4]}
                isLastStep={true}
                onNext={handleNextTutorialStep}
                onDismiss={handleDismissTutorial}
              />
            </View>
          )}

          {/* Domyślna chmurka tablicy, gdy samouczek jest nieaktywny */}
          {tutorialStepIndex === null && viewMode === 'board' && !isBoardTooltipDismissed && (
            <View style={styles.tooltipBubbleContainer} pointerEvents="box-none">
              <View
                style={[
                  styles.tooltipBubble,
                  styles.tooltipBubbleBoard,
                ]}
              >
                <MaterialCommunityIcons
                  name="comment-text-outline"
                  size={15}
                  color="#38BDF8"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.tooltipText}>
                  Dodawaj ogłoszenia sąsiedzkie i pytaj o pomoc
                </Text>
                <TouchableOpacity
                  style={styles.tooltipCloseBtn}
                  onPress={() => setIsBoardTooltipDismissed(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="close" size={14} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              {/* Strzałka chmurki skierowana w dół ku przyciskowi */}
              <View
                style={[
                  styles.tooltipArrow,
                  styles.tooltipArrowBoard,
                ]}
              />
            </View>
          )}

          {/* Wyeksponowany Przycisk ze szmaragdowym gradientem i powiększoną ikoną */}
          <TouchableOpacity
            style={[
              styles.heroAddButtonWrapper,
              tutorialStepIndex === 0 && styles.heroAddButtonHighlighted,
            ]}
            onPress={() => {
              if (viewMode === 'board') {
                setIsAddBoardModalVisible(true);
              } else {
                setIsAddModalVisible(true);
              }
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={viewMode === 'board' ? ['#38BDF8', '#0284C7'] : ['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroAddButton}
            >
              <MaterialCommunityIcons
                name={viewMode === 'board' ? 'pencil-plus' : 'camera-plus'}
                size={32}
                color="#FFFFFF"
              />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.modernBottomBar}>
            {NAV_TABS.map((tab) => {
              const isActive = viewMode === tab.id;
              const badgeCount = tab.id === 'saved' ? savedItemIds.length + savedBoardPostIds.length : 0;

              if (isActive) {
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.navTabPill,
                      tab.id === 'board' && tutorialStepIndex === 4 && styles.highlightedBoardTab,
                    ]}
                    onPress={() => {
                      if (viewMode !== tab.id) {
                        try {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        } catch {}
                        setViewMode(tab.id);
                      }
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: true }}
                    accessibilityLabel={`${tab.label}, aktywna zakładka`}
                  >
                    <LinearGradient
                      colors={tab.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.navTabPillGradientCircle}
                    >
                      <MaterialCommunityIcons name={tab.activeIcon} size={19} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.navTabPillText}>
                      {tab.label.toUpperCase()}
                    </Text>
                    {badgeCount > 0 && (
                      <View style={styles.navStarBadgePill}>
                        <Text style={styles.navStarBadgeText}>{badgeCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.navTabCircle,
                    tab.id === 'board' && tutorialStepIndex === 4 && styles.highlightedBoardTab,
                  ]}
                  onPress={() => {
                    if (viewMode !== tab.id) {
                      try {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      } catch {}
                      setViewMode(tab.id);
                    }
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: false }}
                  accessibilityLabel={tab.label}
                >
                  <MaterialCommunityIcons
                    name={tab.inactiveIcon}
                    size={21}
                    color="#64748B"
                  />
                  {badgeCount > 0 && (
                    <View style={styles.navStarBadgeCircle}>
                      <Text style={styles.navStarBadgeText}>{badgeCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Modals */}
        <AddItemModal
          visible={isAddModalVisible}
          onClose={() => setIsAddModalVisible(false)}
          onAddItem={handleAddItem}
          userCoords={userCoords}
        />

        <AddBoardPostModal
          visible={isAddBoardModalVisible}
          onClose={() => setIsAddBoardModalVisible(false)}
          onAddPost={handleAddBoardPost}
        />

        <ItemDetailModal
          item={detailItem}
          visible={!!detailItem}
          onClose={() => setDetailItem(null)}
          userCoords={userCoords}
          onVoteStillThere={handleVoteStillThere}
          onVoteTaken={handleVoteTaken}
          isSaved={detailItem ? savedItemIds.includes(detailItem.id) : false}
          onToggleSave={() => detailItem && handleToggleSaveItem(detailItem.id)}
          currentUser={currentUser}
          onOpenChat={() => handleOpenChat(detailItem)}
        />

        <NeighborhoodModal
          visible={isNeighborhoodModalVisible}
          onClose={() => setIsNeighborhoodModalVisible(false)}
          settings={neighborhoodSettings}
          onSaveSettings={async (newSettings) => {
            setNeighborhoodSettings(newSettings);
            await StorageCache.saveNeighborhoodSettings(newSettings);
          }}
          itemsInRadiusCount={itemsInRadiusCount}
        />

        {/* Modal Logowania / Rejestracji (Apple, Google, Facebook, E-mail + Tryb Gość) */}
        <LoginScreenModal
          visible={isLoginModalVisible}
          onClose={() => setIsLoginModalVisible(false)}
          onLoginProvider={handleLoginProvider}
          onLoginSuccess={handleLoginSuccess}
          onContinueAsGuest={handleContinueAsGuest}
        />

        {/* Modal czatu sąsiedzkiego o wystawce */}
        <ItemChatModal
          visible={isChatModalVisible}
          onClose={() => setIsChatModalVisible(false)}
          item={chatItem}
          currentUser={currentUser}
          onOpenLogin={() => setIsLoginModalVisible(true)}
        />

        {/* Ekran powitalny (Splash Screen - 5 sekund z możliwością wcześniejszego zamknięcia przyciskiem X) */}
        <Modal
          visible={showWelcome}
          animationType="fade"
          transparent={false}
          onRequestClose={checkAuthAfterSplash}
        >
          <View style={styles.welcomeContainer}>
            <Image
              source={require('./src/assets/welcome_splash.webp')}
              style={styles.welcomeImage}
              resizeMode="contain"
            />
            <SafeAreaView style={styles.welcomeSafeArea} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.welcomeCloseBtn}
                onPress={checkAuthAfterSplash}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0B0F19',
  },
  orangeBanner: {
    backgroundColor: THEME.orange,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E08000',
    zIndex: 50,
  },
  bannerCloseBtn: {
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerText: {
    flex: 1,
    fontFamily: APP_FONT,
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  bannerChevronBtn: {
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentDark: {
    backgroundColor: '#0B0F19',
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 110, // Zoptymalizowana przestrzeń pod nowoczesny dolny pasek nawigacyjny
  },
  listFiltersContainer: {
    marginBottom: 12,
  },
  filterPillsScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillsDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },
  adBannerCard: {
    height: 86,
    backgroundColor: '#012026',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#032B33',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBannerImage: {
    width: '100%',
    height: '100%',
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 22 : 16,
    left: 8,
    right: 8,
    zIndex: 30,
    alignItems: 'center',
  },
  modernBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(241, 245, 249, 0.72)',
    borderRadius: 30,
    paddingVertical: 5,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  modernBottomBarDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderColor: 'rgba(51, 65, 85, 0.6)',
  },
  navTabCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
  },
  navTabCircleDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  navTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    paddingLeft: 4,
    paddingRight: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
  },
  navTabPillDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  navTabPillGradientCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabPillText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.7,
    marginLeft: 7,
  },
  navTabPillTextDark: {
    color: '#F8FAFC',
  },
  navStarBadgeCircle: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: THEME.starYellow,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  navStarBadgePill: {
    marginLeft: 6,
    backgroundColor: THEME.starYellow,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tooltipBubbleContainer: {
    alignItems: 'center',
    marginBottom: 6,
    maxWidth: '92%',
  },
  tooltipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipBubbleGeneral: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#059669',
  },
  tooltipBubbleBoard: {
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  tooltipText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
    lineHeight: 16,
  },
  tooltipCloseBtn: {
    marginLeft: 8,
    padding: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
  },
  tooltipArrowGeneral: {
    borderTopColor: '#059669',
  },
  tooltipArrowBoard: {
    borderTopColor: '#0284C7',
  },
  tutorialStep0Container: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
    zIndex: 100,
  },
  tutorialStep4Container: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
    zIndex: 100,
  },
  heroAddButtonHighlighted: {
    transform: [{ scale: 1.08 }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 14,
  },
  highlightedBoardTab: {
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 24,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  heroAddButtonWrapper: {
    marginBottom: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  heroAddButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroAddButtonBoard: {
    borderColor: '#FFFFFF',
  },
  navStarBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: THEME.starYellow,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  navStarBadgeText: {
    fontFamily: APP_FONT,
    color: '#78350F',
    fontSize: 8.5,
    fontWeight: '900',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#021e26', // Dopasowane tło grafiki powitalnej
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeImage: {
    width: '100%',
    height: '100%',
  },
  welcomeSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  welcomeCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(2, 30, 38, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
});
