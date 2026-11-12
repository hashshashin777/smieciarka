import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeOpenUrl } from '../utils/helpers';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { APP_FONT } from '../constants/categories';
import { AuthProvider, UserProfile } from '../types';
import { AuthService } from '../services/authService';

// Oficjalne 4-kolorowe logo Google zgodne z Google Sign-In Branding Guidelines
const GoogleLogoIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48" style={{ marginRight: 10 }}>
    <Path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <Path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <Path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <Path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </Svg>
);

interface LoginScreenModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginProvider: (provider: AuthProvider, customName?: string, customEmail?: string) => void;
  onLoginSuccess?: (user: UserProfile) => void;
  onContinueAsGuest: () => void;
}

type AuthTab = 'register' | 'login';

export const LoginScreenModal: React.FC<LoginScreenModalProps> = ({
  visible,
  onClose,
  onLoginProvider,
  onLoginSuccess,
  onContinueAsGuest,
}) => {
  // Tryb: rejestracja nowego konta vs logowanie do istniejącego
  const [activeTab, setActiveTab] = useState<AuthTab>('register');

  // Pola formularza e-mail
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset pól przy zamykaniu/przełączaniu
  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleSocialLogin = async (provider: AuthProvider) => {
    if (provider !== 'google') {
      Alert.alert(
        'Dostępne wkrótce',
        `Logowanie przez ${provider.toUpperCase()} nie jest jeszcze włączone. Użyj konta Google lub e-maila.`
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await AuthService.signInWithGoogle();
      setIsLoading(false);
      if (res.success && res.user) {
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        } else {
          onLoginProvider('google', res.user.name, res.user.email);
        }
        onClose();
        Alert.alert(
          'Witaj w Śmieciarce! 👋',
          `Pomyślnie połączono przez konto Google (${res.user.name}).\nMożesz teraz pisać i odbierać wiadomości od sąsiadów!`
        );
      } else if (res.error) {
        Alert.alert('Logowanie Google', res.error);
      }
    } catch {
      setIsLoading(false);
      Alert.alert('Błąd logowania', 'Nie udało się połączyć konta. Spróbuj ponownie.');
    }
  };

  const handleEmailSubmit = async () => {
    setIsLoading(true);

    if (activeTab === 'register') {
      // Rejestracja nowego konta
      if (!name.trim()) {
        setIsLoading(false);
        Alert.alert('Wymagane imię', 'Podaj swoje imię lub pseudonim sąsiedzki.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setIsLoading(false);
        Alert.alert('Błędny e-mail', 'Podaj poprawny adres e-mail (np. jan@poczta.pl).');
        return;
      }
      if (password.length < 6) {
        setIsLoading(false);
        Alert.alert('Za krótkie hasło', 'Hasło musi mieć co najmniej 6 znaków.');
        return;
      }
      if (password !== confirmPassword) {
        setIsLoading(false);
        Alert.alert('Niezgodne hasła', 'Wpisane hasła nie są identyczne. Sprawdź i popraw.');
        return;
      }

      const res = await AuthService.signUpWithEmail(name, email, password);
      setIsLoading(false);

      if (res.success && res.user) {
        resetForm();
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        } else {
          onLoginProvider('email', res.user.name, res.user.email);
        }
        onClose();
        Alert.alert(
          'Konto utworzone! 🎉',
          `Witaj, ${res.user.name}! Twoje konto e-mail zostało zarejestrowane. Możesz pisać do wystawiających i umawiać odbiory.`
        );
      } else {
        Alert.alert('Błąd rejestracji', res.error || 'Nie udało się zarejestrować konta.');
      }
    } else {
      // Logowanie do istniejącego konta
      if (!email.trim() || !password) {
        setIsLoading(false);
        Alert.alert('Brakujące dane', 'Wpisz adres e-mail oraz hasło.');
        return;
      }

      const res = await AuthService.signInWithEmail(email, password);
      setIsLoading(false);

      if (res.success && res.user) {
        resetForm();
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        } else {
          onLoginProvider('email', res.user.name, res.user.email);
        }
        onClose();
        Alert.alert(
          'Zalogowano! 👋',
          `Witaj ponownie, ${res.user.name}! Twoje wiadomości i ustawienia są aktywne.`
        );
      } else {
        Alert.alert('Błąd logowania', res.error || 'Nieprawidłowy e-mail lub hasło.');
      }
    }
  };

  const handleForgotPassword = async () => {
    const clean = email.trim();
    if (!clean) {
      Alert.alert('Reset hasła 🔑', 'Wpisz najpierw swój adres e-mail w polu powyżej.');
      return;
    }
    setIsLoading(true);
    const res = await AuthService.resetPassword(clean);
    setIsLoading(false);
    if (res.ok) {
      Alert.alert(
        'Sprawdź skrzynkę 📬',
        `Jeśli konto dla ${clean} istnieje, wysłaliśmy instrukcję zresetowania hasła.`
      );
    } else {
      Alert.alert('Reset hasła', res.error || 'Nie udało się wysłać wiadomości resetującej.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onContinueAsGuest}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Pasek górny z przyciskiem zamknięcia do trybu Gość */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onContinueAsGuest}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityLabel="Zamknij i kontynuuj jako gość"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo i Nagłówek */}
            <View style={styles.brandSection}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoLetter}>Ś.</Text>
              </View>
              <Text style={styles.brandTitle}>Śmieciarka</Text>
              <Text style={styles.brandSlogan}>Daj rzeczom drugie życie.</Text>
              <Text style={styles.brandSub}>Konto służy do bezpiecznej wymiany wiadomości o wystawkach</Text>
            </View>

            {/* Karta informacyjna o przeznaczeniu kont */}
            <View style={styles.infoBox}>
              <View style={styles.infoIconBox}>
                <MaterialCommunityIcons name="chat-processing-outline" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Po co jest konto?</Text>
                <Text style={styles.infoText}>
                  Przeglądanie i dodawanie wystawek jest bezpłatne i otwarte dla każdego. Konto jest potrzebne, aby <Text style={{ fontWeight: '800', color: '#10B981' }}>pisać i odbierać wiadomości</Text> o odbiorach bez spamu.
                </Text>
              </View>
            </View>

            {/* Szybka rejestracja / logowanie społecznościowe */}
            <View style={styles.socialButtonsContainer}>
              {/* Google */}
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={() => handleSocialLogin('google')}
                activeOpacity={0.85}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Zarejestruj się przez Google"
              >
                <GoogleLogoIcon size={20} />
                <Text style={styles.googleBtnText}>Kontynuuj z Google</Text>
              </TouchableOpacity>
            </View>

            {/* Separator "LUB ZA POMOCĄ E-MAIL" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>LUB ADRESEM E-MAIL</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Formularz E-mail: Zakładki Rejestracja / Logowanie */}
            <View style={styles.emailCard}>
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'register' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('register')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="account-plus-outline"
                    size={18}
                    color={activeTab === 'register' ? '#10B981' : '#94A3B8'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.tabBtnText, activeTab === 'register' && styles.tabBtnTextActive]}>
                    Rejestracja
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'login' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('login')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="login-variant"
                    size={18}
                    color={activeTab === 'login' ? '#10B981' : '#94A3B8'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.tabBtnText, activeTab === 'login' && styles.tabBtnTextActive]}>
                    Logowanie
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Pola formularza */}
              <View style={styles.formContainer}>
                {activeTab === 'register' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Imię i nazwisko / Nick sąsiedzki</Text>
                    <View style={styles.inputBox}>
                      <MaterialCommunityIcons name="account-outline" size={20} color="#94A3B8" />
                      <TextInput
                        style={styles.inputField}
                        placeholder="np. Ania z Centrum lub Marek"
                        placeholderTextColor="#64748B"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        returnKeyType="next"
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Adres e-mail</Text>
                  <View style={styles.inputBox}>
                    <MaterialCommunityIcons name="email-outline" size={20} color="#94A3B8" />
                    <TextInput
                      style={styles.inputField}
                      placeholder="twoj.email@poczta.pl"
                      placeholderTextColor="#64748B"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Hasło</Text>
                  <View style={styles.inputBox}>
                    <MaterialCommunityIcons name="lock-outline" size={20} color="#94A3B8" />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Minimum 6 znaków"
                      placeholderTextColor="#64748B"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      returnKeyType={activeTab === 'register' ? 'next' : 'done'}
                      onSubmitEditing={activeTab === 'login' ? handleEmailSubmit : undefined}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {activeTab === 'register' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Powtórz hasło</Text>
                    <View style={styles.inputBox}>
                      <MaterialCommunityIcons name="lock-check-outline" size={20} color="#94A3B8" />
                      <TextInput
                        style={styles.inputField}
                        placeholder="Wpisz ponownie hasło"
                        placeholderTextColor="#64748B"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={handleEmailSubmit}
                      />
                    </View>
                  </View>
                )}

                {activeTab === 'login' && (
                  <TouchableOpacity
                    style={styles.forgotBtn}
                    onPress={handleForgotPassword}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotBtnText}>Nie pamiętasz hasła?</Text>
                  </TouchableOpacity>
                )}

                {/* Główny przycisk akcji E-mail z gradientem */}
                <TouchableOpacity
                  style={[styles.submitBtnWrapper, isLoading && styles.submitBtnDisabled]}
                  onPress={handleEmailSubmit}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitBtn}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name={activeTab === 'register' ? 'account-plus' : 'login'}
                          size={20}
                          color="#FFFFFF"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.submitBtnText}>
                          {activeTab === 'register' ? 'Zarejestruj konto e-mail' : 'Zaloguj się e-mailem'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Separator "LUB BEZ LOGOWANIA" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>LUB KORZYSTAJ BEZ KONTA</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Przycisk Trybu Gość */}
            <TouchableOpacity
              style={styles.guestBtn}
              onPress={onContinueAsGuest}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Kontynuuj jako gość bez logowania"
            >
              <View style={styles.guestIconBox}>
                <MaterialCommunityIcons name="account-arrow-right-outline" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guestBtnTitle}>Przeglądaj jako Gość</Text>
                <Text style={styles.guestBtnSub}>
                  Mapa, lista i dodawanie wystawek w 100% bez logowania
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#10B981" />
            </TouchableOpacity>

            {/* Stopka informacyjna i linki prawne */}
            <Text style={styles.footerNote}>
              🛡️ Szanujemy Twoją prywatność. Dodawanie znalezisk nie wymaga logowania.
            </Text>

            <View style={styles.legalLinksRow}>
              <TouchableOpacity
                onPress={() =>
                  void safeOpenUrl(
                    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://smieciarka.fun/privacy'
                  )
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.legalLinkText}>Polityka prywatności</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>•</Text>
              <TouchableOpacity
                onPress={() =>
                  void safeOpenUrl(
                    process.env.EXPO_PUBLIC_TERMS_URL || 'https://smieciarka.fun/terms'
                  )
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.legalLinkText}>Regulamin</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>•</Text>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Usuń lokalne dane',
                    'Spowoduje to wylogowanie oraz wyczyszczenie zapisanej historii czatów, filtrów i danych profilu z tego urządzenia.',
                    [
                      { text: 'Anuluj', style: 'cancel' },
                      {
                        text: 'Usuń dane',
                        style: 'destructive',
                        onPress: async () => {
                          await AuthService.deleteAccountAndLocalData();
                          Alert.alert('Wyczyszczono', 'Lokalne dane konta zostały usunięte.');
                          onContinueAsGuest();
                        },
                      },
                    ]
                  );
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.legalDangerText}>Usuń dane</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#021e26',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 12,
  },
  logoLetter: {
    fontFamily: APP_FONT,
    fontSize: 40,
    fontWeight: '900',
    color: '#10B981',
  },
  brandTitle: {
    fontFamily: APP_FONT,
    fontSize: 27,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandSlogan: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 3,
  },
  brandSub: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    padding: 13,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    gap: 12,
    width: '100%',
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  infoText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
  },
  socialButtonsContainer: {
    width: '100%',
    gap: 10,
  },
  btnIcon: {
    marginRight: 10,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  googleBtnText: {
    fontFamily: APP_FONT,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  emailCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    marginBottom: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  tabBtnText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  formContainer: {
    gap: 13,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginLeft: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  inputField: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 14,
    color: '#FFFFFF',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 2,
  },
  forgotBtnText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
  },
  submitBtnWrapper: {
    borderRadius: 14,
    marginTop: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 78, 59, 0.75)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#10B981',
    gap: 12,
    width: '100%',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  guestIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnTitle: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  guestBtnSub: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#A7F3D0',
    lineHeight: 16,
  },
  footerNote: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingBottom: 16,
  },
  legalLinkText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
  },
  legalDot: {
    fontSize: 12,
    color: '#475569',
  },
  legalDangerText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#F87171',
  },
});