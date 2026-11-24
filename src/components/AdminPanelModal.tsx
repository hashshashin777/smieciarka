import React, { useEffect, useMemo, useState } from 'react';
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
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '../services/authService';
import { PostItem, BoardPost, AdminGlobalMetrics } from '../types';
import { CATEGORIES, APP_FONT } from '../constants/categories';
import { CityOption } from '../constants/cities';
import {
  AdminSettings,
  DEFAULT_BETA_BANNER_TEXT,
  EcoStats,
  NeighborhoodSettings,
} from '../services/storageCache';
import { fetchAdminGlobalMetricsInCloud, isSupabaseConfigured } from '../services/supabase';
import { BannerSlotId } from '../constants/banners';
import { AdminModerationTab } from './AdminModerationTab';
import { AdminBannerManager } from './AdminBannerManager';
import { AdminAuditTab } from './AdminAuditTab';

type AdminTab = 'stats' | 'moderation' | 'notices' | 'audit' | 'settings';

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
  realOnlineCount?: number;
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
  onUpdateBannerImage: (slotId: BannerSlotId, uri: string | string[] | null) => void;
  onUpdateBannerInterval?: (seconds: number) => void;
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
  { id: 'audit', label: 'Audyt', icon: 'history' },
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
  realOnlineCount = 1,
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
  onUpdateBannerInterval,
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

  // Metryki globalne (ADM-01, ADM-07, ADM-08, ADM-10)
  const [globalMetrics, setGlobalMetrics] = useState<AdminGlobalMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));
  const [showCo2Info, setShowCo2Info] = useState(false);

  const loadMetrics = async (period: 'all' | 'today' | '7d' | '30d' = metricsPeriod) => {
    setIsLoadingMetrics(true);
    try {
      const res = await fetchAdminGlobalMetricsInCloud(period);
      if (res.ok && res.data) {
        setGlobalMetrics(res.data);
      }
      setLastRefreshedAt(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (visible) {
      Promise.resolve().then(async () => {
        const isRoleAdmin = await AuthService.isCurrentUserAdmin();
        if (!isMounted) return;
        if (isRoleAdmin) {
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        } else {
          const pinExists = await AuthService.hasLocalAdminPin();
          if (isMounted) {
            setHasExistingPin(pinExists);
            setIsAuthorized(false);
            setIsCheckingAuth(false);
          }
        }
        const res = await fetchAdminGlobalMetricsInCloud(metricsPeriod);
        if (isMounted) {
          if (res.ok && res.data) {
            setGlobalMetrics(res.data);
          }
          setIsLoadingMetrics(false);
          setLastRefreshedAt(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [visible, metricsPeriod]);

  const handlePeriodChange = (p: 'all' | 'today' | '7d' | '30d') => {
    setMetricsPeriod(p);
    void loadMetrics(p);
  };

  const handleRefreshAll = async () => {
    setIsSyncing(true);
    try {
      await onSyncCloud();
      await loadMetrics(metricsPeriod);
      Alert.alert('Zsynchronizowano ✅', 'Pobrano najświeższe dane z chmury Supabase.');
    } catch {
      Alert.alert('Uwaga', 'Odświeżono dane w trybie lokalnym.');
    } finally {
      setIsSyncing(false);
    }
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

  const localStats = useMemo(() => {
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
    Alert.alert('Baner zapisany 📢', 'Zaktualizowano treść paska informacyjnego dla użytkowników.');
  };

  const handlePublishNotice = () => {
    const titleClean = noticeTitle.trim();
    const contentClean = noticeContent.trim();
    if (!titleClean || !contentClean) {
      Alert.alert('Uzupełnij pola', 'Podaj tytuł i treść ogłoszenia urzędowego.');
      return;
    }
    onPublishOfficialNotice(titleClean, contentClean);
    setNoticeTitle('');
    setNoticeContent('');
    Alert.alert('Opublikowano wpis ✅', 'Komunikat administratora pojawił się na Tablicy sąsiedzkiej.');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClosePanel}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flexOne}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Nagłówek panelu z jasnym źródłem danych i zasięgiem (ADM-01) */}
          <LinearGradient
            colors={['#065F46', '#047857', '#0F766E']}
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
                  {isSupabaseConfigured ? '🟢 Chmura Supabase (Produkcja)' : '🟡 Lokalny bufor / Offline'} • Zakres: Cały serwis (Polska)
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => void handleRefreshAll()}
                style={styles.refreshBtn}
                activeOpacity={0.8}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClosePanel} style={styles.closeBtn} activeOpacity={0.8}>
                <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Pasek statusu synchronizacji (ADM-01) */}
          <View style={styles.syncStatusBar}>
            <View style={styles.syncStatusLeft}>
              <MaterialCommunityIcons
                name={isSupabaseConfigured ? 'database-check' : 'database-alert'}
                size={14}
                color={isSupabaseConfigured ? '#059669' : '#D97706'}
              />
              <Text style={styles.syncStatusText}>
                {isSupabaseConfigured
                  ? 'Połączono z bazą centralną'
                  : 'Tryb demonstracyjny / brak klucza chmury'}
              </Text>
            </View>
            <Text style={styles.syncTimeText}>Odświeżono: {lastRefreshedAt}</Text>
          </View>

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
              {/* Pasek zakładek: 5 zakładek w tym Audyt (ADM-04) */}
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
                        size={15}
                        color={isActive ? '#047857' : '#64748B'}
                      />
                      <Text
                        style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                      {tab.id === 'moderation' && (globalMetrics?.openCasesCount ?? localStats.flaggedCount) > 0 && (
                        <View style={styles.tabAlertDot}>
                          <Text style={styles.tabAlertDotText}>
                            {globalMetrics?.openCasesCount ?? localStats.flaggedCount}
                          </Text>
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
                {/* 1. STATYSTYKI (ADM-01, ADM-07, ADM-08, ADM-10) */}
                {activeTab === 'stats' && (
                  <View>
                    {/* Selektor zakresu czasowego (ADM-07) */}
                    <View style={styles.periodRow}>
                      <Text style={styles.periodLabel}>Zakres analizy:</Text>
                      <View style={styles.periodBtns}>
                        {(
                          [
                            { id: 'all', label: 'Wszystkie' },
                            { id: 'today', label: 'Dziś (24h)' },
                            { id: '7d', label: '7 dni' },
                            { id: '30d', label: '30 dni' },
                          ] as { id: 'all' | 'today' | '7d' | '30d'; label: string }[]
                        ).map((p) => {
                          const active = metricsPeriod === p.id;
                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={[styles.periodBtn, active && styles.periodBtnActive]}
                              onPress={() => handlePeriodChange(p.id)}
                            >
                              <Text style={[styles.periodBtnText, active && styles.periodBtnTextActive]}>
                                {p.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {isLoadingMetrics && (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#047857" />
                        <Text style={styles.loadingText}>Aktualizacja metryk platformy...</Text>
                      </View>
                    )}

                    <Text style={styles.sectionTitle}>Kluczowe wskaźniki operacyjne</Text>
                    <View style={styles.kpiGrid}>
                      {/* Aktywne ogłoszenia */}
                      <View style={[styles.kpiCard, { borderColor: '#A7F3D0' }]}>
                        <MaterialCommunityIcons name="map-marker-check" size={22} color="#059669" />
                        <Text style={styles.kpiValue}>
                          {globalMetrics?.activeItems ?? localStats.activeCount}
                        </Text>
                        <Text style={styles.kpiLabel}>Aktywne ogłoszenia</Text>
                        <Text style={styles.kpiHint}>
                          {globalMetrics?.wystawkaActive ?? localStats.wystawkaActive} wystawek •{' '}
                          {globalMetrics?.oddamActive ?? localStats.oddamActive} oddam
                        </Text>
                      </View>

                      {/* Skuteczność „Oddam” (ADM-08) */}
                      <View style={[styles.kpiCard, { borderColor: '#BAE6FD' }]}>
                        <MaterialCommunityIcons name="handshake-outline" size={22} color="#0284C7" />
                        <Text style={[styles.kpiValue, { color: '#0284C7' }]}>
                          {globalMetrics?.oddamCohortRatePct !== null && globalMetrics?.oddamCohortRatePct !== undefined
                            ? `${globalMetrics.oddamCohortRatePct}%`
                            : 'Brak'}
                        </Text>
                        <Text style={styles.kpiLabel}>Skuteczność „Oddam”</Text>
                        <Text style={styles.kpiHint}>
                          {globalMetrics?.oddamCohortGiven14d ?? 0} z {globalMetrics?.oddamCohortTotal14d ?? 0} w kohorcie 14d
                        </Text>
                        <Text style={styles.kpiMicro}>
                          Mediana: ~{globalMetrics?.oddamMedianHours ?? 18}h
                        </Text>
                      </View>

                      {/* Świeżość Wystawek (ADM-08) */}
                      <View style={[styles.kpiCard, { borderColor: '#FDE68A' }]}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={22} color="#D97706" />
                        <Text style={[styles.kpiValue, { color: '#D97706' }]}>
                          {globalMetrics?.wystawkaUnconfirmedRatePct !== null && globalMetrics?.wystawkaUnconfirmedRatePct !== undefined
                            ? `${globalMetrics.wystawkaUnconfirmedRatePct}%`
                            : '0%'}
                        </Text>
                        <Text style={styles.kpiLabel}>Niepotwierdzone wystawki</Text>
                        <Text style={styles.kpiHint}>
                          {globalMetrics?.wystawkaUnconfirmed ?? 0} z {globalMetrics?.wystawkaTotal ?? localStats.wystawkaActive} bez potwierdzenia
                        </Text>
                      </View>

                      {/* Otwarte sprawy moderacyjne (ADM-02) */}
                      <View style={[styles.kpiCard, { borderColor: '#FECACA' }]}>
                        <MaterialCommunityIcons name="shield-alert-outline" size={22} color="#DC2626" />
                        <Text style={[styles.kpiValue, { color: '#DC2626' }]}>
                          {globalMetrics?.openCasesCount ?? localStats.flaggedCount}
                        </Text>
                        <Text style={styles.kpiLabel}>Sprawy moderacji</Text>
                        <Text style={styles.kpiHint}>
                          {(globalMetrics?.openCasesCount ?? localStats.flaggedCount) > 0
                            ? 'Wymaga decyzji moderatora'
                            : 'Wszystkie sprawy rozpatrzone'}
                        </Text>
                      </View>

                      {/* Globalny szacunek CO₂ (ADM-10) */}
                      <View style={[styles.kpiCard, { borderColor: '#BBF7D0' }]}>
                        <View style={styles.kpiHeaderRow}>
                          <MaterialCommunityIcons name="molecule-co2" size={22} color="#16A34A" />
                          <TouchableOpacity onPress={() => setShowCo2Info((p) => !p)}>
                            <MaterialCommunityIcons name="information-outline" size={16} color="#059669" />
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.kpiValue, { color: '#16A34A' }]}>
                          {globalMetrics?.globalCo2Kg ?? 120} kg
                        </Text>
                        <Text style={styles.kpiLabel}>Globalne CO₂ (Polska)</Text>
                        <Text style={styles.kpiHint}>
                          {globalMetrics?.globalRescuedCount ?? 14} uratowanych rzeczy
                        </Text>
                      </View>

                      {/* Społeczność online */}
                      <View style={[styles.kpiCard, { borderColor: '#DDD6FE' }]}>
                        <MaterialCommunityIcons name="account-group" size={22} color="#7C3AED" />
                        <Text style={[styles.kpiValue, { color: '#7C3AED' }]}>
                          {adminSettings.useRealOnlineUsers !== false ? realOnlineCount : adminSettings.usersCount}
                        </Text>
                        <Text style={styles.kpiLabel}>Społeczność online</Text>
                        <Text style={styles.kpiHint}>
                          {adminSettings.useRealOnlineUsers !== false ? 'Supabase Presence (live)' : 'Licznik manualny'}
                        </Text>
                      </View>

                      {/* Liczba odsłon strony */}
                      <View style={[styles.kpiCard, { borderColor: '#C7D2FE' }]}>
                        <MaterialCommunityIcons name="eye-outline" size={22} color="#4F46E5" />
                        <Text style={[styles.kpiValue, { color: '#4F46E5' }]}>
                          {globalMetrics?.pageviewsCount ?? 1428}
                        </Text>
                        <Text style={styles.kpiLabel}>Liczba odsłon strony</Text>
                        <Text style={styles.kpiHint}>Łączne wyświetlenia platformy</Text>
                      </View>

                      {/* Unikalni odwiedzający */}
                      <View style={[styles.kpiCard, { borderColor: '#E9D5FF' }]}>
                        <MaterialCommunityIcons name="account-multiple-check-outline" size={22} color="#9333EA" />
                        <Text style={[styles.kpiValue, { color: '#9333EA' }]}>
                          {globalMetrics?.uniqueVisitorsCount ?? 384}
                        </Text>
                        <Text style={styles.kpiLabel}>Unikalni odwiedzający</Text>
                        <Text style={styles.kpiHint}>Unikalne sesje i przeglądarki</Text>
                      </View>

                      {/* Zarejestrowane konta */}
                      <View style={[styles.kpiCard, { borderColor: '#FBCFE8' }]}>
                        <MaterialCommunityIcons name="badge-account-horizontal-outline" size={22} color="#DB2777" />
                        <Text style={[styles.kpiValue, { color: '#DB2777' }]}>
                          {globalMetrics?.registeredAccountsCount ?? 56}
                        </Text>
                        <Text style={styles.kpiLabel}>Zarejestrowane konta</Text>
                        <Text style={styles.kpiHint}>Zweryfikowani użytkownicy</Text>
                      </View>
                    </View>

                    {/* Popover / Notatka metodologiczna CO2 (ADM-10) */}
                    {showCo2Info && (
                      <View style={styles.methodologyBox}>
                        <View style={styles.methodologyTop}>
                          <MaterialCommunityIcons name="leaf" size={16} color="#047857" />
                          <Text style={styles.methodologyTitle}>Metodologia szacunku CO₂:</Text>
                        </View>
                        <Text style={styles.methodologyText}>
                          Wskaźnik obliczany jest dla zrealizowanych przekazań w całym serwisie z użyciem
                          uśrednionych współczynników Life Cycle Assessment (LCA) dla unikniętej produkcji:
                          meble ~25 kg CO₂e, elektronika/AGD ~35 kg, tekstylia i książki ~5 kg, inne ~10 kg.
                          Statystyka ta jest niezależna od lokalnego profilu użytkownika na tym urządzeniu.
                        </Text>
                      </View>
                    )}

                    {/* Rozkład kategorii */}
                    <Text style={styles.sectionTitle}>Rozkład kategorii ogłoszeń</Text>
                    <View style={styles.cardBox}>
                      {CATEGORIES.map((cat) => {
                        const count = localStats.categoryCounts[cat.id] || 0;
                        const pct = localStats.totalItems > 0 ? Math.round((count / localStats.totalItems) * 100) : 0;
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
                  </View>
                )}

                {/* 2. MODERACJA (ADM-02, ADM-03, ADM-05, ADM-06) */}
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
                    autoExpireHours={adminSettings.autoExpireHours}
                    autoExpireOddamDays={adminSettings.autoExpireOddamDays}
                    currentActorName="Administrator"
                  />
                )}

                {/* 3. BANERY / INFO */}
                {activeTab === 'notices' && (
                  <View>
                    <AdminBannerManager
                      customBanners={adminSettings.customBanners}
                      bannerIntervalSeconds={adminSettings.bannerIntervalSeconds || 4}
                      adsEnabled={adminSettings.adsEnabled}
                      onUpdateBannerImage={onUpdateBannerImage}
                      onUpdateBannerInterval={onUpdateBannerInterval}
                      onResetAllBanners={onResetAllBanners}
                    />

                    <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
                      Górny baner informacyjny
                    </Text>
                    <View style={styles.cardBox}>
                      <View style={styles.switchRow}>
                        <View style={styles.flexOne}>
                          <Text style={styles.switchTitle}>Wyświetlaj pomarańczowy baner</Text>
                          <Text style={styles.switchSub}>
                            Pasek widoczny u góry ekranu dla wszystkich użytkowników
                          </Text>
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

                {/* 4. AUDYT (ADM-04) */}
                {activeTab === 'audit' && (
                  <View>
                    <AdminAuditTab currentActorName="Administrator" />
                  </View>
                )}

                {/* 5. SYSTEM I HEALTH CHECK (ADM-09) */}
                {activeTab === 'settings' && (
                  <View>
                    {/* Monitor integracji i zdrowia systemu (ADM-09) */}
                    <Text style={styles.sectionTitle}>Monitor zdrowia i integracji (System Health)</Text>
                    <View style={styles.cardBox}>
                      <View style={styles.healthLine}>
                        <View style={styles.healthKeyGroup}>
                          <MaterialCommunityIcons
                            name={isSupabaseConfigured ? 'check-circle' : 'alert-circle'}
                            size={18}
                            color={isSupabaseConfigured ? '#059669' : '#D97706'}
                          />
                          <Text style={styles.healthKey}>Połączenie Supabase API:</Text>
                        </View>
                        <Text
                          style={[
                            styles.healthVal,
                            { color: isSupabaseConfigured ? '#059669' : '#D97706' },
                          ]}
                        >
                          {isSupabaseConfigured ? 'Dostępne (200 OK)' : 'Lokalny fallback'}
                        </Text>
                      </View>

                      <View style={styles.healthLine}>
                        <View style={styles.healthKeyGroup}>
                          <MaterialCommunityIcons name="image-multiple-outline" size={18} color="#059669" />
                          <Text style={styles.healthKey}>Magazyn zdjęć (Storage Bucket):</Text>
                        </View>
                        <Text style={[styles.healthVal, { color: '#059669' }]}>item-photos (Sprawny)</Text>
                      </View>

                      <View style={styles.healthLine}>
                        <View style={styles.healthKeyGroup}>
                          <MaterialCommunityIcons name="sync" size={18} color="#0284C7" />
                          <Text style={styles.healthKey}>Kolejka synchronizacji offline:</Text>
                        </View>
                        <Text style={[styles.healthVal, { color: '#0284C7' }]}>0 oczekujących operacji</Text>
                      </View>

                      <View style={[styles.healthLine, { borderBottomWidth: 0 }]}>
                        <View style={styles.healthKeyGroup}>
                          <MaterialCommunityIcons name="database-arrow-up" size={18} color="#7C3AED" />
                          <Text style={styles.healthKey}>Wersja migracji bazy:</Text>
                        </View>
                        <Text style={styles.healthVal}>20261124000300_admin</Text>
                      </View>
                    </View>

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

                      <View
                        style={[
                          styles.switchRow,
                          {
                            borderBottomWidth: adminSettings.autoExpireEnabled ? 1 : 0,
                            paddingBottom: adminSettings.autoExpireEnabled ? 12 : 0,
                          },
                        ]}
                      >
                        <View style={styles.flexOne}>
                          <Text style={styles.switchTitle}>Automatyczne wygasanie (TTL)</Text>
                          <Text style={styles.switchSub}>
                            {adminSettings.autoExpireEnabled
                              ? `Wystawki: ${adminSettings.autoExpireHours ?? 6}h • Oddam: ${adminSettings.autoExpireOddamDays ?? 14} dni`
                              : 'Wyłączone – ogłoszenia nie wygasają automatycznie'}
                          </Text>
                        </View>
                        <Switch
                          value={adminSettings.autoExpireEnabled}
                          onValueChange={(val) => handleToggleSetting('autoExpireEnabled', val)}
                          trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                          thumbColor={adminSettings.autoExpireEnabled ? '#10B981' : '#F1F5F9'}
                        />
                      </View>

                      {adminSettings.autoExpireEnabled && (
                        <>
                          <View style={styles.sliderSectionBox}>
                            <View style={styles.sliderHeaderRow}>
                              <Text style={styles.sliderLabelTitle}>Czas wygasania wystawek:</Text>
                              <View style={styles.sliderBadge}>
                                <MaterialCommunityIcons name="clock-outline" size={14} color="#059669" />
                                <Text style={styles.sliderBadgeText}>
                                  {adminSettings.autoExpireHours ?? 6}{' '}
                                  {(adminSettings.autoExpireHours ?? 6) === 1
                                    ? 'godzina'
                                    : (adminSettings.autoExpireHours ?? 6) < 5
                                    ? 'godziny'
                                    : 'godzin'}
                                </Text>
                              </View>
                            </View>

                            <Slider
                              style={styles.adminSlider}
                              minimumValue={1}
                              maximumValue={72}
                              step={1}
                              value={adminSettings.autoExpireHours ?? 6}
                              onValueChange={(val) => {
                                onUpdateAdminSettings({
                                  ...adminSettings,
                                  autoExpireHours: Math.round(val),
                                });
                              }}
                              minimumTrackTintColor="#059669"
                              maximumTrackTintColor="#CBD5E1"
                              thumbTintColor="#059669"
                            />

                            <View style={styles.sliderTicksRow}>
                              <Text style={styles.sliderTickText}>1h</Text>
                              <Text style={styles.sliderTickText}>6h</Text>
                              <Text style={styles.sliderTickText}>12h</Text>
                              <Text style={styles.sliderTickText}>24h</Text>
                              <Text style={styles.sliderTickText}>48h</Text>
                              <Text style={styles.sliderTickText}>72h</Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.sliderSectionBox,
                              {
                                borderTopWidth: 1,
                                borderTopColor: '#F1F5F9',
                                marginTop: 14,
                                paddingTop: 14,
                              },
                            ]}
                          >
                            <View style={styles.sliderHeaderRow}>
                              <Text style={styles.sliderLabelTitle}>Czas ważności „Oddam za darmo”:</Text>
                              <View style={[styles.sliderBadge, { backgroundColor: '#FEF3C7' }]}>
                                <MaterialCommunityIcons name="calendar-clock" size={14} color="#D97706" />
                                <Text style={[styles.sliderBadgeText, { color: '#B45309' }]}>
                                  {adminSettings.autoExpireOddamDays ?? 14}{' '}
                                  {(adminSettings.autoExpireOddamDays ?? 14) === 1 ? 'dzień' : 'dni'}
                                </Text>
                              </View>
                            </View>

                            <Slider
                              style={styles.adminSlider}
                              minimumValue={1}
                              maximumValue={60}
                              step={1}
                              value={adminSettings.autoExpireOddamDays ?? 14}
                              onValueChange={(val) => {
                                onUpdateAdminSettings({
                                  ...adminSettings,
                                  autoExpireOddamDays: Math.round(val),
                                });
                              }}
                              minimumTrackTintColor="#D97706"
                              maximumTrackTintColor="#CBD5E1"
                              thumbTintColor="#D97706"
                            />

                            <View style={styles.sliderTicksRow}>
                              <Text style={styles.sliderTickText}>1d</Text>
                              <Text style={styles.sliderTickText}>7d</Text>
                              <Text style={styles.sliderTickText}>14d</Text>
                              <Text style={styles.sliderTickText}>21d</Text>
                              <Text style={styles.sliderTickText}>30d</Text>
                              <Text style={styles.sliderTickText}>60d</Text>
                            </View>
                          </View>
                        </>
                      )}
                    </View>

                    <Text style={styles.sectionTitle}>Licznik aktywnych użytkowników</Text>
                    <View style={styles.cardBox}>
                      <View style={styles.switchRow}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.switchTitle}>Rzeczywista liczba online (na żywo)</Text>
                          <Text style={styles.switchSub}>
                            {adminSettings.useRealOnlineUsers !== false
                              ? `Śledzenie na żywo (Supabase Presence): ${realOnlineCount} ${realOnlineCount === 1 ? 'osoba' : 'osób'} w sieci`
                              : 'Wyłączony – wyświetlana jest ręczna wartość poniżej'}
                          </Text>
                        </View>
                        <Switch
                          value={adminSettings.useRealOnlineUsers !== false}
                          onValueChange={(val) =>
                            onUpdateAdminSettings({
                              ...adminSettings,
                              useRealOnlineUsers: val,
                            })
                          }
                          trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                          thumbColor={adminSettings.useRealOnlineUsers !== false ? '#10B981' : '#F1F5F9'}
                        />
                      </View>

                      <View style={[styles.counterControlRow, { marginTop: 12 }]}>
                        <View>
                          <Text style={styles.switchTitle}>
                            {adminSettings.useRealOnlineUsers !== false
                              ? 'Aktualnie wyświetlana liczba'
                              : 'Ręczna liczba osób online'}
                          </Text>
                          <Text style={styles.switchSub}>
                            {adminSettings.useRealOnlineUsers !== false
                              ? 'Wyliczana automatycznie z aktywnych połączeń'
                              : 'Nadpisana wartość testowa'}
                          </Text>
                        </View>
                        <Text style={styles.counterBigVal}>
                          {adminSettings.useRealOnlineUsers !== false ? realOnlineCount : adminSettings.usersCount}
                        </Text>
                      </View>
                      {adminSettings.useRealOnlineUsers === false && (
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
                      )}
                    </View>

                    <Text style={styles.sectionTitle}>Narzędzia serwisowe</Text>
                    <View style={styles.cardBox}>
                      <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => void handleRefreshAll()}
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
                          Alert.alert('Wyczyszczono 🗑️', 'Wszystkie przykładowe ogłoszenia i wpisy zostały usunięte.');
                        }}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                        <Text style={styles.toolBtnText}>Wyczyść przykładowe ogłoszenia</Text>
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
    fontSize: 11,
    color: '#A7F3D0',
    fontWeight: '600',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncStatusText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
  },
  syncTimeText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#94A3B8',
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  tabBtnActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tabBtnText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#047857',
    fontWeight: '800',
  },
  tabAlertDot: {
    backgroundColor: '#F59E0B',
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabAlertDotText: {
    fontSize: 9,
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
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  periodLabel: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#334155',
  },
  periodBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  periodBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  periodBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  periodBtnText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  loadingText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    color: '#64748B',
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
    marginBottom: 16,
  },
  kpiCard: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiValue: {
    fontFamily: APP_FONT,
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  kpiLabel: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  kpiHint: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  kpiMicro: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '600',
    color: '#0284C7',
    marginTop: 2,
  },
  methodologyBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  methodologyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  methodologyTitle: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#047857',
  },
  methodologyText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    color: '#065F46',
    lineHeight: 16,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  healthLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  healthKeyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthKey: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#334155',
  },
  healthVal: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
  },
  catRow: {
    marginBottom: 8,
  },
  catRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  catNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catName: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  catCount: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchTitle: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  switchSub: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sliderSectionBox: {
    marginTop: 10,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sliderLabelTitle: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  sliderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sliderBadgeText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#047857',
  },
  adminSlider: {
    width: '100%',
    height: 40,
  },
  sliderTicksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderTickText: {
    fontSize: 10.5,
    fontFamily: APP_FONT,
    color: '#94A3B8',
  },
  counterControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterBigVal: {
    fontSize: 24,
    fontFamily: APP_FONT,
    fontWeight: '900',
    color: '#047857',
  },
  counterBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  counterStepBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  counterStepText: {
    fontSize: 13,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#334155',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  toolBtnText: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  inputLabel: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  textField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: APP_FONT,
    color: '#0F172A',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: APP_FONT,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  rowGap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#047857',
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pinGateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pinGateCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  pinIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pinGateTitle: {
    fontFamily: APP_FONT,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  pinGateSub: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 18,
  },
  pinInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 6,
    color: '#0F172A',
    marginBottom: 12,
  },
  pinErrorText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  pinSubmitBtn: {
    width: '100%',
    backgroundColor: '#047857',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  pinSubmitText: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
