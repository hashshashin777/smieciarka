import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { BoardPost, PostItem, SyncAction } from '../types';
import { CityOption } from '../constants/cities';
import { ACCOUNTS_ENABLED } from '../constants/features';
import { BannerSlotId, CustomBannerImages } from '../constants/banners';

const SCHEMA_VERSION = 2;

const KEYS = {
  SCHEMA_VERSION: 'smieciarka_schema_version',
  ITEMS_CACHE: 'smieciarka_items_cache_v1',
  BOARD_POSTS_CACHE: 'smieciarka_board_posts_cache_v1',
  SAVED_IDS: 'smieciarka_saved_ids_v1',
  SAVED_BOARD_IDS: 'smieciarka_saved_board_ids_v1',
  LIKED_BOARD_IDS: 'smieciarka_liked_board_ids_v1',
  PENDING_SYNC_QUEUE: 'smieciarka_pending_sync_v1',
  VOTER_KEY: 'smieciarka_voter_key_v1',
  NEIGHBORHOOD_SETTINGS: 'smieciarka_neighborhood_v1',
  ECO_STATS: 'smieciarka_eco_stats_v1',
  STREAK: 'smieciarka_streak_v1',
  TUTORIAL_DONE: 'smieciarka_tutorial_done_v1',
  SELECTED_CITY: 'smieciarka_selected_city_v1',
  ADMIN_SETTINGS: 'smieciarka_admin_settings_v1',
};

export interface AdminSettings {
  accountsEnabled: boolean;
  adsEnabled: boolean;
  autoExpireEnabled: boolean;
  bannerEnabled: boolean;
  bannerText: string;
  usersCount: number;
  customBanners: CustomBannerImages;
  blockedAuthors: string[];
}

export const DEFAULT_BETA_BANNER_TEXT =
  'Wersja Beta 0.1 • Aplikacja cały czas jest w budowie • Brak logowania to zamierzony efekt tymczasowy';

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  accountsEnabled: ACCOUNTS_ENABLED,
  adsEnabled: true,
  autoExpireEnabled: true,
  bannerEnabled: true,
  bannerText: DEFAULT_BETA_BANNER_TEXT,
  usersCount: 128,
  customBanners: {},
  blockedAuthors: [],
};

export type NeighborhoodScope = 'radius' | 'city' | 'voivodeship' | 'country';

export interface NeighborhoodSettings {
  radiusKm: number;
  scope?: NeighborhoodScope;
  alertsEnabled: boolean;
  label?: string;
}

export const MAX_NEIGHBORHOOD_RADIUS_KM = 50;

export const NEIGHBORHOOD_SCOPE_OPTIONS: {
  id: NeighborhoodScope;
  label: string;
  subtitle: string;
  icon: 'radar' | 'city-variant-outline' | 'map-outline' | 'earth';
}[] = [
  { id: 'radius', label: 'Promień km', subtitle: 'Własny zasięg 1-50 km', icon: 'radar' },
  { id: 'city', label: 'Miasto', subtitle: 'Całe miasto lub okolica', icon: 'city-variant-outline' },
  { id: 'voivodeship', label: 'Województwo', subtitle: 'Region ~150 km', icon: 'map-outline' },
  { id: 'country', label: 'Cała Polska', subtitle: 'Wszystkie zgłoszenia w PL', icon: 'earth' },
];

export function clampNeighborhoodRadius(radiusKm: number): number {
  return Math.min(Math.max(Math.round(radiusKm || 2), 1), MAX_NEIGHBORHOOD_RADIUS_KM);
}

export function getNeighborhoodScope(settings: NeighborhoodSettings): NeighborhoodScope {
  return settings.scope || 'radius';
}

export function getNeighborhoodDisplayValue(settings: NeighborhoodSettings): string {
  const scope = getNeighborhoodScope(settings);
  if (scope === 'city') return 'Miasto';
  if (scope === 'voivodeship') return 'Województwo';
  if (scope === 'country') return 'Cała Polska';
  return `${clampNeighborhoodRadius(settings.radiusKm)} km`;
}

export function getNeighborhoodLabel(settings: NeighborhoodSettings): string {
  const scope = getNeighborhoodScope(settings);
  if (scope === 'city') return 'Całe miasto';
  if (scope === 'voivodeship') return 'Województwo';
  if (scope === 'country') return 'Cała Polska';
  return `Promień ${clampNeighborhoodRadius(settings.radiusKm)} km`;
}

export function getNeighborhoodSubtitle(settings: NeighborhoodSettings): string {
  const scope = getNeighborhoodScope(settings);
  if (scope === 'city') return 'Pokazuje okazje z całego wybranego miasta (~25 km).';
  if (scope === 'voivodeship') return 'Pokazuje okazje z całego regionu (~150 km).';
  if (scope === 'country') return 'Pokazuje okazje na terenie całej Polski bez limitu odległości.';
  const r = clampNeighborhoodRadius(settings.radiusKm);
  if (r <= 1) return 'Idealny na szybki spacer pod blokiem lub po osiedlu.';
  if (r <= 5) return 'Zasięg rowerowy — najbliższe dzielnice i sąsiednie ulice.';
  if (r <= 15) return 'Zasięg miejski — całe miasto i pobliskie osiedla.';
  if (r <= 30) return 'Zasięg aglomeracji — miasto oraz sąsiednie miejscowości.';
  return 'Zasięg regionalny — dalsze okazje i wyprawy po meble.';
}

export function isDistanceInNeighborhood(
  distanceKm: number,
  settings: NeighborhoodSettings
): boolean {
  const scope = getNeighborhoodScope(settings);
  if (scope === 'country') return true;
  if (scope === 'voivodeship') return distanceKm <= 150;
  if (scope === 'city') return distanceKm <= 25;
  return distanceKm <= clampNeighborhoodRadius(settings.radiusKm);
}

export interface EcoStats {
  itemsRescued: number;
  co2SavedKg: number;
  postsCreated: number;
}

const MAX_SYNC_QUEUE_SIZE = 100;

export const StorageCache = {
  async ensureSchemaVersion(): Promise<void> {
    try {
      const currentRaw = await AsyncStorage.getItem(KEYS.SCHEMA_VERSION);
      const current = currentRaw ? Number.parseInt(currentRaw, 10) : 1;
      if (Number.isFinite(current) && current >= SCHEMA_VERSION) return;

      // Migrate v1 -> v2 safely: normalize existing neighborhood radius & admin settings
      const nSettings = await StorageCache.getNeighborhoodSettings();
      await StorageCache.saveNeighborhoodSettings({
        ...nSettings,
        radiusKm: clampNeighborhoodRadius(nSettings.radiusKm),
        scope: getNeighborhoodScope(nSettings),
      });
      await AsyncStorage.setItem(KEYS.SCHEMA_VERSION, String(SCHEMA_VERSION));
    } catch {
      // Do not crash startup if storage migration cannot persist version flag
    }
  },

  async getVoterKey(): Promise<string> {
    try {
      const existing = await AsyncStorage.getItem(KEYS.VOTER_KEY);
      if (existing) return existing;
      const generated =
        typeof Crypto.randomUUID === 'function'
          ? Crypto.randomUUID()
          : `voter_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(KEYS.VOTER_KEY, generated);
      return generated;
    } catch {
      return 'device-fallback';
    }
  },

  async getCachedItems(): Promise<PostItem[] | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ITEMS_CACHE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async saveCachedItems(items: PostItem[]): Promise<void> {
    try {
      const trimmed = items.slice(0, 200);
      await AsyncStorage.setItem(KEYS.ITEMS_CACHE, JSON.stringify(trimmed));
    } catch {
      // Ignore cache write error
    }
  },

  async getCachedBoardPosts(): Promise<BoardPost[] | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.BOARD_POSTS_CACHE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async saveCachedBoardPosts(posts: BoardPost[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.BOARD_POSTS_CACHE, JSON.stringify(posts.slice(0, 150)));
    } catch {
      // Ignore cache write error
    }
  },

  async getSavedIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SAVED_IDS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async saveSavedIds(ids: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SAVED_IDS, JSON.stringify(ids));
    } catch {
      // Ignore cache write error
    }
  },

  async getSavedBoardPostIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SAVED_BOARD_IDS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async saveSavedBoardPostIds(ids: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SAVED_BOARD_IDS, JSON.stringify(ids));
    } catch {
      // Ignore cache write error
    }
  },

  async getLikedBoardPostIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.LIKED_BOARD_IDS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async saveLikedBoardPostIds(ids: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.LIKED_BOARD_IDS, JSON.stringify(ids));
    } catch {
      // Ignore cache write error
    }
  },

  async getPendingSyncQueue(): Promise<SyncAction[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PENDING_SYNC_QUEUE);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async enqueueSyncAction(action: SyncAction): Promise<void> {
    try {
      const queue = await StorageCache.getPendingSyncQueue();
      const next = [...queue, action].slice(-MAX_SYNC_QUEUE_SIZE);
      await AsyncStorage.setItem(KEYS.PENDING_SYNC_QUEUE, JSON.stringify(next));
    } catch {
      // Ignore sync queue write error
    }
  },

  async replacePendingSyncQueue(queue: SyncAction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PENDING_SYNC_QUEUE, JSON.stringify(queue));
    } catch {
      // Ignore sync queue write error
    }
  },

  async getNeighborhoodSettings(): Promise<NeighborhoodSettings> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.NEIGHBORHOOD_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        const validScopes: NeighborhoodScope[] = ['radius', 'city', 'voivodeship', 'country'];
        const scope = validScopes.includes(parsed.scope) ? parsed.scope : 'radius';
        return {
          radiusKm: clampNeighborhoodRadius(parsed.radiusKm),
          scope,
          alertsEnabled:
            typeof parsed.alertsEnabled === 'boolean' ? parsed.alertsEnabled : true,
        };
      }
    } catch {
      // Use defaults below
    }
    return {
      radiusKm: 2,
      scope: 'radius',
      alertsEnabled: true,
    };
  },

  async saveNeighborhoodSettings(settings: NeighborhoodSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.NEIGHBORHOOD_SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore write error
    }
  },

  async getEcoStats(): Promise<EcoStats> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ECO_STATS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.itemsRescued === 'number') {
          return parsed as EcoStats;
        }
      }
    } catch {
      // Use defaults below
    }
    return {
      itemsRescued: 2,
      co2SavedKg: 28,
      postsCreated: 1,
    };
  },

  async recordRescue(): Promise<EcoStats> {
    try {
      const current = await StorageCache.getEcoStats();
      const updated: EcoStats = {
        itemsRescued: current.itemsRescued + 1,
        co2SavedKg: current.co2SavedKg + 14,
        postsCreated: current.postsCreated,
      };
      await AsyncStorage.setItem(KEYS.ECO_STATS, JSON.stringify(updated));
      return updated;
    } catch {
      return { itemsRescued: 3, co2SavedKg: 42, postsCreated: 1 };
    }
  },

  async recordPostCreated(): Promise<EcoStats> {
    try {
      const current = await StorageCache.getEcoStats();
      const updated: EcoStats = {
        itemsRescued: current.itemsRescued,
        co2SavedKg: current.co2SavedKg,
        postsCreated: current.postsCreated + 1,
      };
      await AsyncStorage.setItem(KEYS.ECO_STATS, JSON.stringify(updated));
      return updated;
    } catch {
      return { itemsRescued: 2, co2SavedKg: 28, postsCreated: 2 };
    }
  },

  async getStreak(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.STREAK);
      if (raw) {
        const parsed = JSON.parse(raw);
        return typeof parsed.count === 'number' ? parsed.count : 1;
      }
    } catch {
      // Default streak
    }
    return 1;
  },

  async recordDailyActivity(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const raw = await AsyncStorage.getItem(KEYS.STREAK);
      let count = 1;
      if (raw) {
        const parsed = JSON.parse(raw);
        const lastDate = parsed.lastDate as string | undefined;
        count = typeof parsed.count === 'number' ? parsed.count : 1;

        if (lastDate === today) {
          return count;
        }
        if (lastDate) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          count = lastDate === yesterday ? count + 1 : 1;
        }
      }
      await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify({ lastDate: today, count }));
      return count;
    } catch {
      return 1;
    }
  },

  async isTutorialCompleted(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.TUTORIAL_DONE);
      return raw === 'true';
    } catch {
      return false;
    }
  },

  async setTutorialCompleted(completed: boolean = true): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.TUTORIAL_DONE, completed ? 'true' : 'false');
    } catch {
      // Ignore write error
    }
  },

  async getSelectedCity(): Promise<CityOption | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SELECTED_CITY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        return parsed as CityOption;
      }
    } catch {
      // Ignore parse error
    }
    return null;
  },

  async saveSelectedCity(city: CityOption | null): Promise<void> {
    try {
      if (!city) {
        await AsyncStorage.removeItem(KEYS.SELECTED_CITY);
      } else {
        await AsyncStorage.setItem(KEYS.SELECTED_CITY, JSON.stringify(city));
      }
    } catch {
      // Ignore write error
    }
  },

  async getAdminSettings(): Promise<AdminSettings> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ADMIN_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        const cleanedBanners: CustomBannerImages = {};
        if (parsed.customBanners && typeof parsed.customBanners === 'object') {
          const slots: BannerSlotId[] = ['home', 'map', 'list', 'board', 'saved'];
          for (const slot of slots) {
            const val = parsed.customBanners[slot];
            if (typeof val === 'string' && val.trim().length > 0) {
              cleanedBanners[slot] = val.trim();
            }
          }
        }
        const cleanedBlocked: string[] = Array.isArray(parsed.blockedAuthors)
          ? Array.from(
              new Set(
                parsed.blockedAuthors
                  .filter((x: unknown): x is string => typeof x === 'string')
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 0)
              )
            )
          : DEFAULT_ADMIN_SETTINGS.blockedAuthors;

        return {
          accountsEnabled:
            typeof parsed.accountsEnabled === 'boolean'
              ? parsed.accountsEnabled
              : DEFAULT_ADMIN_SETTINGS.accountsEnabled,
          adsEnabled:
            typeof parsed.adsEnabled === 'boolean'
              ? parsed.adsEnabled
              : DEFAULT_ADMIN_SETTINGS.adsEnabled,
          autoExpireEnabled:
            typeof parsed.autoExpireEnabled === 'boolean'
              ? parsed.autoExpireEnabled
              : DEFAULT_ADMIN_SETTINGS.autoExpireEnabled,
          bannerEnabled:
            typeof parsed.bannerEnabled === 'boolean'
              ? parsed.bannerEnabled
              : DEFAULT_ADMIN_SETTINGS.bannerEnabled,
          bannerText:
            typeof parsed.bannerText === 'string' && parsed.bannerText.trim().length > 0
              ? parsed.bannerText
              : DEFAULT_ADMIN_SETTINGS.bannerText,
          usersCount:
            typeof parsed.usersCount === 'number' && parsed.usersCount >= 0
              ? Math.round(parsed.usersCount)
              : DEFAULT_ADMIN_SETTINGS.usersCount,
          customBanners: cleanedBanners,
          blockedAuthors: cleanedBlocked,
        };
      }
    } catch {
      // Fallback to defaults
    }
    return { ...DEFAULT_ADMIN_SETTINGS };
  },

  async saveAdminSettings(settings: AdminSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.ADMIN_SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore write error
    }
  },

  async clearCachedItems(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEYS.ITEMS_CACHE);
    } catch {
      // Ignore clear error
    }
  },

  async clearAllUserData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.ITEMS_CACHE,
        KEYS.BOARD_POSTS_CACHE,
        KEYS.SAVED_IDS,
        KEYS.SAVED_BOARD_IDS,
        KEYS.LIKED_BOARD_IDS,
        KEYS.PENDING_SYNC_QUEUE,
        KEYS.ECO_STATS,
        KEYS.STREAK,
        KEYS.SELECTED_CITY,
        KEYS.TUTORIAL_DONE,
      ]);
    } catch {
      // Ignore cleanup error
    }
  },
};
