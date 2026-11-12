import { getLocales } from 'expo-localization';

export function getPreferredLanguage(): string {
  try {
    const locales = getLocales();
    return locales[0]?.languageCode || 'pl';
  } catch {
    return 'pl';
  }
}

export const STRINGS_PL = {
  common: {
    appName: 'Śmieciarka.fun',
    cancel: 'Anuluj',
    save: 'Zapisz',
    delete: 'Usuń',
    close: 'Zamknij',
    retry: 'Spróbuj ponownie',
    loading: 'Ładowanie…',
    errorTitle: 'Błąd',
    successTitle: 'Gotowe',
    offlineNotice: 'Tryb offline — zmiany zsynchronizują się po odzyskaniu sieci.',
    unknownUser: 'Sąsiad',
  },
  errors: {
    network: 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
    uploadFailed: 'Nie udało się wysłać zdjęcia. Sprawdź połączenie i spróbuj ponownie.',
    gpsRequired: 'Włącz lokalizację GPS lub wybierz miasto ręcznie, aby dodać znalezisko.',
    authRequired: 'Zaloguj się, aby wykonać tę akcję.',
    genericAction: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
  },
  states: {
    loadingItems: 'Ładowanie lokalnych znalezisk…',
    emptyItems: 'Brak aktywnych znalezisk w wybranym promieniu.',
    emptyBoard: 'Brak postów na tablicy sąsiedzkiej.',
    emptySaved: 'Nie masz jeszcze zapisanych pozycji w tej kategorii.',
    errorLoadItems: 'Nie udało się pobrać listy znalezisk.',
  },
  auth: {
    privacyPolicy: 'Polityka prywatności',
    termsOfService: 'Regulamin',
    deleteAccount: 'Usuń konto i dane',
    deleteAccountConfirmTitle: 'Usuwanie konta',
    deleteAccountConfirmBody:
      'Usunięcie konta jest trwałe i usuwa powiązane dane z tego urządzenia. Kontynuować?',
  },
} as const;
