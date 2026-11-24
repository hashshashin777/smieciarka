import { calculateDistance, formatRelativeTime, detectPiiInText, formatRemainingCountdown } from '../utils/helpers';
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
      expect(extractItemIdFromUrl('https://wystawka-app.vercel.app/?item=item-456')).toBe('item-456');
      expect(extractItemIdFromUrl('https://wystawka-app.vercel.app/?itemId=item-789&source=share')).toBe('item-789');
      expect(extractItemIdFromUrl('https://smieciarka.fun/other/123')).toBeNull();
      expect(extractItemIdFromUrl(null)).toBeNull();
    });
  });

  describe('detectPiiInText (HIPOTEZA-03)', () => {
    it('detects 9-digit Polish phone numbers in various formats', () => {
      expect(detectPiiInText('Zadzwoń pod 500-600-700 w sprawie odbioru').hasPhone).toBe(true);
      expect(detectPiiInText('Mój nr: +48 601 234 567').hasPhone).toBe(true);
      expect(detectPiiInText('Kontakt: 512345678').hasPhone).toBe(true);
      expect(detectPiiInText('Stół drewniany, wysokość 75 cm, szerokość 120 cm').hasPhone).toBe(false);
    });

    it('detects email addresses', () => {
      expect(detectPiiInText('Pisz na adres jan.kowalski@example.com').hasEmail).toBe(true);
      expect(detectPiiInText('Oddam za darmo fotel PRL').hasEmail).toBe(false);
    });

    it('returns empty result for empty string', () => {
      expect(detectPiiInText('').detectedTypes).toEqual([]);
    });
  });

  describe('formatRemainingCountdown', () => {
    it('correctly calculates remaining days, hours and minutes for 14-day duration', () => {
      const now = 1_750_000_000_000;
      // 14 days minus 10 minutes
      const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000 - 10 * 60 * 1000).toISOString();
      const res = formatRemainingCountdown(expiresAt, undefined, undefined, now);

      expect(res.isExpired).toBe(false);
      expect(res.days).toBe(13);
      expect(res.hours).toBe(23);
      expect(res.minutes).toBe(50);
      expect(res.formatted).toBe('13 dni 23 godz. 50 min');
      expect(res.shortFormatted).toBe('13d 23h 50m');
    });

    it('formats single day as "dzień"', () => {
      const now = 1_750_000_000_000;
      const expiresAt = new Date(now + 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString();
      const res = formatRemainingCountdown(expiresAt, undefined, undefined, now);

      expect(res.isExpired).toBe(false);
      expect(res.days).toBe(1);
      expect(res.hours).toBe(5);
      expect(res.formatted).toBe('1 dzień 5 godz. 0 min');
    });

    it('formats remaining hours and minutes when less than 24 hours remain', () => {
      const now = 1_750_000_000_000;
      const expiresAt = new Date(now + 4 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString();
      const res = formatRemainingCountdown(expiresAt, undefined, undefined, now);

      expect(res.days).toBe(0);
      expect(res.hours).toBe(4);
      expect(res.minutes).toBe(15);
      expect(res.formatted).toBe('4 godz. 15 min');
      expect(res.shortFormatted).toBe('4h 15m');
    });

    it('formats expired item correctly', () => {
      const now = 1_750_000_000_000;
      const expiresAt = new Date(now - 30 * 60 * 1000).toISOString();
      const res = formatRemainingCountdown(expiresAt, undefined, undefined, now);

      expect(res.isExpired).toBe(true);
      expect(res.formatted).toBe('Wygasło (0 min)');
      expect(res.shortFormatted).toBe('Wygasło');
    });

    it('calculates expiration from createdAt and durationDays fallback', () => {
      const now = 1_750_000_000_000;
      const createdAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(); // created 2 days ago
      const res = formatRemainingCountdown(undefined, createdAt, 7, now); // duration 7 days -> 5 days left

      expect(res.isExpired).toBe(false);
      expect(res.days).toBe(5);
      expect(res.formatted).toBe('5 dni 0 godz. 0 min');
    });
  });
});
