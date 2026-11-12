import { useEffect } from 'react';
import { Linking } from 'react-native';

export function extractItemIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:smieciarka:\/\/item\/|https?:\/\/[^/]+\/item\/)([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function useDeepLinks(onOpenItemById: (itemId: string) => void): void {
  useEffect(() => {
    Linking.getInitialURL()
      .then((initialUrl) => {
        const itemId = extractItemIdFromUrl(initialUrl ?? null);
        if (itemId) onOpenItemById(itemId);
      })
      .catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const itemId = extractItemIdFromUrl(url);
      if (itemId) onOpenItemById(itemId);
    });

    return () => {
      subscription.remove();
    };
  }, [onOpenItemById]);
}
