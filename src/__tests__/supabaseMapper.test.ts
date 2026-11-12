import { mapCloudRowToPostItem, CloudItemRow } from '../services/supabase';
import { mapCloudRowToBoardPost, CloudBoardRow } from '../services/boardRepository';
import { ok, fail } from '../types/result';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

describe('Cloud mappers and AppResult helpers', () => {
  it('wraps success and error states with ok and fail', () => {
    const success = ok({ count: 3 });
    expect(success).toEqual({ ok: true, data: { count: 3 } });

    const errorResult = fail('NETWORK', 'Brak połączenia');
    expect(errorResult.ok).toBe(false);
    if (!errorResult.ok) {
      expect(errorResult.error.code).toBe('NETWORK');
      expect(errorResult.error.message).toBe('Brak połączenia');
    }
  });

  it('maps a CloudItemRow into PostItem with safe defaults', () => {
    const row: CloudItemRow = {
      id: 'cloud-1',
      type: 'wystawka',
      title: 'Fotel PRL',
      description: null,
      category: 'meble',
      photos: null,
      latitude: 51.25,
      longitude: 22.57,
      address: 'ul. Lipowa 1',
      is_exact: null,
      created_at: '2026-05-01T10:00:00.000Z',
      expires_at: null,
      status: 'active',
      still_there_votes: null,
      taken_votes: 1,
      author_name: null,
      contact_info: '500-600-700',
    };

    const mapped = mapCloudRowToPostItem(row);
    expect(mapped.id).toBe('cloud-1');
    expect(mapped.description).toBe('');
    expect(mapped.photos).toEqual([]);
    expect(mapped.location).toEqual({
      latitude: 51.25,
      longitude: 22.57,
      address: 'ul. Lipowa 1',
      isExact: true,
    });
    expect(mapped.stillThereVotes).toBe(0);
    expect(mapped.takenVotes).toBe(1);
    expect(mapped.contactInfo).toBe('500-600-700');
  });

  it('maps a CloudBoardRow into BoardPost with safe defaults', () => {
    const row: CloudBoardRow = {
      id: 'board-cloud-1',
      title: 'Szukam wózka',
      content: 'Pilnie potrzebny wózek na zakupy.',
      tag: 'szukam',
      author_name: null,
      location_area: 'Śródmieście',
      contact_info: null,
      likes_count: null,
      created_at: '2026-05-01T12:00:00.000Z',
    };

    const mapped = mapCloudRowToBoardPost(row);
    expect(mapped.authorName).toBe('Sąsiad');
    expect(mapped.locationArea).toBe('Śródmieście');
    expect(mapped.likesCount).toBe(0);
    expect(mapped.contactInfo).toBeUndefined();
  });
});
