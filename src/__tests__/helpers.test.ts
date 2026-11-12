import { calculateDistance, formatRelativeTime } from '../utils/helpers';
import { extractItemIdFromUrl } from '../hooks/useDeepLinks';

describe('helpers utilities', () => {
  describe('calculateDistance', () => {
    it('returns 0 m for identical coordinates', () => {
      const result = calculateDistance(51.2465, 22.5684, 51.2465, 22.5684);
      expect(result.value).toBe(0);
      expect(result.formatted).toBe('0 m stąd');
    });

    it('formats distances under 1 km in meters', () => {
      const result = calculateDistance(51.2465, 22.5684, 51.25, 22.57);
      expect(result.value).toBeLessThan(1);
      expect(result.formatted).toMatch(/^\d+ m stąd$/);
    });

    it('formats distances >= 1 km in kilometers with 1 decimal', () => {
      // Lublin -> Warsaw (~150 km)
      const result = calculateDistance(51.2465, 22.5684, 52.2297, 21.0122);
      expect(result.value).toBeGreaterThan(140);
      expect(result.value).toBeLessThan(170);
      expect(result.formatted).toMatch(/^\d+\.\d km stąd$/);
    });
  });

  describe('formatRelativeTime', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('handles invalid dates gracefully without NaN', () => {
      expect(formatRelativeTime('invalid-date-string')).toBe('Przed chwilą');
      expect(formatRelativeTime('')).toBe('Przed chwilą');
    });

    it('formats recent, minutes, hours, yesterday, and days ago accurately', () => {
      const now = 1_750_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      expect(formatRelativeTime(new Date(now - 10 * 1000).toISOString())).toBe('Przed chwilą');
      expect(formatRelativeTime(new Date(now - 15 * 60 * 1000).toISOString())).toBe('15 min temu');
      expect(formatRelativeTime(new Date(now - 3 * 60 * 60 * 1000).toISOString())).toBe('3 godz. temu');
      expect(formatRelativeTime(new Date(now - 26 * 60 * 60 * 1000).toISOString())).toBe('Wczoraj');
      expect(formatRelativeTime(new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString())).toBe('5 dni temu');
    });
  });

  describe('extractItemIdFromUrl', () => {
    it('extracts item IDs from custom scheme and HTTPS universal links', () => {
      expect(extractItemIdFromUrl('smieciarka://item/post-123')).toBe('post-123');
      expect(extractItemIdFromUrl('https://smieciarka.fun/item/item%20abc?ref=share')).toBe('item abc');
      expect(extractItemIdFromUrl('https://smieciarka.fun/other/123')).toBeNull();
      expect(extractItemIdFromUrl(null)).toBeNull();
    });
  });
});
