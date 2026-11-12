import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { AuthProvider, ItemMessage, UserProfile } from '../types';
import { STRINGS_PL } from '../i18n/pl';
import { ChatRepository } from './chatRepository';
import { StorageCache } from './storageCache';
import { supabase, isSupabaseConfigured } from './supabase';

const KEYS = {
  USER_PROFILE: 'smieciarka_secure_profile_v2',
  GUEST_MODE: 'smieciarka_guest_mode_v1',
  ADMIN_PIN_HASH: 'smieciarka_admin_pin_hash_v1',
  ADMIN_PIN_SALT: 'smieciarka_admin_pin_salt_v1',
};

function validateStrongPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Hasło musi mieć co najmniej 8 znaków.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Hasło musi zawierać co najmniej jedną literę i jedną cyfrę.';
  }
  return null;
}

async function hashPinWithSalt(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export const AuthService = {
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEYS.USER_PROFILE);
      if (raw) {
        return JSON.parse(raw) as UserProfile;
      }
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (user) {
          const isAdmin = user.app_metadata?.role === 'admin';
          const restored: UserProfile = {
            id: user.id,
            name:
              (user.user_metadata?.full_name as string) ||
              user.email?.split('@')[0] ||
              'Sąsiad',
            email: user.email || '',
            avatarUrl: (user.user_metadata?.avatar_url as string) || undefined,
            provider: (user.app_metadata?.provider as AuthProvider) || 'email',
            role: isAdmin ? 'admin' : 'user',
            createdAt: user.created_at || new Date().toISOString(),
          };
          await AuthService.saveUserProfile(restored);
          return restored;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch {
      // Ignore secure store errors
    }
  },

  async isGuestMode(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(KEYS.GUEST_MODE);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async continueAsGuest(): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.GUEST_MODE, 'true');
    } catch {
      // Ignore write error
    }
  },

  async isCurrentUserAdmin(): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { data } = await supabase.auth.getUser();
      return data.user?.app_metadata?.role === 'admin';
    } catch {
      return false;
    }
  },

  async hasLocalAdminPin(): Promise<boolean> {
    try {
      const hash = await SecureStore.getItemAsync(KEYS.ADMIN_PIN_HASH);
      return Boolean(hash);
    } catch {
      return false;
    }
  },

  async setLocalAdminPin(pin: string): Promise<{ ok: boolean; error?: string }> {
    const trimmed = pin.trim();
    if (!/^\d{4,8}$/.test(trimmed)) {
      return { ok: false, error: 'PIN administratora musi składać się z 4–8 cyfr.' };
    }
    try {
      const salt =
        typeof Crypto.randomUUID === 'function'
          ? Crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const digest = await hashPinWithSalt(trimmed, salt);
      await SecureStore.setItemAsync(KEYS.ADMIN_PIN_SALT, salt);
      await SecureStore.setItemAsync(KEYS.ADMIN_PIN_HASH, digest);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Nie udało się zapisać kodu PIN w bezpiecznej pamięci.' };
    }
  },

  async verifyLocalAdminPin(pin: string): Promise<boolean> {
    try {
      const salt = await SecureStore.getItemAsync(KEYS.ADMIN_PIN_SALT);
      const expectedHash = await SecureStore.getItemAsync(KEYS.ADMIN_PIN_HASH);
      if (!salt || !expectedHash) return false;
      const digest = await hashPinWithSalt(pin.trim(), salt);
      return digest === expectedHash;
    } catch {
      return false;
    }
  },

  async signInWithGoogle(): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error:
          'Logowanie Google wymaga skonfigurowanego połączenia z serwerem Supabase w pliku .env.',
      };
    }

    try {
      const redirectTo = makeRedirectUri({
        scheme: 'smieciarka',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) {
        return { success: false, error: error?.message || 'Nie udało się zainicjować logowania Google.' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        const parsed = new URL(result.url);
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const queryParams = parsed.searchParams;

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const authCode = queryParams.get('code');

        let sessionUser = null;
        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) return { success: false, error: sessionErr.message };
          sessionUser = sessionData.user;
        } else if (authCode) {
          const { data: exchangeData, error: exchangeErr } =
            await supabase.auth.exchangeCodeForSession(authCode);
          if (exchangeErr) return { success: false, error: exchangeErr.message };
          sessionUser = exchangeData.user;
        }

        if (sessionUser) {
          const profile: UserProfile = {
            id: sessionUser.id,
            name:
              (sessionUser.user_metadata?.full_name as string) ||
              (sessionUser.user_metadata?.name as string) ||
              sessionUser.email?.split('@')[0] ||
              'Sąsiad Google',
            email: sessionUser.email || '',
            avatarUrl:
              (sessionUser.user_metadata?.avatar_url as string) ||
              (sessionUser.user_metadata?.picture as string) ||
              undefined,
            provider: 'google',
            role: sessionUser.app_metadata?.role === 'admin' ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
          };
          await AuthService.saveUserProfile(profile);
          await AsyncStorage.removeItem(KEYS.GUEST_MODE);
          return { success: true, user: profile };
        }
      }

      return { success: false, error: 'Logowanie Google zostało przerwane.' };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Wystąpił błąd podczas logowania przez Google.',
      };
    }
  },

  async signUpWithEmail(
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string; needsEmailVerification?: boolean }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'Podaj imię lub pseudonim (min. 2 znaki).' };
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Podaj poprawny adres e-mail.' };
    }
    const pwdError = validateStrongPassword(password);
    if (pwdError) {
      return { success: false, error: pwdError };
    }
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Rejestracja wymaga aktywnej konfiguracji serwera Supabase.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: cleanName },
        emailRedirectTo: makeRedirectUri({ scheme: 'smieciarka', path: 'auth/callback' }),
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.session && data.user) {
      return {
        success: false,
        needsEmailVerification: true,
        error: 'Wysłaliśmy link aktywacyjny na Twój e-mail. Potwierdź adres, aby się zalogować.',
      };
    }

    if (!data.user) {
      return { success: false, error: STRINGS_PL.errors.genericAction };
    }

    const profile: UserProfile = {
      id: data.user.id,
      name: cleanName,
      email: data.user.email || cleanEmail,
      provider: 'email',
      role: data.user.app_metadata?.role === 'admin' ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
    };
    await AuthService.saveUserProfile(profile);
    await AsyncStorage.removeItem(KEYS.GUEST_MODE);
    return { success: true, user: profile };
  },

  async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      return { success: false, error: 'Wpisz adres e-mail oraz hasło.' };
    }
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Logowanie wymaga aktywnej konfiguracji serwera Supabase.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user) {
      return { success: false, error: 'Nieprawidłowy adres e-mail lub hasło.' };
    }

    const profile: UserProfile = {
      id: data.user.id,
      name:
        (data.user.user_metadata?.full_name as string) ||
        cleanEmail.split('@')[0],
      email: data.user.email || cleanEmail,
      provider: 'email',
      role: data.user.app_metadata?.role === 'admin' ? 'admin' : 'user',
      createdAt: data.user.created_at || new Date().toISOString(),
    };

    await AuthService.saveUserProfile(profile);
    await AsyncStorage.removeItem(KEYS.GUEST_MODE);
    return { success: true, user: profile };
  },

  async resetPassword(email: string): Promise<{ ok: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { ok: false, error: 'Podaj poprawny adres e-mail do resetu hasła.' };
    }
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, error: 'Reset hasła wymaga połączenia z serwerem Supabase.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: makeRedirectUri({ scheme: 'smieciarka', path: 'auth/reset' }),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async signOut(): Promise<void> {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // Continue clearing local session
    }
    try {
      await SecureStore.deleteItemAsync(KEYS.USER_PROFILE);
      await AsyncStorage.removeItem(KEYS.GUEST_MODE);
    } catch {
      // Ignore cleanup errors
    }
  },

  async deleteAccountAndLocalData(): Promise<{ ok: boolean; error?: string }> {
    try {
      await AuthService.signOut();
      await ChatRepository.clearAllLocalChats();
      await StorageCache.clearAllUserData();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Nie udało się usunąć lokalnych danych konta.',
      };
    }
  },

  async getItemMessages(itemId: string): Promise<ItemMessage[]> {
    const res = await ChatRepository.fetchMessages(itemId);
    return res.ok ? res.data : [];
  },

  async sendItemMessage(
    itemId: string,
    itemTitle: string,
    text: string,
    sender: UserProfile
  ): Promise<ItemMessage> {
    const res = await ChatRepository.sendMessage(itemId, itemTitle, text, {
      id: sender.id,
      name: sender.name,
      provider: sender.provider,
    });
    if (res.ok) return res.data;
    return {
      id: `msg_err_${Date.now()}`,
      itemId,
      itemTitle,
      senderId: sender.id,
      senderName: sender.name,
      senderProvider: sender.provider,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      isMyMessage: true,
    };
  },
};
