import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { UserProfile, AuthProvider, ItemMessage } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

// Wymagane przez Expo do obsługi przekierowań OAuth
WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEYS = {
  USER_PROFILE: 'smieciarka_user_profile_v1',
  GUEST_MODE: 'smieciarka_guest_mode_v1',
  MESSAGES: 'smieciarka_item_messages_v1',
  REGISTERED_ACCOUNTS: 'smieciarka_accounts_registry_v1',
};

export interface StoredUserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  provider: AuthProvider;
  avatarUrl?: string;
  createdAt: string;
}

// Domyślne przykładowe wiadomości powitalne dla ofert w celach demonstracyjnych
const INITIAL_DEMO_MESSAGES: { [itemId: string]: ItemMessage[] } = {
  'post-lublin-1': [
    {
      id: 'msg-demo-1',
      itemId: 'post-lublin-1',
      itemTitle: 'Stylowe krzesła gięte Thonet',
      senderId: 'author-bartek',
      senderName: 'Bartek (Wystawiający)',
      senderProvider: 'apple',
      text: 'Cześć! Krzesła stoją w suchej bramie pod daszkiem. Kto pierwszy, ten lepszy!',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      isMyMessage: false,
    },
  ],
  'post-lublin-2': [
    {
      id: 'msg-demo-2',
      itemId: 'post-lublin-2',
      itemTitle: 'Gramofon Unitra Fonica + winyle',
      senderId: 'author-marta',
      senderName: 'Marta B. (Wystawiająca)',
      senderProvider: 'google',
      text: 'Dzień dobry! Gramofon jest do odbioru w kamienicy przy Narutowicza do godziny 21:00.',
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      isMyMessage: false,
    },
  ],
};

export const AuthService = {
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async isGuestMode(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_MODE);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async getRegisteredAccounts(): Promise<StoredUserAccount[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REGISTERED_ACCOUNTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Ignore
    }
    // Domyślne konto testowe
    return [
      {
        id: 'user_demo_email',
        name: 'Sąsiad Marek',
        email: 'sasiad@smieciarka.fun',
        password: 'haslo123',
        provider: 'email',
        createdAt: new Date().toISOString(),
      },
    ];
  },

  async saveRegisteredAccounts(accounts: StoredUserAccount[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(accounts));
    } catch {
      // Ignore
    }
  },

  // Pełna rejestracja nowego konta e-mail
  async signUpWithEmail(
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: 'Wpisz swoje imię lub pseudonim sąsiedzki (min. 2 znaki).' };
    }
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      return { success: false, error: 'Podaj poprawny adres e-mail (np. jan@domena.pl).' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Hasło musi mieć co najmniej 6 znaków.' };
    }

    const accounts = await this.getRegisteredAccounts();
    const existing = accounts.find((acc) => acc.email.toLowerCase() === trimmedEmail);
    if (existing) {
      return { success: false, error: 'Konto o tym adresie e-mail już istnieje. Przełącz się na logowanie.' };
    }

    const newUserAccount: StoredUserAccount = {
      id: `user_email_${Date.now()}`,
      name: trimmedName,
      email: trimmedEmail,
      password,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };

    accounts.push(newUserAccount);
    await this.saveRegisteredAccounts(accounts);

    const profile: UserProfile = {
      id: newUserAccount.id,
      name: newUserAccount.name,
      email: newUserAccount.email,
      provider: 'email',
      createdAt: newUserAccount.createdAt,
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, 'false');
    } catch {
      // Ignore
    }

    return { success: true, user: profile };
  },

  // Logowanie istniejącego konta e-mail
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      return { success: false, error: 'Wypełnij adres e-mail oraz hasło.' };
    }

    const accounts = await this.getRegisteredAccounts();
    const account = accounts.find((acc) => acc.email.toLowerCase() === trimmedEmail);

    if (!account) {
      return { success: false, error: 'Nie znaleziono konta z tym adresem e-mail. Zarejestruj się poniżej.' };
    }

    if (account.password && account.password !== password) {
      return { success: false, error: 'Nieprawidłowe hasło. Spróbuj ponownie.' };
    }

    const profile: UserProfile = {
      id: account.id,
      name: account.name,
      email: account.email,
      provider: account.provider,
      avatarUrl: account.avatarUrl,
      createdAt: account.createdAt,
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, 'false');
    } catch {
      // Ignore
    }

    return { success: true, user: profile };
  },

  // Produkcyjne logowanie przez Google OAuth (Supabase + Expo AuthSession)
  async signInWithGoogle(): Promise<{
    success: boolean;
    user?: UserProfile;
    error?: string;
    isDemoFallback?: boolean;
  }> {
    // Sprawdzamy czy Supabase jest skonfigurowany pod produkcję
    if (!isSupabaseConfigured || !supabase) {
      const mockUser = await this.signInWithProvider('google');
      return { success: true, user: mockUser, isDemoFallback: true };
    }

    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'smieciarka',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success' && result.url) {
          // Parsowanie parametrów z URL po przekierowaniu
          const urlObj = new URL(result.url);
          const rawParams = urlObj.hash ? urlObj.hash.replace(/^#/, '') : urlObj.search.replace(/^\?/, '');
          const params = new URLSearchParams(rawParams);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              return { success: false, error: sessionError.message };
            }

            const supaUser = sessionData?.user;
            if (supaUser) {
              const fullName =
                supaUser.user_metadata?.full_name ||
                supaUser.user_metadata?.name ||
                'Sąsiad z Google';
              const email = supaUser.email || 'google@smieciarka.fun';
              const avatar =
                supaUser.user_metadata?.avatar_url ||
                supaUser.user_metadata?.picture ||
                undefined;

              const profile: UserProfile = {
                id: supaUser.id,
                name: fullName,
                email,
                provider: 'google',
                avatarUrl: avatar,
                createdAt: supaUser.created_at || new Date().toISOString(),
              };

              await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
              await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, 'false');

              // Zapisz również do rejestru lokalnego
              const accounts = await this.getRegisteredAccounts();
              if (!accounts.some((a) => a.id === profile.id)) {
                accounts.push({
                  id: profile.id,
                  name: profile.name,
                  email: profile.email,
                  provider: 'google',
                  avatarUrl: profile.avatarUrl,
                  createdAt: profile.createdAt,
                });
                await this.saveRegisteredAccounts(accounts);
              }

              return { success: true, user: profile };
            }
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          return { success: false, error: 'Logowanie zostało anulowane.' };
        }
      }

      return { success: false, error: 'Nie udało się nawiązać połączenia z serwerem Google.' };
    } catch (err: any) {
      console.warn('Błąd Google OAuth, użyto trybu demonstracyjnego:', err?.message || err);
      const fallbackUser = await this.signInWithProvider('google');
      return { success: true, user: fallbackUser, isDemoFallback: true };
    }
  },

  // Rejestracja / Logowanie przez dostawców społecznościowych (Apple, Google, Facebook)
  async signInWithProvider(
    provider: AuthProvider,
    customName?: string,
    customEmail?: string
  ): Promise<UserProfile> {
    const timestamp = Date.now();
    const defaultNames: Record<AuthProvider, string> = {
      apple: 'Sąsiad z Apple',
      google: 'Sąsiad z Google',
      facebook: 'Sąsiad z Facebooka',
      email: 'Sąsiad z E-mail',
    };

    const email = customEmail || `${provider}.user${timestamp.toString().slice(-4)}@smieciarka.fun`;
    const name = customName || defaultNames[provider];

    const accounts = await this.getRegisteredAccounts();
    let account = accounts.find((a) => a.provider === provider && a.email === email);

    if (!account) {
      account = {
        id: `user_${provider}_${timestamp.toString().slice(-6)}`,
        name,
        email,
        provider,
        createdAt: new Date().toISOString(),
      };
      accounts.push(account);
      await this.saveRegisteredAccounts(accounts);
    }

    const userProfile: UserProfile = {
      id: account.id,
      name: account.name,
      email: account.email,
      provider: account.provider,
      avatarUrl: account.avatarUrl,
      createdAt: account.createdAt,
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, 'false');
    } catch {
      // Ignore
    }

    return userProfile;
  },

  async continueAsGuest(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, 'true');
    } catch {
      // Ignore
    }
  },

  async signOut(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, 'true');
    } catch {
      // Ignore
    }
  },

  async getItemMessages(itemId: string): Promise<ItemMessage[]> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${itemId}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Ignore
    }
    return INITIAL_DEMO_MESSAGES[itemId] || [];
  },

  async sendItemMessage(
    itemId: string,
    itemTitle: string,
    text: string,
    user: UserProfile
  ): Promise<ItemMessage> {
    const existing = await AuthService.getItemMessages(itemId);
    const newMsg: ItemMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      itemId,
      itemTitle,
      senderId: user.id,
      senderName: user.name,
      senderProvider: user.provider,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      isMyMessage: true,
    };

    const updated = [...existing, newMsg];
    try {
      await AsyncStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${itemId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    return newMsg;
  },
};
