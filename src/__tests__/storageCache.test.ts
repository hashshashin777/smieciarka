import {
  StorageCache,
  clampNeighborhoodRadius,
  isDistanceInNeighborhood,
} from '../services/storageCache';

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStore.delete(key);
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach((k) => mockStore.delete(k));
    }),
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-test-voter-1'),
  digestStringAsync: jest.fn(async (_alg: string, input: string) => `hash-${input}`),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

describe('StorageCache and neighborhood helpers', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('clamps neighborhood radius between 1 and 50 km', () => {
    expect(clampNeighborhoodRadius(0)).toBe(2);
    expect(clampNeighborhoodRadius(-5)).toBe(1);
    expect(clampNeighborhoodRadius(12.4)).toBe(12);
    expect(clampNeighborhoodRadius(99)).toBe(50);
  });

  it('evaluates neighborhood distance scopes accurately', () => {
    expect(isDistanceInNeighborhood(1.5, { radiusKm: 2, scope: 'radius', alertsEnabled: true })).toBe(true);
    expect(isDistanceInNeighborhood(3.0, { radiusKm: 2, scope: 'radius', alertsEnabled: true })).toBe(false);
    expect(isDistanceInNeighborhood(20, { radiusKm: 2, scope: 'city', alertsEnabled: true })).toBe(true);
    expect(isDistanceInNeighborhood(35, { radiusKm: 2, scope: 'city', alertsEnabled: true })).toBe(false);
    expect(isDistanceInNeighborhood(140, { radiusKm: 2, scope: 'voivodeship', alertsEnabled: true })).toBe(true);
    expect(isDistanceInNeighborhood(999, { radiusKm: 2, scope: 'country', alertsEnabled: true })).toBe(true);
  });

  it('generates and persists an anonymous voterKey', async () => {
    const first = await StorageCache.getVoterKey();
    const second = await StorageCache.getVoterKey();
    expect(first).toBe('uuid-test-voter-1');
    expect(second).toBe(first);
  });

  it('migrates schema version cleanly without losing cached items', async () => {
    mockStore.set('smieciarka_items_cache_v1', JSON.stringify([{ id: 'keep-me' }]));
    await StorageCache.ensureSchemaVersion();
    expect(mockStore.get('smieciarka_schema_version')).toBe('2');
    expect(mockStore.get('smieciarka_items_cache_v1')).toContain('keep-me');
  });

  it('persists saved board IDs, liked board IDs, and sync queue actions', async () => {
    await StorageCache.saveSavedBoardPostIds(['b-1', 'b-2']);
    await StorageCache.saveLikedBoardPostIds(['b-2']);
    await StorageCache.enqueueSyncAction({
      id: 'sync-1',
      kind: 'vote_taken',
      itemId: 'post-9',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(await StorageCache.getSavedBoardPostIds()).toEqual(['b-1', 'b-2']);
    expect(await StorageCache.getLikedBoardPostIds()).toEqual(['b-2']);
    const queue = await StorageCache.getPendingSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe('vote_taken');

    await StorageCache.clearAllUserData();
    expect(await StorageCache.getPendingSyncQueue()).toEqual([]);
  });
});
