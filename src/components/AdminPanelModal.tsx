import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '../services/authService';
import { PostItem, BoardPost } from '../types';
import { CATEGORIES, APP_FONT } from '../constants/categories';
import { CityOption, getCityDisplayLabel } from '../constants/cities';
import {
  AdminSettings,
  DEFAULT_BETA_BANNER_TEXT,
  EcoStats,
  NeighborhoodSettings,
  getNeighborhoodDisplayValue,
} from '../services/storageCache';
import { isSupabaseConfigured } from '../services/supabase';
import { BannerSlotId } from '../constants/banners';
import { AdminModerationTab } from './AdminModerationTab';
import { AdminBannerManager } from './AdminBannerManager';

type AdminTab = 'stats' | 'moderation' | 'notices' | 'settings';

interface AdminPanelModalProps {
  visible: boolean;
  onClose: () => void;
  items: PostItem[];
  boardPosts: BoardPost[];
  savedCount: number;
  ecoStats: EcoStats;
  streakDays: number;
  selectedCity: CityOption | null;
  gpsCityName: string | null;
  neighborhoodSettings: NeighborhoodSettings;
  adminSettings: AdminSettings;
  onUpdateAdminSettings: (next: AdminSettings) => void;
  onOpenItemDetail: (item: PostItem) => void;
  onUpdateItem: (updatedItem: PostItem) => void;
  onResetItemFlags: (itemId: string) => void;
  onRestoreItem: (itemId: string) => void;
  onArchiveItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onBulkItemAction: (itemIds: string[], action: 'restore' | 'archive' | 'delete') => void;
  onUpdateBoardPost: (updatedPost: BoardPost) => void;
  onDeleteBoardPost: (postId: string) => void;
  onToggleBlockAuthor: (authorName: string) => void;
  onUpdateBannerImage: (slotId: BannerSlotId, uri: string | null) => void;
  onResetAllBanners: () => void;
  onPublishOfficialNotice: (title: string, content: string) => void;
  onSyncCloud: () => Promise<number>;
  onResetDemoData: () => void;
  onClearCache: () => Promise<void>;
  onRestartTutorial: () => void;
  isItemActiveCheck: (item: PostItem) => boolean;
}

const ADMIN_TABS: { id: AdminTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: 'stats', label: 'Statystyki', icon: 'chart-box-outline' },
  { id: 'moderation', label: 'Moderacja', icon: 'shield-check-outline' },
  { id: 'notices', label: 'Banery/Info', icon: 'bullhorn-outline' },
  { id: 'settings', label: 'System', icon: 'cog-outline' },
];

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  visible,
  onClose,
  items,
  boardPosts,
  savedCount,
  ecoStats,
  streakDays,
  selectedCity,
  gpsCityName,
  neighborhoodSettings,
  adminSettings,
  onUpdateAdminSettings,
  onOpenItemDetail,
  onUpdateItem,
  onResetItemFlags,
  onRestoreItem,
  onArchiveItem,
  onDeleteItem,
  onBulkItemAction,
  onUpdateBoardPost,
  onDeleteBoardPost,
  onToggleBlockAuthor,
  onUpdateBannerImage,
  onResetAllBanners,
  onPublishOfficialNotice,
  onSyncCloud,
  onResetDemoData,
  onClearCache,
  onRestartTutorial,
  isItemActiveCheck,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [bannerDraft, setBannerDraft] = useState(adminSettings.bannerText);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const checkAdminAccess = async () => {
    setIsCheckingAuth(true);
    setPinInput('');
    setPinError(null);
    const isRoleAdmin = await AuthService.isCurrentUserAdmin();
    if (isRoleAdmin) {
      setIsAuthorized(true);
      setIsCheckingAuth(false);
      return;
    }
    const pinExists = await AuthService.hasLocalAdminPin();
    setHasExistingPin(pinExists);
    setIsAuthorized(false);
    setIsCheckingAuth(false);
  };

  const handlePinSubmit = async () => {
    setPinError(null);
    if (hasExistingPin) {
      const valid = await AuthService.verifyLocalAdminPin(pinInput);
      if (!valid) {
        setPinError('Nieprawidłowy kod PIN administratora.');
        return;
      }
      setIsAuthorized(true);
      setPinInput('');
      return;
    }

    const res = await AuthService.setLocalAdminPin(pinInput);
    if (!res.ok) {
      setPinError(res.error || 'Nie udało się zapisać kodu PIN.');
      return;
    }
    setHasExistingPin(true);
    setIsAuthorized(true);
    setPinInput('');
  };

  const handleClosePanel = () => {
    setIsAuthorized(false);
    setPinInput('');
    setPinError(null);
    onClose();
  };

  const stats = useMemo(() => {
    let activeCount = 0;
    let wystawkaActive = 0;
    let oddamActive = 0;
    let archivedCount = 0;
    let flaggedCount = 0;
    let totalStillThereVotes = 0;
    let totalTakenVotes = 0;
    const categoryCounts: Record<string, number> = {};

    for (const cat of CATEGORIES) {
      categoryCounts[cat.id] = 0;
    }

    for (const item of items) {
      const active = isItemActiveCheck(item);
      if (active) {
        activeCount += 1;
        if (item.type === 'wystawka') wystawkaActive += 1;
        else oddamActive += 1;
      } else {
        archivedCount += 1;
      }
      if (item.takenVotes > 0 && active) {
        flaggedCount += 1;
      }
      totalStillThereVotes += item.stillThereVotes;
      totalTakenVotes += item.takenVotes;
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }

    const totalBoardLikes = boardPosts.reduce((sum, p) => sum + p.likesCount, 0);

    return {
      totalItems: items.length,
      activeCount,
      wystawkaActive,
      oddamActive,
      archivedCount,
      flaggedCount,
      totalStillThereVotes,
      totalTakenVotes,
      boardCount: boardPosts.length,
      totalBoardLikes,
      categoryCounts,
    };
  }, [items, boardPosts, isItemActiveCheck]);

  const handleToggleSetting = (
    key: 'accountsEnabled' | 'adsEnabled' | 'autoExpireEnabled' | 'bannerEnabled',
    val: boolean
  ) => {
    onUpdateAdminSettings({
      ...adminSettings,
      [key]: val,
    });
  };

  const handleAdjustUsersCount = (delta: number) => {
    const nextCount = Math.max(0, adminSettings.usersCount + delta);
    onUpdateAdminSettings({
      ...adminSettings,
      usersCount: nextCount,
    });
  };

  const handleSaveBannerText = () => {
    const cleaned = bannerDraft.trim();
    if (!cleaned) {
      Alert.alert('Pusty komunikat', 'Wpisz treść banera lub wyłącz baner przełącznikiem powyżej.');
      return;
    }
    onUpdateAdminSettings({
      ...adminSettings,
      bannerText: cleaned,
      bannerEnabled: true,
    });
    Alert.alert('Zapisano baner 📢', 'Treść górnego paska informacyjnego została zaktualizowana.');
  };

  const handlePublishNotice = () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      Alert.alert('Uzupełnij komunikat', 'Podaj tytuł oraz treść ogłoszenia administratora.');
      return;
    }
    onPublishOfficialNotice(noticeTitle.trim(), noticeContent.trim());
    setNoticeTitle('');
    setNoticeContent('');
    Alert.alert('Opublikowano ✅', 'Oficjalny komunikat został dodany na Tablicę ogłoszeń.');
  };

  const handleCloudSync = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        'Tryb lokalny',
        'Brak konfiguracji Supabase w .env — aplikacja działa na danych lokalnych i pamięci podręcznej.'
      );
      return;
    }
    setIsSyncing(true);
    try {
      const count = await onSyncCloud();
      Alert.alert('Synchronizacja zakończona ☁️', `Pobrano z chmury: ${count} aktywnych ogłoszeń.`);
    } catch {
      Alert.alert('Błąd synchronizacji', 'Nie udało się połączyć z chmurą Supabase.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onShow={() => {
        setBannerDraft(adminSettings.bannerText);
        void checkAdminAccess();
      }}
      onRequestClose={handleClosePanel}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flexOne}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Nagłówek Admina */}
          <LinearGradient
            colors={['#064E3B', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerLeft}>
              <View style={styles.headerBadgeIcon}>
                <MaterialCommunityIcons name="shield-crown" size={22} color="#FDE68A" />
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.headerTitle}>Panel Administratora</Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  Śmieciarka • {isSupabaseConfigured ? 'Chmura Supabase aktywna' : 'Tryb lokalny (Demo)'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClosePanel} style={styles.closeBtn} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          {!isAuthorized ? (
            <View style={styles.pinGateContainer}>
              {isCheckingAuth ? (
                <ActivityIndicator size="large" color="#059669" />
              ) : (
                <View style={styles.pinGateCard}>
                  <View style={styles.pinIconWrap}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={34} color="#047857" />
                  </View>
                  <Text style={styles.pinGateTitle}>
                    {hasExistingPin ? 'Autoryzacja Administratora' : 'Ustaw PIN Administratora'}
                  </Text>
                  <Text style={styles.pinGateSub}>
                    {hasExistingPin
                      ? 'Podaj kod PIN (4–8 cyfr), aby odblokować narzędzia moderacji i ustawienia.'
                      : 'Utwórz lokalny kod PIN (4–8 cyfr) chroniący dostęp do panelu administratora na tym urządzeniu.'}
                  </Text>
                  <TextInput
                    style={styles.pinInput}
                    value={pinInput}
                    onChangeText={(txt) => {
                      setPinInput(txt.replace(/[^0-9]/g, '').slice(0, 8));
                      if (pinError) setPinError(null);
                    }}
                    placeholder="••••"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={8}
                    onSubmitEditing={() => void handlePinSubmit()}
                  />
                  {pinError && <Text style={styles.pinErrorText}>{pinError}</Text>}
                  <TouchableOpacity
                    style={styles.pinSubmitBtn}
                    onPress={() => void handlePinSubmit()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.pinSubmitText}>
                      {hasExistingPin ? 'Odblokuj Panel' : 'Zapisz PIN i wejdź'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
          <>

          {/* Pasek zakładek */}
          <View style={styles.tabsBar}>
            {ADMIN_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={tab.icon}
                    size={17}
                    color={isActive ? '#047857' : '#64748B'}
                  />
                  <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                    {tab.label}
                  </Text>
                  {tab.id === 'moderation' && stats.flaggedCount > 0 && (
                    <View style={styles.tabAlertDot}>
                      <Text style={styles.tabAlertDotText}>{stats.flaggedCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Zawartość aktywnej zakładki */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'stats' && (
              <View>
                <Text style={styles.sectionTitle}>Kluczowe wskaźniki (na żywo)</Text>
                <View style={styles.kpiGrid}>
                  <View style={[styles.kpiCard, { borderColor: '#A7F3D0' }]}>
                    <MaterialCommunityIcons name="map-marker-check" size={22} color="#059669" />
                    <Text style={styles.kpiValue}>{stats.activeCount}</Text>
                    <Text style={styles.kpiLabel}>Aktywne ogłoszenia</Text>
                    <Text style={styles.kpiHint}>
                      {stats.wystawkaActive} wystawek • {stats.oddamActive} oddam
                    </Text>
                  </View>

                  <View style={[styles.kpiCard, { borderColor: '#FDE68A' }]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#D97706" />
                    <Text style={[styles.kpiValue, { color: '#D97706' }]}>{stats.flaggedCount}</Text>
                    <Text style={styles.kpiLabel}>Zgłoszone (1/2)</Text>
                    <Text style={styles.kpiHint}>
                      {stats.archivedCount} zarchiwizowanych
                    </Text>
                  </View>

                  <View style={[styles.kpiCard, { borderColor: '#BAE6FD' }]}>
                    <MaterialCommunityIcons name="thumb-up-outline" size={22} color="#0284C7" />
                    <Text style={[styles.kpiValue, { color: '#0284C7' }]}>
                      {stats.totalStillThereVotes}
                    </Text>
                    <Text style={styles.kpiLabel}>Głosy „Jeszcze stoi”</Text>
                    <Text style={styles.kpiHint}>
                      {stats.totalTakenVotes} zgłoszeń zabrania
                    </Text>
                  </View>

                  <View style={[styles.kpiCard, { borderColor: '#DDD6FE' }]}>
                    <MaterialCommunityIcons name="account-group" size={22} color="#7C3AED" />
                    <Text style={[styles.kpiValue, { color: '#7C3AED' }]}>
                      {adminSettings.usersCount}
                    </Text>
                    <Text style={styles.kpiLabel}>Społeczność online</Text>
                    <Text style={styles.kpiHint}>
                      {savedCount} zapisanych • seria {streakDays}d
                    </Text>
                  </View>

                  <View style={[styles.kpiCard, { borderColor: '#BBF7D0' }]}>
                    <MaterialCommunityIcons name="molecule-co2" size={22} color="#16A34A" />
                    <Text style={[styles.kpiValue, { color: '#16A34A' }]}>{ecoStats.co2SavedKg} kg</Text>
                    <Text style={styles.kpiLabel}>Zaoszczędzone CO₂</Text>
                    <Text style={styles.kpiHint}>{ecoStats.itemsRescued} uratowanych rzeczy</Text>
                  </View>

                  <View style={[styles.kpiCard, { borderColor: '#E2E8F0' }]}>
                    <MaterialCommunityIcons name="bulletin-board" size={22} color="#334155" />
                    <Text style={styles.kpiValue}>{stats.boardCount}</Text>
                    <Text style={styles.kpiLabel}>Wpisy na Tablicy</Text>
                    <Text style={styles.kpiHint}>{stats.totalBoardLikes} polubień sąsiadów</Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Rozkład kategorii ogłoszeń</Text>
                <View style={styles.cardBox}>
                  {CATEGORIES.map((cat) => {
                    const count = stats.categoryCounts[cat.id] || 0;
                    const pct = stats.totalItems > 0 ? Math.round((count / stats.totalItems) * 100) : 0;
                    return (
                      <View key={cat.id} style={styles.catRow}>
                        <View style={styles.catRowTop}>
                          <View style={styles.catNameGroup}>
                            <MaterialCommunityIcons name={cat.icon as any} size={16} color={cat.color} />
                            <Text style={styles.catName}>{cat.label}</Text>
                          </View>
                          <Text style={styles.catCount}>
                            {count} ({pct}%)
                          </Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${pct}%`, backgroundColor: cat.color },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>

                <Text style={styles.sectionTitle}>Bieżący stan środowiska</Text>
                <View style={styles.cardBox}>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoKey}>Lokalizacja podglądu:</Text>
                    <Text style={styles.infoVal}>{getCityDisplayLabel(selectedCity, gpsCityName)}</Text>
                  </View>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoKey}>Zasięg rewiru:</Text>
                    <Text style={styles.infoVal}>{getNeighborhoodDisplayValue(neighborhoodSettings)}</Text>
                  </View>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoKey}>Konta użytkowników:</Text>
                    <Text style={styles.infoVal}>
                      {adminSettings.accountsEnabled ? 'Włączone' : 'Ukryte (tryb otwarty)'}
                    </Text>
                  </View>
                  <View style={[styles.infoLine, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoKey}>Backend Supabase:</Text>
                    <Text style={[styles.infoVal, { color: isSupabaseConfigured ? '#059669' : '#D97706' }]}>
                      {isSupabaseConfigured ? 'Połączono' : 'Tryb offline / lokalny'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'moderation' && (
              <AdminModerationTab
                items={items}
                boardPosts={boardPosts}
                blockedAuthors={adminSettings.blockedAuthors}
                isItemActiveCheck={isItemActiveCheck}
                onOpenItemDetail={onOpenItemDetail}
                onUpdateItem={onUpdateItem}
                onResetItemFlags={onResetItemFlags}
                onRestoreItem={onRestoreItem}
                onArchiveItem={onArchiveItem}
                onDeleteItem={onDeleteItem}
                onBulkItemAction={onBulkItemAction}
                onUpdateBoardPost={onUpdateBoardPost}
                onDeleteBoardPost={onDeleteBoardPost}
                onToggleBlockAuthor={onToggleBlockAuthor}
              />
            )}

            {activeTab === 'notices' && (
              <View>
                <AdminBannerManager
                  customBanners={adminSettings.customBanners}
                  adsEnabled={adminSettings.adsEnabled}
                  onUpdateBannerImage={onUpdateBannerImage}
                  onResetAllBanners={onResetAllBanners}
                />

                <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
                  Górny baner informacyjny
                </Text>
                <View style={styles.cardBox}>
                  <View style={styles.switchRow}>
                    <View style={styles.flexOne}>
                      <Text style={styles.switchTitle}>Wyświetlaj pomarańczowy baner</Text>
                      <Text style={styles.switchSub}>Pasek widoczny u góry ekranu dla wszystkich użytkowników</Text>
                    </View>
                    <Switch
                      value={adminSettings.bannerEnabled}
                      onValueChange={(val) => handleToggleSetting('bannerEnabled', val)}
                      trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                      thumbColor={adminSettings.bannerEnabled ? '#10B981' : '#F1F5F9'}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Treść komunikatu na pasku:</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={3}
                    value={bannerDraft}
                    onChangeText={setBannerDraft}
                    placeholder="Wpisz treść banera informacyjnego..."
                    placeholderTextColor="#94A3B8"
                  />

                  <View style={styles.rowGap}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => setBannerDraft(DEFAULT_BETA_BANNER_TEXT)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryBtnText}>Domyślny tekst</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={handleSaveBannerText}
                      activeOpacity={0.85}
                    >
                      <MaterialCommunityIcons name="content-save" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Zapisz baner</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Opublikuj komunikat na Tablicy</Text>
                <View style={styles.cardBox}>
                  <Text style={styles.inputLabel}>Tytuł komunikatu:</Text>
                  <TextInput
                    style={styles.textField}
                    value={noticeTitle}
                    onChangeText={setNoticeTitle}
                    placeholder="Np. Wiosenna akcja gabarytowa w mieście!"
                    placeholderTextColor="#94A3B8"
                  />

                  <Text style={styles.inputLabel}>Treść ogłoszenia:</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={4}
                    value={noticeContent}
                    onChangeText={setNoticeContent}
                    placeholder="Napisz ważną informację dla społeczności..."
                    placeholderTextColor="#94A3B8"
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: 6 }]}
                    onPress={handlePublishNotice}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="bullhorn" size={16} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Opublikuj jako Administrator</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'settings' && (
              <View>
                <Text style={styles.sectionTitle}>Moduły i funkcje aplikacji</Text>
                <View style={styles.cardBox}>
                  <View style={styles.switchRow}>
                    <View style={styles.flexOne}>
                      <Text style={styles.switchTitle}>Rejestracja i logowanie kont</Text>
                      <Text style={styles.switchSub}>
                        Po włączeniu pokazuje ekran logowania i przycisk Konta na pulpicie
                      </Text>
                    </View>
                    <Switch
                      value={adminSettings.accountsEnabled}
                      onValueChange={(val) => handleToggleSetting('accountsEnabled', val)}
                      trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                      thumbColor={adminSettings.accountsEnabled ? '#10B981' : '#F1F5F9'}
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <View style={styles.flexOne}>
                      <Text style={styles.switchTitle}>Banery reklamowe</Text>
                      <Text style={styles.switchSub}>
                        Wyświetlanie grafik reklamowych na Pulpicie i w nagłówkach zakładek
                      </Text>
                    </View>
                    <Switch
                      value={adminSettings.adsEnabled}
                      onValueChange={(val) => handleToggleSetting('adsEnabled', val)}
                      trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                      thumbColor={adminSettings.adsEnabled ? '#10B981' : '#F1F5F9'}
                    />
                  </View>

                  <View style={[styles.switchRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <View style={styles.flexOne}>
                      <Text style={styles.switchTitle}>Automatyczne wygasanie (TTL 6h)</Text>
                      <Text style={styles.switchSub}>
                        Ukrywa niepotwierdzone wystawki starsze niż 6 godzin
                      </Text>
                    </View>
                    <Switch
                      value={adminSettings.autoExpireEnabled}
                      onValueChange={(val) => handleToggleSetting('autoExpireEnabled', val)}
                      trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                      thumbColor={adminSettings.autoExpireEnabled ? '#10B981' : '#F1F5F9'}
                    />
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Licznik aktywnych użytkowników</Text>
                <View style={styles.cardBox}>
                  <View style={styles.counterControlRow}>
                    <View>
                      <Text style={styles.switchTitle}>Widoczna liczba osób online</Text>
                      <Text style={styles.switchSub}>Wyświetlana w kółku społeczności na Pulpicie i Mapie</Text>
                    </View>
                    <Text style={styles.counterBigVal}>{adminSettings.usersCount}</Text>
                  </View>
                  <View style={styles.counterBtnsRow}>
                    {[-10, -1, 1, 10].map((delta) => (
                      <TouchableOpacity
                        key={delta}
                        style={styles.counterStepBtn}
                        onPress={() => handleAdjustUsersCount(delta)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.counterStepText}>
                          {delta > 0 ? `+${delta}` : delta}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Narzędzia serwisowe</Text>
                <View style={styles.cardBox}>
                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={handleCloudSync}
                    disabled={isSyncing}
                    activeOpacity={0.8}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color="#059669" />
                    ) : (
                      <MaterialCommunityIcons name="cloud-sync-outline" size={20} color="#059669" />
                    )}
                    <Text style={styles.toolBtnText}>Synchronizuj ogłoszenia z Supabase</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={() => {
                      onResetDemoData();
                      Alert.alert('Gotowe 🔄', 'Przywrócono domyślne ogłoszenia i wpisy demonstracyjne.');
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="database-refresh-outline" size={20} color="#0284C7" />
                    <Text style={styles.toolBtnText}>Przywróć dane demonstracyjne</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={() => {
                      onClose();
                      onRestartTutorial();
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="school-outline" size={20} color="#7C3AED" />
                    <Text style={styles.toolBtnText}>Uruchom samouczek od początku</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toolBtn, { borderBottomWidth: 0 }]}
                    onPress={() =>
                      Alert.alert(
                        'Wyczyścić pamięć podręczną?',
                        'Usunie lokalny cache ogłoszeń (dane startowe pozostaną dostępne).',
                        [
                          { text: 'Anuluj', style: 'cancel' },
                          {
                            text: 'Wyczyść cache',
                            style: 'destructive',
                            onPress: async () => {
                              await onClearCache();
                              Alert.alert('Wyczyszczono 🧹', 'Pamięć podręczna została opróżniona.');
                            },
                          },
                        ]
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="broom" size={20} color="#DC2626" />
                    <Text style={[styles.toolBtnText, { color: '#DC2626' }]}>
                      Wyczyść pamięć podręczną (Cache)
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
          </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flexOne: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  headerBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.4)',
  },
  headerTitle: {
    fontFamily: APP_FONT,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSub: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#A7F3D0',
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  tabBtnActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tabBtnText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#047857',
    fontWeight: '800',
  },
  tabAlertDot: {
    backgroundColor: '#F59E0B',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabAlertDotText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  kpiCard: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  kpiValue: {
    fontFamily: APP_FONT,
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 6,
  },
  kpiLabel: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  kpiHint: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 3,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  catRow: {
    marginBottom: 10,
  },
  catRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  catName: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  catCount: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  progressTrack: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoKey: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  infoVal: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '800',
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 13.5,
    color: '#0F172A',
  },
  filterPillsRow: {
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterPillText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  modCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  modCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeTagText: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '800',
  },
  statusTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagText: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '700',
  },
  flaggedTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flaggedTagText: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  modTimeText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#94A3B8',
  },
  modTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  modSub: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modVotesMeta: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#475569',
    marginTop: 4,
    fontWeight: '600',
  },
  modActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  modActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
  },
  modActionRestore: {
    backgroundColor: '#ECFDF5',
  },
  modActionArchive: {
    backgroundColor: '#FEF3C7',
  },
  modActionDelete: {
    backgroundColor: '#FEF2F2',
  },
  modActionBtnText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  boardTagBadge: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  boardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyBoxText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchTitle: {
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  switchSub: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  inputLabel: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 6,
  },
  textField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: APP_FONT,
    fontSize: 13.5,
    color: '#0F172A',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: APP_FONT,
    fontSize: 13.5,
    color: '#0F172A',
    minHeight: 74,
    textAlignVertical: 'top',
  },
  rowGap: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryBtnText: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  counterControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  counterBigVal: {
    fontFamily: APP_FONT,
    fontSize: 22,
    fontWeight: '900',
    color: '#059669',
  },
  counterBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  counterStepBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  counterStepText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toolBtnText: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  pinGateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pinGateCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pinIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pinGateTitle: {
    fontFamily: APP_FONT,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  pinGateSub: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  pinInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#0F172A',
    marginBottom: 10,
  },
  pinErrorText: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 10,
    textAlign: 'center',
  },
  pinSubmitBtn: {
    width: '100%',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  pinSubmitText: {
    fontFamily: APP_FONT,
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
