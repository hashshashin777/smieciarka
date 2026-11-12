import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Handles the Android hardware back button consistently across modals and tabs.
 * Expects callbacks ordered from topmost modal down to default tab navigation.
 */
export function useAndroidBackHandler(onBackPress: () => boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [onBackPress]);
}
