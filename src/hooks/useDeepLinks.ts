import { useEffect } from 'react';
import { Linking } from 'react-native';

export function extractItemIdFromUrl(url: string | null): string | null {
  if (!url) return null;

  // 1. Path format: smieciarka://item/:id or https://domain/item/:id
  const pathMatch = url.match(/(?:smieciarka:\/\/item\/|https?:\/\/[^/]+\/item\/)([^/?#]+)/i);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

  // 2. Query or hash param format: ?item=:id or ?itemId=:id or #item=:id
  const paramMatch = url.match(/[?&#](?:item|itemId)=([^&#]+)/i);
  if (paramMatch?.[1]) return decodeURIComponent(paramMatch[1]);

  return null;
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
