import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Zapewnia obsługę klawisza Escape na platformie Web (WCAG 2.2 AA).
 * Po naciśnięciu klawisza Escape otwarty modal zostaje bezpiecznie zamknięty.
 */
export function useWebModalEscape(visible: boolean, onClose: () => void): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);
}
