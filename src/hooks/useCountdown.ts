import { useEffect, useState } from 'react';
import { CountdownResult, formatRemainingCountdown } from '../utils/helpers';

/**
 * Reaktywny hook do odliczania czasu ważności ogłoszenia.
 * Odświeża stan w interwale czasowym zależnym od pozostałego czasu.
 */
export function useCountdown(
  expiresAt?: string,
  createdAt?: string,
  durationDays?: number
): CountdownResult {
  const [result, setResult] = useState<CountdownResult>(() =>
    formatRemainingCountdown(expiresAt, createdAt, durationDays)
  );

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    Promise.resolve().then(() => {
      if (!isMounted) return;
      const initial = formatRemainingCountdown(expiresAt, createdAt, durationDays);
      setResult(initial);
      if (initial.isExpired) {
        return;
      }

      const delayMs = initial.days === 0 && initial.hours === 0 ? 5000 : 30000;
      timer = setInterval(() => {
        if (!isMounted) return;
        const res = formatRemainingCountdown(expiresAt, createdAt, durationDays);
        setResult(res);
        if (res.isExpired && timer) {
          clearInterval(timer);
        }
      }, delayMs);
    });

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, [expiresAt, createdAt, durationDays]);

  return result;
}
