import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { PostItem, ItemType, UserProfile } from '../types';
import { THEME, GRADIENTS, APP_FONT } from '../constants/categories';
import { EcoImpactCard } from './EcoImpactCard';
import {
  EcoStats,
  NeighborhoodSettings,
  NeighborhoodScope,
  MAX_NEIGHBORHOOD_RADIUS_KM,
  NEIGHBORHOOD_SCOPE_OPTIONS,
  clampNeighborhoodRadius,
  getNeighborhoodScope,
  getNeighborhoodDisplayValue,
  getNeighborhoodSubtitle,
} from '../services/storageCache';
import { TutorialTooltip } from './TutorialTooltip';
import { TUTORIAL_STEPS } from '../constants/tutorialSteps';

interface YanosikDashboardProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onOpenMap: () => void;
  onOpenList: (typeFilter?: 'all' | ItemType) => void;
  onOpenSaved: () => void;
  onOpenBoard: () => void;
  onAddNew: () => void;
  onOpenDetail?: (item: PostItem) => void;
  savedCount: number;
  wystawkaCount: number;
  oddamCount: number;
  recentItems: PostItem[];
  usersCount?: number;
  ecoStats?: EcoStats;
  streakDays?: number;
  neighborhoodSettings?: NeighborhoodSettings;
  onOpenNeighborhoodModal?: () => void;
  onChangeRadius?: (newRadius: number) => void;
  onSelectNeighborhoodScope?: (scope: Exclude<NeighborhoodScope, 'radius'>) => void;
  currentUser?: UserProfile | null;
  onOpenLogin?: () => void;
  onSignOut?: () => void;
  isDark?: boolean;
  tutorialStepIndex?: number | null;
  onNextTutorialStep?: () => void;
  onDismissTutorial?: () => void;
  onRestartTutorial?: () => void;
}

export const YanosikDashboard: React.FC<YanosikDashboardProps> = ({
  searchQuery,
  onSearchChange,
  onOpenMap,
  onOpenList,
  onOpenSaved,
  onOpenBoard,
  onAddNew,
  onOpenDetail,
  savedCount,
  wystawkaCount,
  oddamCount,
  recentItems,
  usersCount = 128,
  ecoStats = { itemsRescued: 2, co2SavedKg: 28, postsCreated: 1 },
  streakDays = 3,
  neighborhoodSettings = { radiusKm: 2, scope: 'radius', alertsEnabled: true, label: 'Mój rewir (2 km)' },
  onOpenNeighborhoodModal,
  onChangeRadius,
  onSelectNeighborhoodScope,
  currentUser,
  onOpenLogin,
  onSignOut,
  isDark: _isDark = false,
  tutorialStepIndex = null,
  onNextTutorialStep,
  onDismissTutorial,
  onRestartTutorial,
}) => {
  // Pulpit jest zawsze w jasnym motywie (Light Mode)
  const isDark = false;
  const scrollRef = React.useRef<React.ElementRef<typeof ScrollView>>(null);

  // Samoczynne przewijanie do wskazanego elementu w samouczku
  React.useEffect(() => {
    if (tutorialStepIndex === 1) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else if (tutorialStepIndex === 2) {
      scrollRef.current?.scrollTo({ y: 130, animated: true });
    } else if (tutorialStepIndex === 3) {
      scrollRef.current?.scrollTo({ y: 260, animated: true });
    }
  }, [tutorialStepIndex]);

  // Filtrowanie ogłoszeń na pulpicie (jeśli użytkownik wpisał frazę w wyszukiwarkę)
  const displayedItems = searchQuery.trim().length > 0
    ? recentItems.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (item.location.address && item.location.address.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      )
    : recentItems;
  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 0. PASEK STATUSU KONTA / TRYBU GOŚĆ */}
        <LinearGradient
          colors={isDark ? ['#132425', '#0A1516'] : ['#FFFFFF', '#F2FAF7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.authStatusBar, isDark && styles.authStatusBarDark]}
        >
          {currentUser ? (
            <View style={styles.authStatusLeft}>
              {currentUser.avatarUrl ? (
                <Image source={{ uri: currentUser.avatarUrl }} style={styles.userAvatarImage} />
              ) : (
                <View
                  style={[
                    styles.userAvatarBox,
                    currentUser.provider === 'apple' && { backgroundColor: '#000000' },
                    currentUser.provider === 'google' && { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
                    currentUser.provider === 'facebook' && { backgroundColor: '#1877F2' },
                    currentUser.provider === 'email' && { backgroundColor: '#10B981' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      currentUser.provider === 'apple'
                        ? 'apple'
                        : currentUser.provider === 'google'
                        ? 'google'
                        : currentUser.provider === 'facebook'
                        ? 'facebook'
                        : 'email'
                    }
                    size={15}
                    color={
                      currentUser.provider === 'apple'
                        ? '#FFFFFF'
                        : currentUser.provider === 'google'
                        ? '#EA4335'
                        : currentUser.provider === 'email'
                        ? '#FFFFFF'
                        : '#FFFFFF'
                    }
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.authStatusName, isDark && styles.textWhite]} numberOfLines={1}>
                  {currentUser.name}
                </Text>
                <Text style={styles.authStatusSub}>Konto aktywne • Wiadomości włączone</Text>
              </View>
              {onRestartTutorial && (
                <TouchableOpacity
                  style={styles.tutorialLauncherBtn}
                  onPress={onRestartTutorial}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="school-outline" size={13} color="#059669" />
                  <Text style={styles.tutorialLauncherText}>Samouczek</Text>
                </TouchableOpacity>
              )}
              {onSignOut && (
                <TouchableOpacity
                  style={styles.signOutBtn}
                  onPress={() =>
                    Alert.alert('Wylogowanie', 'Czy na pewno chcesz się wylogować i przejść do trybu Gościa?', [
                      { text: 'Wyloguj', style: 'destructive', onPress: onSignOut },
                      { text: 'Anuluj', style: 'cancel' },
                    ])
                  }
                >
                  <Text style={styles.signOutBtnText}>Wyloguj</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.authStatusGuestRow} onPress={onOpenLogin} activeOpacity={0.8}>
              <View style={styles.guestStatusIcon}>
                <MaterialCommunityIcons name="account-circle-outline" size={20} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guestStatusTitle, isDark && styles.textWhite]}>
                  Tryb Gościa (bez konta)
                </Text>
                <Text style={styles.guestStatusSub}>Zaloguj przez Apple/Google, aby pisać wiadomości</Text>
              </View>
              {onRestartTutorial && (
                <TouchableOpacity
                  style={styles.tutorialLauncherBtn}
                  onPress={onRestartTutorial}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="school-outline" size={13} color="#059669" />
                  <Text style={styles.tutorialLauncherText}>Samouczek</Text>
                </TouchableOpacity>
              )}
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loginPill}
              >
                <Text style={styles.loginPillText}>Zaloguj</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* BANER REKLAMOWY (Własna grafika z zaokrąglonymi brzegami) */}
        <TouchableOpacity
          style={styles.adBannerCard}
          activeOpacity={0.9}
          onPress={() =>
            Alert.alert(
              'Daj przedmiotom drugie życie! 🚛💚',
              'Wystawki i rzeczy do oddania za darmo w Twojej okolicy!\n\nAplikacja dostępna na Android i iOS.',
              [{ text: 'Super!', style: 'default' }]
            )
          }
        >
          <Image
            source={require('../assets/ad_banner.webp')}
            style={styles.adBannerImage}
            resizeMode="cover"
          />
        </TouchableOpacity>

        {/* 1. DUŻY SEARCH BAR ("Czego szukasz w okolicy?") */}
        <View style={[styles.searchBarCard, tutorialStepIndex === 1 && styles.highlightedCard]}>
          <MaterialCommunityIcons name="magnify" size={26} color="#475569" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Czego szukasz w okolicy?"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={onSearchChange}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => onSearchChange('')} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close-circle" size={22} color="#94A3B8" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="microphone" size={24} color="#475569" />
            </TouchableOpacity>
          )}
        </View>

        {/* Chmurka samouczka - Krok 2 (Wyszukiwarka) */}
        {tutorialStepIndex === 1 && (
          <View style={styles.tutorialTooltipWrapper}>
            <TutorialTooltip
              {...TUTORIAL_STEPS[1]}
              onNext={() => onNextTutorialStep?.()}
              onDismiss={() => onDismissTutorial?.()}
            />
          </View>
        )}

        {/* 2. PASEK MÓJ REWIR (Geofencing & Alerty sąsiedzkie ze zintegrowanym suwakiem) */}
        {onOpenNeighborhoodModal && (
          <View style={tutorialStepIndex === 2 && styles.highlightedCardWrapper}>
            <LinearGradient
              colors={isDark ? ['#132E2F', '#0B1B1C'] : ['#FFFFFF', '#EEFAF5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.rewirCard,
                isDark && styles.rewirCardDark,
                tutorialStepIndex === 2 && styles.highlightedCard,
              ]}
            >
              {/* Górny wiersz paska: Tytuł, zasięg i przycisk alertów */}
              <View style={styles.rewirTopRow}>
                <View style={styles.rewirLeft}>
                  <View style={styles.rewirIconBox}>
                    <MaterialCommunityIcons name="map-marker-radius" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.rewirTitle, isDark && styles.textWhite]}>
                        Mój rewir: <Text style={{ color: '#059669', fontWeight: '900' }}>{getNeighborhoodDisplayValue(neighborhoodSettings)}</Text>
                      </Text>
                    </View>
                    <Text style={styles.rewirSub}>
                      {getNeighborhoodSubtitle(neighborhoodSettings)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.rewirAlertBadge, neighborhoodSettings.alertsEnabled ? styles.rewirAlertOn : styles.rewirAlertOff]}
                  onPress={onOpenNeighborhoodModal}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons 
                    name={neighborhoodSettings.alertsEnabled ? 'bell-ring' : 'bell-off'} 
                    size={14} 
                    color={neighborhoodSettings.alertsEnabled ? '#047857' : '#94A3B8'} 
                  />
                  <Text style={[styles.rewirAlertText, neighborhoodSettings.alertsEnabled ? styles.rewirAlertTextOn : styles.rewirAlertTextOff]}>
                    {neighborhoodSettings.alertsEnabled ? 'Alerty WŁ.' : 'WYŁ.'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Suwak regulacji zasięgu (1 - 50 km) */}
              <View style={styles.sliderSection}>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={MAX_NEIGHBORHOOD_RADIUS_KM}
                  step={1}
                  value={clampNeighborhoodRadius(neighborhoodSettings.radiusKm)}
                  onValueChange={(val) => onChangeRadius?.(val)}
                  minimumTrackTintColor={getNeighborhoodScope(neighborhoodSettings) === 'radius' ? '#10B981' : '#94A3B8'}
                  maximumTrackTintColor={isDark ? '#334155' : '#E2E8F0'}
                  thumbTintColor={getNeighborhoodScope(neighborhoodSettings) === 'radius' ? '#059669' : '#64748B'}
                />
                <View style={styles.sliderLabelsRow}>
                  <Text style={styles.sliderLabelMin}>1 km</Text>
                  <Text style={styles.sliderLabelMid}>15 km</Text>
                  <Text style={styles.sliderLabelMid}>30 km</Text>
                  <Text style={styles.sliderLabelMax}>50 km</Text>
                </View>
              </View>

              {/* Szybki wybór szerszego obszaru: Całe miasto / Całe województwo / Cała Polska */}
              <View style={styles.scopeChipsRow}>
                {NEIGHBORHOOD_SCOPE_OPTIONS.map((opt) => {
                  const isActive = getNeighborhoodScope(neighborhoodSettings) === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.scopeChip, isActive && styles.scopeChipActive]}
                      onPress={() => onSelectNeighborhoodScope?.(opt.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name={opt.icon}
                        size={13}
                        color={isActive ? '#FFFFFF' : '#475569'}
                      />
                      <Text style={[styles.scopeChipText, isActive && styles.scopeChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </LinearGradient>

            {/* Chmurka samouczka - Krok 3 (Mój rewir) */}
            {tutorialStepIndex === 2 && (
              <View style={styles.tutorialTooltipWrapper}>
                <TutorialTooltip
                  {...TUTORIAL_STEPS[2]}
                  onNext={() => onNextTutorialStep?.()}
                  onDismiss={() => onDismissTutorial?.()}
                />
              </View>
            )}
          </View>
        )}

        {/* 3. 4 KAFELKI SKRÓTÓW (Wystawki / Oddam / Tablica / Zapisane z gradientem) */}
        <View style={styles.quickGridRow}>
          {/* Kafelek 1: Wystawki */}
          <TouchableOpacity
            style={styles.gridTileWrapper}
            onPress={() => onOpenList('wystawka')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isDark ? ['#142526', '#0C1819'] : ['#FFFFFF', '#F2FAF7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gridTile}
            >
              <View style={[styles.tileBadgePlus, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.plusText}>{wystawkaCount}</Text>
              </View>
              <View style={styles.tileIconContainer}>
                <MaterialCommunityIcons name="dump-truck" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.tileLabel}>Wystawki</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Kafelek 2: Oddam */}
          <TouchableOpacity
            style={styles.gridTileWrapper}
            onPress={() => onOpenList('oddam')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isDark ? ['#142526', '#0C1819'] : ['#FFFFFF', '#F2FAF7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gridTile}
            >
              <View style={[styles.tileBadgePlus, { backgroundColor: '#059669' }]}>
                <Text style={[styles.plusText, { color: '#FFFFFF' }]}>{oddamCount}</Text>
              </View>
              <View style={styles.tileIconContainer}>
                <MaterialCommunityIcons name="gift" size={28} color="#059669" />
              </View>
              <Text style={styles.tileLabel}>Oddam</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Kafelek 3: Tablica */}
          <TouchableOpacity
            style={styles.gridTileWrapper}
            onPress={onOpenBoard}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isDark ? ['#142526', '#0C1819'] : ['#FFFFFF', '#F2FAF7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gridTile}
            >
              <View style={styles.tileIconContainer}>
                <MaterialCommunityIcons name="bulletin-board" size={28} color="#475569" />
              </View>
              <Text style={styles.tileLabel}>Tablica</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Kafelek 4: Zapisane (dokładnie jak gwiazdka w Yanosiku) */}
          <TouchableOpacity
            style={styles.gridTileWrapper}
            onPress={onOpenSaved}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isDark ? ['#142526', '#0C1819'] : ['#FFFFFF', '#F2FAF7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gridTile}
            >
              <View style={[styles.tileBadgePlus, { backgroundColor: THEME.starYellow }]}>
                <Text style={[styles.plusText, { color: '#78350F' }]}>{savedCount}</Text>
              </View>
              <View style={styles.tileIconContainer}>
                <MaterialCommunityIcons name="star" size={28} color={THEME.starYellow} />
              </View>
              <Text style={styles.tileLabel}>Zapisane</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 4. DWA KAFELKI AKCJI (Ostatnie znaleziska + Mapa Otwórz nawigację) */}
        <View style={styles.splitCardsRow}>
          {/* Lewy kafelek: Ostatnie znaleziska (biały z gradientem) */}
          <TouchableOpacity
            style={styles.splitCardWrapper}
            onPress={() => onOpenList('all')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isDark ? ['#142526', '#0C1819'] : ['#FFFFFF', '#F0F9F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.splitCardLeft}
            >
              <View style={styles.splitCardLeftIconRow}>
                <MaterialCommunityIcons name="format-list-bulleted-square" size={26} color="#334155" />
              </View>
              <Text style={styles.splitCardLeftTitle}>Lista znalezisk</Text>
              <Text style={styles.splitCardLeftSub}>Zobacz szczegóły</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Prawy kafelek: Mapa (Zieleń i delikatny gradient jak button aparatu) */}
          <TouchableOpacity
            style={[styles.splitCardWrapper, tutorialStepIndex === 3 && styles.highlightedSplitCard]}
            onPress={onOpenMap}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.splitCardRight}
            >
              <View style={styles.splitCardRightIconRow}>
                <MaterialCommunityIcons name="navigation-variant" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.splitCardRightTitle}>Mapa</Text>
              <Text style={styles.splitCardRightSub}>Wystawki na żywo</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Chmurka samouczka - Krok 4 (Mapa) */}
        {tutorialStepIndex === 3 && (
          <View style={styles.tutorialTooltipWrapper}>
            <TutorialTooltip
              {...TUTORIAL_STEPS[3]}
              onNext={() => onNextTutorialStep?.()}
              onDismiss={() => onDismissTutorial?.()}
            />
          </View>
        )}

        {/* 5. TWÓJ WPŁYW ZERO-WASTE */}
        <EcoImpactCard stats={ecoStats} streakDays={streakDays} isDark={isDark} />

        {/* 6. ZNALEZISKA W OKOLICY (Wszystkie ogłoszenia z możliwością przewijania) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            {searchQuery ? `Wyniki wyszukiwania (${displayedItems.length})` : `Wszystkie ogłoszenia (${displayedItems.length})`}
          </Text>
          <TouchableOpacity onPress={() => onOpenList('all')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.sectionHeaderLink}>Pokaż w liście</Text>
          </TouchableOpacity>
        </View>

        {displayedItems.map((item, idx) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.recentItemBannerWrapper, idx > 0 && { marginTop: 10 }]}
            onPress={() => (onOpenDetail ? onOpenDetail(item) : onOpenList('all'))}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isDark ? ['#132425', '#0B1516'] : ['#FFFFFF', '#F8FCFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.recentItemBanner}
            >
              {item.photos && item.photos.length > 0 ? (
                <Image source={{ uri: item.photos[0] }} style={styles.recentItemImg} />
              ) : (
                <View style={styles.recentItemPlaceholder}>
                  <MaterialCommunityIcons
                    name={item.type === 'wystawka' ? 'dump-truck' : 'gift'}
                    size={24}
                    color={item.type === 'wystawka' ? '#F59E0B' : '#059669'}
                  />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.recentBadgeRow}>
                  <Text
                    style={[
                      styles.recentBadgeText,
                      item.type === 'wystawka' ? { color: '#D97706' } : { color: '#047857' },
                    ]}
                  >
                    {idx === 0 ? 'NAJNOWSZE ZNALEZISKO' : item.type === 'wystawka' ? 'WYSTAWKA W OKOLICY' : 'ODDAM ZA DARMO'}
                  </Text>
                </View>
                <Text style={styles.recentItemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.recentItemSub} numberOfLines={1}>
                  {item.location.address || 'Sprawdź odległość'}
                </Text>
              </View>
              <View style={styles.playArrowCircle}>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
        {displayedItems.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-search-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Brak wyników dla „{searchQuery}”</Text>
          </View>
        )}
      </ScrollView>

      {/* 7. OKRĄGŁY PŁYWAJĄCY PRZYCISK SPOŁECZNOŚCI (Identyczny jak "290 K" w Yanosiku!) */}
      <View style={styles.floatingCommunityBadge}>
        <LinearGradient
          colors={['#10B981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.floatingBadgeInner}
        >
          <MaterialCommunityIcons name="account-multiple" size={24} color="#FFFFFF" />
          <Text style={[styles.floatingBadgeCount, { color: '#FFFFFF' }]}>{usersCount}</Text>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Jasnoszary, czysty odcień tła w stylu Yanosik
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 125,
  },
  // Status konta / Gość
  authStatusBar: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  authStatusBarDark: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  authStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  authStatusName: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  authStatusSub: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '600',
  },
  signOutBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  signOutBtnText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  authStatusGuestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guestStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestStatusTitle: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  guestStatusSub: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    color: '#64748B',
  },
  loginPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  loginPillText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Baner reklamowy (Własna grafika z zaokrąglonymi brzegami przeskalowana do 1080x341)
  adBannerCard: {
    width: '100%',
    aspectRatio: 1080 / 341,
    backgroundColor: '#02242E',
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#063B4B',
    overflow: 'hidden', // Gwarantuje idealnie zaokrąglone brzegi obrazka
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBannerImage: {
    width: '100%',
    height: '100%',
  },
  // 1. Search bar
  searchBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 15.5,
    color: '#0F172A',
    fontWeight: '500',
    height: '100%',
  },
  micBtn: {
    padding: 6,
  },

  // 2. Mój Rewir
  rewirCard: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rewirCardDark: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  rewirTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rewirLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rewirIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  rewirTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  textWhite: {
    color: '#F8FAFC',
  },
  rewirSub: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  rewirAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  rewirAlertOn: {
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0',
  },
  rewirAlertOff: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  rewirAlertText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
  },
  rewirAlertTextOn: {
    color: '#047857',
  },
  rewirAlertTextOff: {
    color: '#64748B',
  },
  sliderSection: {
    marginTop: 4,
    paddingTop: 4,
  },
  slider: {
    width: '100%',
    height: 34,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: -4,
  },
  sliderLabelMin: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  sliderLabelMid: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
  },
  sliderLabelMax: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  scopeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  scopeChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  scopeChipText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  scopeChipTextActive: {
    color: '#FFFFFF',
  },

  // 3. Quick 4 Tiles
  quickGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridTileWrapper: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  gridTile: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  tileIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileBadgePlus: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  plusText: {
    fontFamily: APP_FONT,
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  tileLabel: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },

  // 4. Split Cards (Lewa biała z gradientem / Prawa zielona z gradientem)
  splitCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  splitCardWrapper: {
    flex: 1,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  splitCardLeft: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  splitCardLeftIconRow: {
    marginBottom: 10,
  },
  splitCardLeftTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  splitCardLeftSub: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  splitCardRight: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  splitCardRightIconRow: {
    marginBottom: 10,
  },
  splitCardRightTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  splitCardRightSub: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#E6FAF5',
    fontWeight: '600',
    marginTop: 2,
  },

  // 5. Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeaderLink: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#059669',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },

  // 6. Recent Item
  recentItemBannerWrapper: {
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  recentItemBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recentItemImg: {
    width: 54,
    height: 54,
    borderRadius: 12,
  },
  recentItemPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  recentBadgeRow: {
    marginBottom: 2,
  },
  recentBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  recentItemTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  recentItemSub: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  playArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 7. Floating Community Badge (Prawy dolny róg jak "290 K" w Yanosiku!)
  floatingCommunityBadge: {
    position: 'absolute',
    bottom: 96,
    right: 18,
    zIndex: 30,
  },
  floatingBadgeInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  floatingBadgeCount: {
    fontFamily: APP_FONT,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },

  // Style samouczka (Kroki 2, 3, 4 oraz przycisk restartu)
  tutorialTooltipWrapper: {
    marginTop: 6,
    marginBottom: 8,
    zIndex: 100,
  },
  highlightedCardWrapper: {
    marginBottom: 12,
  },
  highlightedCard: {
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  highlightedSplitCard: {
    transform: [{ scale: 1.02 }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  tutorialLauncherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 20,
    marginRight: 6,
  },
  tutorialLauncherText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
});
