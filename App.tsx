import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  Text,
  Alert,
  Image,
  Modal,
  ScrollView,
  Platform,
  LayoutAnimation,
  UIManager,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

import {
  PostItem,
  ItemType,
  BoardPost,
  UserProfile,
  AuthProvider,
  SyncAction,
} from './src/types';
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
import { CityPickerModal } from './src/components/CityPickerModal';
import { SpotlightBackground } from './src/components/SpotlightBackground';
import { LoginScreenModal } from './src/components/LoginScreenModal';
import { ItemChatModal } from './src/components/ItemChatModal';
import { AdminPanelModal } from './src/components/AdminPanelModal';
import { CityOption } from './src/constants/cities';
import { BannerSlotId } from './src/constants/banners';
import { calculateDistance } from './src/utils/helpers';
import { AuthService } from './src/services/authService';
import { BoardRepository, CloudBoardRow, mapCloudRowToBoardPost } from './src/services/boardRepository';
import { useAndroidBackHandler } from './src/hooks/useAndroidBackHandler';
import { useDeepLinks } from './src/hooks/useDeepLinks';
import { STRINGS_PL } from './src/i18n/pl';
import { TutorialTooltip } from './src/components/TutorialTooltip';
import { TUTORIAL_STEPS } from './src/constants/tutorialSteps';
import {
  StorageCache,
  EcoStats,
  NeighborhoodSettings,
  AdminSettings,
  DEFAULT_ADMIN_SETTINGS,
  clampNeighborhoodRadius,
  getNeighborhoodLabel,
  isDistanceInNeighborhood,
} from './src/services/storageCache';
import {
  CloudItemRow,
  mapCloudRowToPostItem,
  fetchItemsFromCloud,
  insertItemToCloud,
  voteStillThereInCloud,
  voteTakenInCloud,
  restoreItemInCloud,
  archiveItemInCloud,
  deleteItemFromCloud,
  resetItemFlagsInCloud,
  updateItemInCloud,
  isSupabaseConfigured,
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
  const [likedBoardPostIds, setLikedBoardPostIds] = useState<string[]>([]);
  const [isCloudRefreshing, setIsCloudRefreshing] = useState(false);
  const [cloudLoadError, setCloudLoadError] = useState<string | null>(null);
  const [pendingDeepLinkItemId, setPendingDeepLinkItemId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | ItemType>('all');
  const [viewMode, setViewMode] = useState<'home' | 'map' | 'list' | 'board' | 'saved'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>({
    latitude: 51.2465,
    longitude: 22.5684,
  });
  const [gpsCityName, setGpsCityName] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
  const [isCityModalVisible, setIsCityModalVisible] = useState(false);

  const userCoords = selectedCity
    ? { latitude: selectedCity.latitude, longitude: selectedCity.longitude }
    : gpsCoords;
  const [showBetaNotice, setShowBetaNotice] = useState(true);
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
    scope: 'radius',
    alertsEnabled: true,
    label: 'Mój rewir (2 km)',
  });
  const [isNeighborhoodModalVisible, setIsNeighborhoodModalVisible] = useState(false);

  // Autoryzacja i konta (Apple, Google, Facebook) + Tryb Gość + Panel Admina
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [isChatModalVisible, setIsChatModalVisible] = useState(false);
  const [chatItem, setChatItem] = useState<PostItem | null>(null);

  const checkAuthAfterSplash = async () => {
    setShowWelcome(false);
    try {
      const aSettings = await StorageCache.getAdminSettings();
      if (!aSettings.accountsEnabled) return;
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

  // Okresowy znacznik czasu do czystego sprawdzania wygaśnięcia wystawek (6h TTL)
  const [nowTimestamp, setNowTimestamp] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Modals state
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isAddBoardModalVisible, setIsAddBoardModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<PostItem | null>(null);
  const [selectedMapItem, setSelectedMapItem] = useState<PostItem | null>(null);
  const itemsRef = useRef<PostItem[]>(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const flushPendingSyncQueue = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const queue = await StorageCache.getPendingSyncQueue();
    if (queue.length === 0) return;

    const voterKey = await StorageCache.getVoterKey();
    const remaining: SyncAction[] = [];

    for (const action of queue) {
      let shouldRetryLater = false;
      try {
        if (action.kind === 'insert_item') {
          const res = await insertItemToCloud(action.payload);
          shouldRetryLater = !res.ok && res.error.code === 'NETWORK';
        } else if (action.kind === 'vote_still_there') {
          const res = await voteStillThereInCloud(action.itemId, voterKey);
          shouldRetryLater = !res.ok && res.error.code === 'NETWORK';
        } else if (action.kind === 'vote_taken') {
          const res = await voteTakenInCloud(action.itemId, voterKey);
          shouldRetryLater = !res.ok && res.error.code === 'NETWORK';
        } else if (action.kind === 'insert_board_post') {
          const res = await BoardRepository.insert(action.payload);
          shouldRetryLater = !res.ok && res.error.code === 'NETWORK';
        } else if (action.kind === 'toggle_board_like') {
          const res = await BoardRepository.toggleLike(action.postId, voterKey);
          shouldRetryLater = !res.ok && res.error.code === 'NETWORK';
        }
      } catch {
        shouldRetryLater = true;
      }

      if (shouldRetryLater) {
        remaining.push(action);
      }
    }

    await StorageCache.replacePendingSyncQueue(remaining);
  }, []);

  const syncFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCloudLoadError(null);
      return;
    }

    await flushPendingSyncQueue();

    const [itemsRes, boardRes] = await Promise.all([
      fetchItemsFromCloud(),
      BoardRepository.fetchAll(),
    ]);

    if (itemsRes.ok) {
      setCloudLoadError(null);
      if (itemsRes.data.length > 0) {
        setItems(itemsRes.data);
        StorageCache.saveCachedItems(itemsRes.data);
      }
    } else if (itemsRes.error.code === 'NETWORK') {
      setCloudLoadError(itemsRes.error.message);
    }

    if (boardRes.ok && boardRes.data.length > 0) {
      setBoardPosts(boardRes.data);
      StorageCache.saveCachedBoardPosts(boardRes.data);
    }
  }, [flushPendingSyncQueue]);

  const handleRefreshCloud = useCallback(async () => {
    setIsCloudRefreshing(true);
    try {
      await syncFromCloud();
    } finally {
      setIsCloudRefreshing(false);
    }
  }, [syncFromCloud]);

  const handleOpenItemById = useCallback((itemId: string) => {
    const found = itemsRef.current.find((it) => it.id === itemId);
    if (found) {
      setDetailItem(found);
      setViewMode('list');
    } else {
      setPendingDeepLinkItemId(itemId);
    }
  }, []);

  useDeepLinks(handleOpenItemById);

  useEffect(() => {
    if (!pendingDeepLinkItemId) return;
    const found = items.find((it) => it.id === pendingDeepLinkItemId);
    if (found) {
      setDetailItem(found);
      setViewMode('list');
      setPendingDeepLinkItemId(null);
    }
  }, [items, pendingDeepLinkItemId]);

  const handleHardwareBack = useCallback((): boolean => {
    if (showWelcome) {
      setShowWelcome(false);
      return true;
    }
    if (isAdminModalVisible) {
      setIsAdminModalVisible(false);
      return true;
    }
    if (isChatModalVisible) {
      setIsChatModalVisible(false);
      return true;
    }
    if (isLoginModalVisible) {
      setIsLoginModalVisible(false);
      return true;
    }
    if (isCityModalVisible) {
      setIsCityModalVisible(false);
      return true;
    }
    if (isNeighborhoodModalVisible) {
      setIsNeighborhoodModalVisible(false);
      return true;
    }
    if (isAddModalVisible) {
      setIsAddModalVisible(false);
      return true;
    }
    if (isAddBoardModalVisible) {
      setIsAddBoardModalVisible(false);
      return true;
    }
    if (detailItem) {
      setDetailItem(null);
      return true;
    }
    if (viewMode !== 'home') {
      setViewMode('home');
      return true;
    }
    return false;
  }, [
    showWelcome,
    isAdminModalVisible,
    isChatModalVisible,
    isLoginModalVisible,
    isCityModalVisible,
    isNeighborhoodModalVisible,
    isAddModalVisible,
    isAddBoardModalVisible,
    detailItem,
    viewMode,
  ]);

  useAndroidBackHandler(handleHardwareBack);

  // Request GPS, load offline cache and fetch cloud data on startup
  useEffect(() => {
    let isMounted = true;

    (async () => {
      // 0. Ładowanie pamięci podręcznej (Offline Cache + migracja schematu)
      try {
        await StorageCache.ensureSchemaVersion();

        const [
          cached,
          cachedBoard,
          cachedSaved,
          cachedSavedBoard,
          cachedLikedBoard,
        ] = await Promise.all([
          StorageCache.getCachedItems(),
          StorageCache.getCachedBoardPosts(),
          StorageCache.getSavedIds(),
          StorageCache.getSavedBoardPostIds(),
          StorageCache.getLikedBoardPostIds(),
        ]);

        const [
          nSettings,
          savedCity,
          stats,
          activeStreak,
          aSettings,
          tutorialDone,
        ] = await Promise.all([
          StorageCache.getNeighborhoodSettings(),
          StorageCache.getSelectedCity(),
          StorageCache.getEcoStats(),
          StorageCache.recordDailyActivity(),
          StorageCache.getAdminSettings(),
          StorageCache.isTutorialCompleted(),
        ]);

        if (!isMounted) return;

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

        if (cachedBoard && cachedBoard.length > 0) {
          const cachedBoardIds = new Set(cachedBoard.map((p) => p.id));
          const newInitialPosts = INITIAL_BOARD_POSTS.filter((p) => !cachedBoardIds.has(p.id));
          const combinedBoard = [...newInitialPosts, ...cachedBoard];
          setBoardPosts(combinedBoard);
          StorageCache.saveCachedBoardPosts(combinedBoard);
        } else {
          setBoardPosts(INITIAL_BOARD_POSTS);
          StorageCache.saveCachedBoardPosts(INITIAL_BOARD_POSTS);
        }

        if (cachedSaved.length > 0) {
          setSavedItemIds(cachedSaved);
        }
        if (cachedSavedBoard.length > 0) {
          setSavedBoardPostIds(cachedSavedBoard);
        }
        if (cachedLikedBoard.length > 0) {
          setLikedBoardPostIds(cachedLikedBoard);
        }

        setNeighborhoodSettings(nSettings);
        if (savedCity) setSelectedCity(savedCity);
        setEcoStats(stats);
        setStreakDays(activeStreak);
        setAdminSettings(aSettings);
        setShowBetaNotice(aSettings.bannerEnabled);

        if (aSettings.accountsEnabled) {
          const profile = await AuthService.getUserProfile();
          if (isMounted && profile) {
            setCurrentUser(profile);
          }
        }
        if (!tutorialDone && isMounted) {
          setTutorialStepIndex(0);
        }
      } catch {
        // Pomijamy błąd cache
      }

      // 1. Pobieranie GPS
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const nextGps = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          if (!isMounted) return;
          setGpsCoords(nextGps);
          if (Platform.OS !== 'web') {
            try {
              const reverse = await Location.reverseGeocodeAsync(nextGps);
              if (reverse.length > 0 && isMounted) {
                const detectedCity = reverse[0].city || reverse[0].subregion || null;
                if (detectedCity) setGpsCityName(detectedCity);
              }
            } catch {
              // Ignorujemy błąd reverse geocodingu
            }
          }
        }
      } catch {
        if (isMounted) {
          setGpsCoords({ latitude: 51.2465, longitude: 22.5684 });
        }
      }

      // 2. Pobieranie świeżych ogłoszeń i tablicy z chmury Supabase
      if (isMounted) {
        await syncFromCloud();
      }
    })();

    // 3. Nasłuchiwanie przyrostowe (Realtime) dla ogłoszeń i tablicy
    if (supabase) {
      const channel = supabase
        .channel('public:smieciarka-feed')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'items' },
          (payload) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              const inserted = mapCloudRowToPostItem(payload.new as CloudItemRow);
              setItems((prev) => {
                if (prev.some((it) => it.id === inserted.id)) return prev;
                const next = [inserted, ...prev];
                StorageCache.saveCachedItems(next);
                return next;
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updatedItem = mapCloudRowToPostItem(payload.new as CloudItemRow);
              setItems((prev) => {
                const next = prev.map((it) => (it.id === updatedItem.id ? updatedItem : it));
                StorageCache.saveCachedItems(next);
                return next;
              });
              setDetailItem((prev) => (prev?.id === updatedItem.id ? updatedItem : prev));
            } else if (payload.eventType === 'DELETE' && payload.old) {
              const deletedId = (payload.old as { id?: string }).id;
              if (!deletedId) return;
              setItems((prev) => {
                const next = prev.filter((it) => it.id !== deletedId);
                StorageCache.saveCachedItems(next);
                return next;
              });
              setDetailItem((prev) => (prev?.id === deletedId ? null : prev));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'board_posts' },
          (payload) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              const insertedPost = mapCloudRowToBoardPost(payload.new as CloudBoardRow);
              setBoardPosts((prev) => {
                if (prev.some((p) => p.id === insertedPost.id)) return prev;
                const next = [insertedPost, ...prev];
                StorageCache.saveCachedBoardPosts(next);
                return next;
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updatedPost = mapCloudRowToBoardPost(payload.new as CloudBoardRow);
              setBoardPosts((prev) => {
                const next = prev.map((p) => (p.id === updatedPost.id ? updatedPost : p));
                StorageCache.saveCachedBoardPosts(next);
                return next;
              });
            } else if (payload.eventType === 'DELETE' && payload.old) {
              const deletedId = (payload.old as { id?: string }).id;
              if (!deletedId) return;
              setBoardPosts((prev) => {
                const next = prev.filter((p) => p.id !== deletedId);
                StorageCache.saveCachedBoardPosts(next);
                return next;
              });
            }
          }
        )
        .subscribe();

      return () => {
        isMounted = false;
        if (supabase) {
          supabase.removeChannel(channel);
        }
      };
    }

    return () => {
      isMounted = false;
    };
  }, [syncFromCloud]);

  // Sprawdzanie czy wystawka wygasła (TTL = 6 godzin od wystawienia lub ostatniego potwierdzenia)
  const isItemActive = (item: PostItem): boolean => {
    if (item.status !== 'active') return false;
    if (adminSettings.autoExpireEnabled && item.type === 'wystawka') {
      const expiry = item.expiresAt
        ? new Date(item.expiresAt).getTime()
        : new Date(item.createdAt).getTime() + 6 * 60 * 60 * 1000;
      if (nowTimestamp > expiry) {
        return false;
      }
    }
    return true;
  };

  const isAuthorBlocked = (authorName?: string): boolean => {
    if (!authorName) return false;
    const lower = authorName.trim().toLowerCase();
    return adminSettings.blockedAuthors.some((a) => a.toLowerCase() === lower);
  };

  const isItemVisible = (item: PostItem): boolean =>
    isItemActive(item) && !isAuthorBlocked(item.authorName);

  // Filter items (status + blocked authors + type + search query + TTL + distance)
  const filteredItems = items.filter((item) => {
    if (!isItemVisible(item)) return false;
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
    if (!isItemVisible(item)) return false;
    if (!userCoords) return true;
    const dist = calculateDistance(
      userCoords.latitude,
      userCoords.longitude,
      item.location.latitude,
      item.location.longitude
    ).value;
    return isDistanceInNeighborhood(dist, neighborhoodSettings);
  }).length;

  const wystawkaCount = items.filter((i) => isItemVisible(i) && i.type === 'wystawka').length;
  const oddamCount = items.filter((i) => isItemVisible(i) && i.type === 'oddam').length;

  const dashboardItems = [...items]
    .filter((i) => isItemVisible(i))
    .sort((a, b) => {
      if (!userCoords) return 0;
      const distA = calculateDistance(
        userCoords.latitude,
        userCoords.longitude,
        a.location.latitude,
        a.location.longitude
      ).value;
      const distB = calculateDistance(
        userCoords.latitude,
        userCoords.longitude,
        b.location.latitude,
        b.location.longitude
      ).value;
      return distA - distB;
    });

  const refreshGpsLocation = async (showPermissionAlerts: boolean) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (showPermissionAlerts) {
          Alert.alert('Brak uprawnień GPS', 'Włącz dostęp do lokalizacji w ustawieniach telefonu.');
        }
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const nextGps = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setGpsCoords(nextGps);
      if (Platform.OS !== 'web') {
        try {
          const reverse = await Location.reverseGeocodeAsync(nextGps);
          if (reverse.length > 0) {
            const detectedCity = reverse[0].city || reverse[0].subregion || null;
            if (detectedCity) setGpsCityName(detectedCity);
          }
        } catch {
          // Ignorujemy błąd reverse geocodingu
        }
      }
    } catch {
      if (showPermissionAlerts) {
        Alert.alert('Błąd lokalizacji', 'Nie udało się ustalić pozycji GPS. Upewnij się, że usługa lokalizacji jest włączona w telefonie.');
      }
    }
  };

  const handleSelectCity = (city: CityOption | null) => {
    setSelectedCity(city);
    setSelectedMapItem(null);
    StorageCache.saveSelectedCity(city);
    if (!city) {
      refreshGpsLocation(false);
    }
  };

  // Handlers
  const handleAddItem = async (newItem: PostItem): Promise<boolean> => {
    let itemToSave = newItem;
    if (isSupabaseConfigured) {
      const res = await insertItemToCloud(newItem);
      if (!res.ok) {
        if (res.error.code === 'UPLOAD' || res.error.code === 'VALIDATION') {
          Alert.alert('Nie można dodać ogłoszenia', res.error.message);
          return false;
        }
        if (res.error.code === 'NETWORK') {
          await StorageCache.enqueueSyncAction({
            id: `sync-item-${Date.now()}`,
            kind: 'insert_item',
            payload: newItem,
            createdAt: new Date().toISOString(),
          });
          Alert.alert(
            'Zapisano lokalnie 📶',
            'Brak zasięgu – ogłoszenie pojawiło się na Twoim urządzeniu i wyśle się automatycznie po odzyskaniu sieci.'
          );
        }
      } else {
        itemToSave = res.data;
      }
    }

    setItems((prev) => {
      const next = [itemToSave, ...prev];
      StorageCache.saveCachedItems(next);
      return next;
    });
    setSelectedMapItem(itemToSave);
    setDetailItem(itemToSave);
    StorageCache.recordPostCreated()
      .then((s) => setEcoStats(s))
      .catch(() => {});
    return true;
  };

  const handleVoteStillThere = async (itemId: string) => {
    const now = Date.now();
    setItems((prev) => {
      const next = prev.map((it) => {
        if (it.id === itemId) {
          const currentExpiry = it.expiresAt ? new Date(it.expiresAt).getTime() : now;
          const extendedExpiry = new Date(
            Math.max(currentExpiry, now) + 2 * 60 * 60 * 1000
          ).toISOString();
          return {
            ...it,
            stillThereVotes: it.stillThereVotes + 1,
            takenVotes: 0,
            expiresAt: extendedExpiry,
          };
        }
        return it;
      });
      StorageCache.saveCachedItems(next);
      return next;
    });

    if (detailItem && detailItem.id === itemId) {
      setDetailItem((prev) => {
        if (!prev) return null;
        const currentExpiry = prev.expiresAt ? new Date(prev.expiresAt).getTime() : now;
        const extendedExpiry = new Date(
          Math.max(currentExpiry, now) + 2 * 60 * 60 * 1000
        ).toISOString();
        return {
          ...prev,
          stillThereVotes: prev.stillThereVotes + 1,
          takenVotes: 0,
          expiresAt: extendedExpiry,
        };
      });
    }

    if (isSupabaseConfigured) {
      const voterKey = await StorageCache.getVoterKey();
      const res = await voteStillThereInCloud(itemId, voterKey);
      if (!res.ok && res.error.code === 'NETWORK') {
        await StorageCache.enqueueSyncAction({
          id: `sync-still-${Date.now()}`,
          kind: 'vote_still_there',
          itemId,
          createdAt: new Date().toISOString(),
        });
      }
    }

    Alert.alert(
      'Super! 👍',
      'Potwierdziłeś obecność wystawki. Przedłużono jej czas widoczności o 2 godziny!'
    );
  };

  const handleVoteTaken = async (itemId: string) => {
    let result: { newStatus: 'active' | 'taken'; takenVotes: number } = {
      newStatus: 'active',
      takenVotes: 1,
    };
    setItems((prev) => {
      const next = prev.map((it) => {
        if (it.id === itemId) {
          const newVotes = it.takenVotes + 1;
          const newStatus: 'active' | 'taken' = newVotes >= 2 ? 'taken' : 'active';
          result = { newStatus, takenVotes: newVotes };
          return { ...it, takenVotes: newVotes, status: newStatus };
        }
        return it;
      });
      StorageCache.saveCachedItems(next);
      return next;
    });

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

    if (isSupabaseConfigured) {
      const voterKey = await StorageCache.getVoterKey();
      const cloudRes = await voteTakenInCloud(itemId, voterKey);
      if (cloudRes.ok) {
        result = cloudRes.data;
        setItems((prev) => {
          const synced = prev.map((it) =>
            it.id === itemId
              ? { ...it, takenVotes: cloudRes.data.takenVotes, status: cloudRes.data.newStatus }
              : it
          );
          StorageCache.saveCachedItems(synced);
          return synced;
        });
      } else if (cloudRes.error.code === 'NETWORK') {
        await StorageCache.enqueueSyncAction({
          id: `sync-taken-${Date.now()}`,
          kind: 'vote_taken',
          itemId,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (result.newStatus === 'taken') {
      StorageCache.recordRescue()
        .then((s) => setEcoStats(s))
        .catch(() => {});
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
  const handleAddBoardPost = async (newPost: BoardPost) => {
    setBoardPosts((prev) => {
      const next = [newPost, ...prev];
      StorageCache.saveCachedBoardPosts(next);
      return next;
    });

    if (isSupabaseConfigured) {
      const res = await BoardRepository.insert(newPost);
      if (!res.ok && res.error.code === 'NETWORK') {
        await StorageCache.enqueueSyncAction({
          id: `sync-board-${Date.now()}`,
          kind: 'insert_board_post',
          payload: newPost,
          createdAt: new Date().toISOString(),
        });
      }
    }
  };

  const handleLikeBoardPost = async (postId: string) => {
    const alreadyLiked = likedBoardPostIds.includes(postId);
    const nextLikedIds = alreadyLiked
      ? likedBoardPostIds.filter((id) => id !== postId)
      : [...likedBoardPostIds, postId];

    setLikedBoardPostIds(nextLikedIds);
    StorageCache.saveLikedBoardPostIds(nextLikedIds);

    setBoardPosts((prev) => {
      const next = prev.map((p) => {
        if (p.id !== postId) return p;
        const delta = alreadyLiked ? -1 : 1;
        return { ...p, likesCount: Math.max(0, p.likesCount + delta) };
      });
      StorageCache.saveCachedBoardPosts(next);
      return next;
    });

    if (isSupabaseConfigured) {
      const voterKey = await StorageCache.getVoterKey();
      const res = await BoardRepository.toggleLike(postId, voterKey);
      if (res.ok) {
        setBoardPosts((prev) => {
          const synced = prev.map((p) =>
            p.id === postId ? { ...p, likesCount: res.data.likesCount } : p
          );
          StorageCache.saveCachedBoardPosts(synced);
          return synced;
        });
      } else if (res.error.code === 'NETWORK') {
        await StorageCache.enqueueSyncAction({
          id: `sync-like-${Date.now()}`,
          kind: 'toggle_board_like',
          postId,
          createdAt: new Date().toISOString(),
        });
      }
    }
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
    setSavedBoardPostIds((prev) => {
      const next = prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId];
      StorageCache.saveSavedBoardPostIds(next);
      return next;
    });
  };

  const handleLoginProvider = async (_provider: AuthProvider, _customName?: string, _customEmail?: string) => {
    const user = await AuthService.getUserProfile();
    if (user) {
      setCurrentUser(user);
      setIsLoginModalVisible(false);
    }
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
    if (!adminSettings.accountsEnabled || currentUser) {
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

  // Handlery Panelu Administratora
  const handleUpdateAdminSettings = (next: AdminSettings) => {
    setAdminSettings(next);
    setShowBetaNotice(next.bannerEnabled);
    StorageCache.saveAdminSettings(next);
  };

  const handleAdminRestoreItem = (itemId: string) => {
    const newExpiry = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    setItems((prev) => {
      const updated = prev.map((it) =>
        it.id === itemId
          ? { ...it, status: 'active' as const, takenVotes: 0, expiresAt: newExpiry }
          : it
      );
      StorageCache.saveCachedItems(updated);
      return updated;
    });
    if (detailItem?.id === itemId) {
      setDetailItem((prev) =>
        prev ? { ...prev, status: 'active', takenVotes: 0, expiresAt: newExpiry } : null
      );
    }
    restoreItemInCloud(itemId);
  };

  const handleAdminArchiveItem = (itemId: string) => {
    setItems((prev) => {
      const updated = prev.map((it) =>
        it.id === itemId ? { ...it, status: 'taken' as const } : it
      );
      StorageCache.saveCachedItems(updated);
      return updated;
    });
    if (detailItem?.id === itemId) {
      setDetailItem(null);
    }
    if (selectedMapItem?.id === itemId) {
      setSelectedMapItem(null);
    }
    archiveItemInCloud(itemId);
  };

  const handleAdminDeleteItem = (itemId: string) => {
    setItems((prev) => {
      const updated = prev.filter((it) => it.id !== itemId);
      StorageCache.saveCachedItems(updated);
      return updated;
    });
    setSavedItemIds((prev) => {
      const next = prev.filter((id) => id !== itemId);
      StorageCache.saveSavedIds(next);
      return next;
    });
    if (detailItem?.id === itemId) {
      setDetailItem(null);
    }
    if (selectedMapItem?.id === itemId) {
      setSelectedMapItem(null);
    }
    deleteItemFromCloud(itemId);
  };

  const handleAdminDeleteBoardPost = (postId: string) => {
    setBoardPosts((prev) => {
      const next = prev.filter((p) => p.id !== postId);
      StorageCache.saveCachedBoardPosts(next);
      return next;
    });
    setSavedBoardPostIds((prev) => {
      const next = prev.filter((id) => id !== postId);
      StorageCache.saveSavedBoardPostIds(next);
      return next;
    });
    if (isSupabaseConfigured) {
      BoardRepository.remove(postId).catch(() => {});
    }
  };

  const handleAdminUpdateItem = (updatedItem: PostItem) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === updatedItem.id ? updatedItem : it));
      StorageCache.saveCachedItems(next);
      return next;
    });
    if (detailItem?.id === updatedItem.id) {
      setDetailItem(updatedItem);
    }
    if (selectedMapItem?.id === updatedItem.id) {
      setSelectedMapItem(updatedItem);
    }
    updateItemInCloud(updatedItem);
  };

  const handleAdminResetItemFlags = (itemId: string) => {
    setItems((prev) => {
      const next = prev.map((it) =>
        it.id === itemId ? { ...it, takenVotes: 0, status: 'active' as const } : it
      );
      StorageCache.saveCachedItems(next);
      return next;
    });
    if (detailItem?.id === itemId) {
      setDetailItem((prev) => (prev ? { ...prev, takenVotes: 0, status: 'active' } : null));
    }
    resetItemFlagsInCloud(itemId);
  };

  const handleAdminBulkItemAction = (
    itemIds: string[],
    action: 'restore' | 'archive' | 'delete'
  ) => {
    const idSet = new Set(itemIds);
    const newExpiry = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    setItems((prev) => {
      const next =
        action === 'delete'
          ? prev.filter((it) => !idSet.has(it.id))
          : prev.map((it) => {
              if (!idSet.has(it.id)) return it;
              if (action === 'restore') {
                return { ...it, status: 'active' as const, takenVotes: 0, expiresAt: newExpiry };
              }
              return { ...it, status: 'taken' as const };
            });
      StorageCache.saveCachedItems(next);
      return next;
    });

    if (action === 'delete') {
      setSavedItemIds((prev) => {
        const next = prev.filter((id) => !idSet.has(id));
        StorageCache.saveSavedIds(next);
        return next;
      });
    }

    if (detailItem && idSet.has(detailItem.id)) {
      if (action === 'restore') {
        setDetailItem((prev) =>
          prev ? { ...prev, status: 'active', takenVotes: 0, expiresAt: newExpiry } : null
        );
      } else {
        setDetailItem(null);
      }
    }
    if (selectedMapItem && idSet.has(selectedMapItem.id) && action !== 'restore') {
      setSelectedMapItem(null);
    }

    for (const id of itemIds) {
      if (action === 'restore') restoreItemInCloud(id);
      else if (action === 'archive') archiveItemInCloud(id);
      else deleteItemFromCloud(id);
    }
  };

  const handleAdminUpdateBoardPost = (updatedPost: BoardPost) => {
    setBoardPosts((prev) => {
      const next = prev.map((p) => (p.id === updatedPost.id ? updatedPost : p));
      StorageCache.saveCachedBoardPosts(next);
      return next;
    });
  };

  const handleAdminToggleBlockAuthor = (authorName: string) => {
    const cleaned = authorName.trim();
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    const exists = adminSettings.blockedAuthors.some((a) => a.toLowerCase() === lower);
    const nextBlocked = exists
      ? adminSettings.blockedAuthors.filter((a) => a.toLowerCase() !== lower)
      : [...adminSettings.blockedAuthors, cleaned];
    handleUpdateAdminSettings({
      ...adminSettings,
      blockedAuthors: nextBlocked,
    });
  };

  const handleAdminUpdateBannerImage = (slotId: BannerSlotId, uri: string | null) => {
    const nextBanners = { ...adminSettings.customBanners };
    if (uri && uri.trim().length > 0) {
      nextBanners[slotId] = uri.trim();
    } else {
      delete nextBanners[slotId];
    }
    handleUpdateAdminSettings({
      ...adminSettings,
      customBanners: nextBanners,
    });
  };

  const handleAdminResetAllBanners = () => {
    handleUpdateAdminSettings({
      ...adminSettings,
      customBanners: {},
    });
  };

  const handleAdminPublishOfficialNotice = (title: string, content: string) => {
    const newPost: BoardPost = {
      id: `admin-notice-${Date.now()}`,
      title,
      content,
      tag: 'info',
      authorName: 'Administrator Śmieciarki',
      locationArea: selectedCity?.name || gpsCityName || 'Cała społeczność',
      createdAt: new Date().toISOString(),
      likesCount: 0,
    };
    setBoardPosts((prev) => {
      const next = [newPost, ...prev];
      StorageCache.saveCachedBoardPosts(next);
      return next;
    });
    if (isSupabaseConfigured) {
      BoardRepository.insert(newPost).catch(() => {});
    }
  };

  const handleAdminSyncCloud = async (): Promise<number> => {
    await flushPendingSyncQueue();
    const res = await fetchItemsFromCloud();
    if (res.ok) {
      setCloudLoadError(null);
      setItems(res.data);
      await StorageCache.saveCachedItems(res.data);
      return res.data.length;
    }
    return 0;
  };

  const handleAdminResetDemoData = () => {
    setItems(INITIAL_ITEMS);
    setBoardPosts(INITIAL_BOARD_POSTS);
    StorageCache.saveCachedItems(INITIAL_ITEMS);
    StorageCache.saveCachedBoardPosts(INITIAL_BOARD_POSTS);
  };

  const handleAdminClearCache = async () => {
    await StorageCache.clearCachedItems();
    setSavedItemIds([]);
    setSavedBoardPostIds([]);
    setLikedBoardPostIds([]);
    await StorageCache.saveSavedIds([]);
    await StorageCache.saveSavedBoardPostIds([]);
    await StorageCache.saveLikedBoardPostIds([]);
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
      <View style={styles.rootContainer}>
        <SpotlightBackground />
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
            <Text style={styles.bannerText}>{adminSettings.bannerText}</Text>
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
            adsEnabled={adminSettings.adsEnabled}
            customBanners={adminSettings.customBanners}
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
              recentItems={dashboardItems}
              usersCount={adminSettings.usersCount}
              ecoStats={ecoStats}
              streakDays={streakDays}
              neighborhoodSettings={neighborhoodSettings}
              selectedCity={selectedCity}
              gpsCityName={gpsCityName}
              onOpenCityPicker={() => setIsCityModalVisible(true)}
              userCoords={userCoords}
              onOpenNeighborhoodModal={() => setIsNeighborhoodModalVisible(true)}
              onChangeRadius={(val) => {
                const clamped = clampNeighborhoodRadius(val);
                const updated: NeighborhoodSettings = {
                  ...neighborhoodSettings,
                  radiusKm: clamped,
                  scope: 'radius',
                  label: getNeighborhoodLabel({
                    ...neighborhoodSettings,
                    radiusKm: clamped,
                    scope: 'radius',
                  }),
                };
                setNeighborhoodSettings(updated);
                StorageCache.saveNeighborhoodSettings(updated);
              }}
              onSelectNeighborhoodScope={(scope) => {
                const updated: NeighborhoodSettings = {
                  ...neighborhoodSettings,
                  scope,
                  label: getNeighborhoodLabel({
                    ...neighborhoodSettings,
                    scope,
                  }),
                };
                setNeighborhoodSettings(updated);
                StorageCache.saveNeighborhoodSettings(updated);
              }}
              currentUser={adminSettings.accountsEnabled ? currentUser : null}
              showAuthControls={adminSettings.accountsEnabled}
              adsEnabled={adminSettings.adsEnabled}
              customBanners={adminSettings.customBanners}
              onOpenAdmin={() => setIsAdminModalVisible(true)}
              onOpenLogin={adminSettings.accountsEnabled ? () => setIsLoginModalVisible(true) : undefined}
              onSignOut={adminSettings.accountsEnabled ? handleSignOut : undefined}
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
              usersCount={adminSettings.usersCount}
              themeMode="light"
              isDark={false}
              selectedCity={selectedCity}
              gpsCityName={gpsCityName}
              onOpenCityPicker={() => setIsCityModalVisible(true)}
              onRecenterGPS={async () => {
                handleSelectCity(null);
                await refreshGpsLocation(true);
              }}
            />
          ) : viewMode === 'list' ? (
            <FlatList
              data={sortedItems}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={isCloudRefreshing}
                  onRefresh={handleRefreshCloud}
                  tintColor={THEME.primary}
                  colors={[THEME.primary]}
                />
              }
              ListHeaderComponent={
                <View>
                  {cloudLoadError ? (
                    <View style={styles.cloudErrorBanner}>
                      <MaterialCommunityIcons name="wifi-off" size={16} color="#B45309" />
                      <Text style={styles.cloudErrorText} numberOfLines={2}>
                        {cloudLoadError}
                      </Text>
                      <TouchableOpacity
                        onPress={handleRefreshCloud}
                        style={styles.cloudErrorRetryBtn}
                        accessibilityRole="button"
                        accessibilityLabel={STRINGS_PL.common.retry}
                      >
                        <Text style={styles.cloudErrorRetryText}>{STRINGS_PL.common.retry}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
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
              posts={boardPosts.filter((p) => !isAuthorBlocked(p.authorName))}
              searchQuery={searchQuery}
              likedPostIds={likedBoardPostIds}
              onLikeToggle={handleLikeBoardPost}
              onOpenAddPost={() => setIsAddBoardModalVisible(true)}
              savedPostIds={savedBoardPostIds}
              onToggleSavePost={handleToggleSaveBoardPost}
              isRefreshing={isCloudRefreshing}
              onRefresh={handleRefreshCloud}
            />
          ) : (
            <SavedTab
              savedItems={items.filter((i) => savedItemIds.includes(i.id) && !isAuthorBlocked(i.authorName))}
              savedBoardPosts={boardPosts.filter(
                (p) => savedBoardPostIds.includes(p.id) && !isAuthorBlocked(p.authorName)
              )}
              likedPostIds={likedBoardPostIds}
              onLikeToggle={handleLikeBoardPost}
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
                      <MaterialCommunityIcons name={tab.activeIcon} size={22} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.navTabPillText} numberOfLines={1}>
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
                    size={25}
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
          userCoords={gpsCoords}
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
          currentUser={adminSettings.accountsEnabled ? currentUser : null}
          accountsEnabled={adminSettings.accountsEnabled}
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

        <CityPickerModal
          visible={isCityModalVisible}
          onClose={() => setIsCityModalVisible(false)}
          selectedCity={selectedCity}
          onSelectCity={handleSelectCity}
          gpsCityName={gpsCityName}
          items={items.filter((i) => isItemActive(i) && !isAuthorBlocked(i.authorName))}
        />

        {/* Modal Logowania / Rejestracji */}
        {adminSettings.accountsEnabled && (
          <LoginScreenModal
            visible={isLoginModalVisible}
            onClose={() => setIsLoginModalVisible(false)}
            onLoginProvider={handleLoginProvider}
            onLoginSuccess={handleLoginSuccess}
            onContinueAsGuest={handleContinueAsGuest}
          />
        )}

        {/* Modal czatu sąsiedzkiego o wystawce */}
        <ItemChatModal
          visible={isChatModalVisible}
          onClose={() => setIsChatModalVisible(false)}
          item={chatItem}
          currentUser={adminSettings.accountsEnabled ? currentUser : null}
          accountsEnabled={adminSettings.accountsEnabled}
          onOpenLogin={() => setIsLoginModalVisible(true)}
        />

        {/* Panel Administratora */}
        <AdminPanelModal
          visible={isAdminModalVisible}
          onClose={() => setIsAdminModalVisible(false)}
          items={items}
          boardPosts={boardPosts}
          savedCount={savedItemIds.length + savedBoardPostIds.length}
          ecoStats={ecoStats}
          streakDays={streakDays}
          selectedCity={selectedCity}
          gpsCityName={gpsCityName}
          neighborhoodSettings={neighborhoodSettings}
          adminSettings={adminSettings}
          onUpdateAdminSettings={handleUpdateAdminSettings}
          onOpenItemDetail={(item) => {
            setIsAdminModalVisible(false);
            setDetailItem(item);
          }}
          onUpdateItem={handleAdminUpdateItem}
          onResetItemFlags={handleAdminResetItemFlags}
          onRestoreItem={handleAdminRestoreItem}
          onArchiveItem={handleAdminArchiveItem}
          onDeleteItem={handleAdminDeleteItem}
          onBulkItemAction={handleAdminBulkItemAction}
          onUpdateBoardPost={handleAdminUpdateBoardPost}
          onDeleteBoardPost={handleAdminDeleteBoardPost}
          onToggleBlockAuthor={handleAdminToggleBlockAuthor}
          onUpdateBannerImage={handleAdminUpdateBannerImage}
          onResetAllBanners={handleAdminResetAllBanners}
          onPublishOfficialNotice={handleAdminPublishOfficialNotice}
          onSyncCloud={handleAdminSyncCloud}
          onResetDemoData={handleAdminResetDemoData}
          onClearCache={handleAdminClearCache}
          onRestartTutorial={handleRestartTutorial}
          isItemActiveCheck={isItemActive}
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
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#CBD5E1',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
  },
  contentDark: {
    backgroundColor: '#0B0F19',
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 125, // Zoptymalizowana przestrzeń pod powiększony dolny pasek nawigacyjny
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
    bottom: Platform.OS === 'ios' ? 20 : 12,
    left: 10,
    right: 10,
    zIndex: 30,
    alignItems: 'center',
  },
  modernBottomBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: 'rgba(241, 245, 249, 0.92)',
    borderRadius: 34,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  modernBottomBarDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderColor: 'rgba(51, 65, 85, 0.6)',
  },
  navTabCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    flexShrink: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    paddingLeft: 5,
    paddingRight: 15,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabPillText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.6,
    marginLeft: 8,
  },
  navTabPillTextDark: {
    color: '#F8FAFC',
  },
  navStarBadgeCircle: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: THEME.starYellow,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  navStarBadgePill: {
    marginLeft: 6,
    backgroundColor: THEME.starYellow,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
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
    fontSize: 9.5,
    fontWeight: '900',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 32,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(209, 250, 229, 0.9)',
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
  cloudErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cloudErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  cloudErrorRetryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
  },
  cloudErrorRetryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
