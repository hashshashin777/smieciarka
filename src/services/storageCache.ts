import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostItem } from '../types';

const STORAGE_KEYS = {
  CACHED_ITEMS: 'smieciarka_cached_items_v1',
  SAVED_IDS: 'smieciarka_saved_ids_v1',
  NEIGHBORHOOD: 'smieciarka_neighborhood_settings_v1',
  ECO_STATS: 'smieciarka_eco_stats_v1',
  STREAK: 'smieciarka_streak_v1',
};

export interface NeighborhoodSettings {
  radiusKm: number;
  alertsEnabled: boolean;
  label: string;
}

export interface EcoStats {
  itemsRescued: number;
  co2SavedKg: number;
  postsCreated: number;
}

export const StorageCache = {
  async getCachedItems(): Promise<PostItem[] | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_ITEMS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async saveCachedItems(items: PostItem[]): Promise<void> {
    try {
      // Keep up to 100 recent items in offline cache
      const slice = items.slice(0, 100);
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_ITEMS, JSON.stringify(slice));
    } catch {
      // Ignore cache write errors
    }
  },

  async getSavedIds(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_IDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveSavedIds(ids: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_IDS, JSON.stringify(ids));
    } catch {
      // Ignore
    }
  },

  async getNeighborhoodSettings(): Promise<NeighborhoodSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NEIGHBORHOOD);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Ignore
    }
    return {
      radiusKm: 2,
      alertsEnabled: true,
      label: 'Mój rewir (2 km)',
    };
  },

  async saveNeighborhoodSettings(settings: NeighborhoodSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NEIGHBORHOOD, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  },

  async getEcoStats(): Promise<EcoStats> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ECO_STATS);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Ignore
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
        co2SavedKg: current.co2SavedKg + 14, // średnio 14 kg CO2 zaoszczędzone na uratowanym meblu/AGD
        postsCreated: current.postsCreated,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.ECO_STATS, JSON.stringify(updated));
      return updated;
    } catch {
      return { itemsRescued: 3, co2SavedKg: 42, postsCreated: 1 };
    }
  },

  async recordPostCreated(): Promise<EcoStats> {
    try {
      const current = await StorageCache.getEcoStats();
      const updated: EcoStats = {
        ...current,
        postsCreated: current.postsCreated + 1,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.ECO_STATS, JSON.stringify(updated));
      return updated;
    } catch {
      return { itemsRescued: 2, co2SavedKg: 28, postsCreated: 2 };
    }
  },

  async getStreak(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.STREAK);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.count || 3;
      }
    } catch {
      // Ignore
    }
    return 3;
  },

  async recordDailyActivity(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await AsyncStorage.getItem(STORAGE_KEYS.STREAK);
      if (data) {
        const parsed = JSON.parse(data);
        const lastDate = parsed.lastDate;
        if (lastDate === today) {
          return parsed.count || 3;
        }

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        let newCount = (parsed.count || 1);
        if (lastDate === yesterday) {
          newCount += 1;
        } else {
          newCount = 1;
        }

        await AsyncStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify({ lastDate: today, count: newCount }));
        return newCount;
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify({ lastDate: today, count: 3 }));
        return 3;
      }
    } catch {
      return 3;
    }
  },
};
