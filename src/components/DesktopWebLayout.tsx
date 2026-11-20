import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PostItem, ItemType, BoardPost, UserProfile } from '../types';
import { CATEGORIES, THEME } from '../constants/categories';
import { CityOption, getCityDisplayLabel } from '../constants/cities';
import { calculateDistance, formatRelativeTime, safeOpenUrl } from '../utils/helpers';
import { EcoStats, AdminSettings } from '../services/storageCache';

interface DesktopWebLayoutProps {
  items: PostItem[];
  boardPosts: BoardPost[];
  savedItemIds: string[];
  savedBoardPostIds: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterType: 'all' | ItemType;
  onSelectFilterType: (type: 'all' | ItemType) => void;
  filterCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  selectedCity: CityOption | null;
  gpsCityName: string | null;
  onOpenCityPicker: () => void;
  onOpenDetail: (item: PostItem) => void;
  onOpenAddModal: () => void;
  onOpenBoardModal: () => void;
  onToggleSaveItem: (item: PostItem) => void;
  onToggleSaveBoardPost: (post: BoardPost) => void;
  onStillThere: (itemId: string) => void;
  onTakeItem: (item: PostItem) => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  ecoStats: EcoStats;
  usersCount: number;
  userCoords?: { latitude: number; longitude: number } | null;
  adminSettings: AdminSettings;
}

type DesktopTab = 'all' | 'wystawka' | 'oddam' | 'board' | 'map' | 'saved';

export const DesktopWebLayout: React.FC<DesktopWebLayoutProps> = ({
  items,
  boardPosts,
  savedItemIds,
  savedBoardPostIds,
  searchQuery,
  onSearchChange,
  filterType,
  onSelectFilterType,
  filterCategory,
  onSelectCategory,
  selectedCity,
  gpsCityName,
  onOpenCityPicker,
  onOpenDetail,
  onOpenAddModal,
  onOpenBoardModal,
  onToggleSaveItem,
  onToggleSaveBoardPost,
  onStillThere,
  onTakeItem,
  currentUser,
  onOpenAuth,
  onOpenAdmin,
  ecoStats,
  usersCount,
  userCoords,
  adminSettings,
}) => {
  const [activeTab, setActiveTab] = useState<DesktopTab>('all');
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = () => {
    onSearchChange(localSearch);
  };

  // Sync tab change with filterType
  const handleTabChange = (tab: DesktopTab) => {
    setActiveTab(tab);
    if (tab === 'wystawka') {
      onSelectFilterType('wystawka');
    } else if (tab === 'oddam') {
      onSelectFilterType('oddam');
    } else if (tab === 'all') {
      onSelectFilterType('all');
    }
  };

  // Filtered items based on tab, category, search
  const displayedItems = useMemo(() => {
    let result = [...items];

    if (activeTab === 'wystawka') {
      result = result.filter((i) => i.type === 'wystawka');
    } else if (activeTab === 'oddam') {
      result = result.filter((i) => i.type === 'oddam');
    } else if (activeTab === 'saved') {
      result = result.filter((i) => savedItemIds.includes(i.id));
    }

    if (filterCategory) {
      result = result.filter((i) => i.category === filterCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.location.address && i.location.address.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, activeTab, filterCategory, searchQuery, savedItemIds]);

  // Filtered board posts for board or saved tabs
  const displayedBoardPosts = useMemo(() => {
    let result = [...boardPosts];
    if (activeTab === 'saved') {
      result = result.filter((p) => savedBoardPostIds.includes(p.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          (p.locationArea && p.locationArea.toLowerCase().includes(q))
      );
    }
    return result;
  }, [boardPosts, activeTab, savedBoardPostIds, searchQuery]);

  const cityLabel = getCityDisplayLabel(selectedCity, gpsCityName);

  return (
    <ScrollView style={styles.pageContainer} contentContainerStyle={styles.pageContent}>
      {/* 1. TOP OLX-STYLE NAVBAR */}
      <header style={{ width: '100%' } as any}>
        <View style={styles.topNavbar}>
          <View style={styles.topNavbarInner}>
            {/* Logo */}
            <TouchableOpacity
              style={styles.logoContainer}
              onPress={() => {
                handleTabChange('all');
                onSelectCategory(null);
                onSearchChange('');
                setLocalSearch('');
              }}
              activeOpacity={0.8}
            >
              <Image
                source={require('../assets/web_logo.webp')}
                style={styles.webLogoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Right Action Menu */}
            <View style={styles.topNavActions}>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => handleTabChange('board')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="forum-outline" size={20} color="#FFFFFF" />
                <Text style={styles.navLinkText}>Tablica sąsiedzka</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navLink}
                onPress={() => handleTabChange('saved')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={savedItemIds.length > 0 ? 'heart' : 'heart-outline'}
                  size={20}
                  color={savedItemIds.length > 0 ? '#EF4444' : '#FFFFFF'}
                />
                <Text style={styles.navLinkText}>
                  Zapisane ({savedItemIds.length + savedBoardPostIds.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navLink}
                onPress={onOpenAuth}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="account-circle-outline" size={22} color="#FFFFFF" />
                <Text style={styles.navLinkText}>
                  {currentUser ? currentUser.name || 'Twoje konto' : 'Zaloguj się'}
                </Text>
              </TouchableOpacity>

              {currentUser?.role === 'admin' && (
                <TouchableOpacity
                  style={[styles.navLink, styles.adminPill]}
                  onPress={onOpenAdmin}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="shield-crown-outline" size={18} color="#FBBF24" />
                  <Text style={[styles.navLinkText, { color: '#FBBF24', fontWeight: '700' }]}>Admin</Text>
                </TouchableOpacity>
              )}

              {/* High-contrast Add Button (OLX Style) */}
              <TouchableOpacity
                style={styles.addCtaButton}
                onPress={onOpenAddModal}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#002F34" />
                <Text style={styles.addCtaButtonText}>Dodaj ogłoszenie</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 2. HERO SEARCH SECTION (OLX Style) */}
        <View style={styles.heroSearchSection}>
          <View style={styles.heroSearchInner}>
            {/* Featured Wide Banner above Search */}
            <View style={styles.bannerWrapper}>
              <Image
                source={require('../assets/ad_banner.webp')}
                style={styles.heroBannerImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.searchBarBox}>
              {/* Field 1: Search query */}
              <View style={styles.searchInputWrapper}>
                <MaterialCommunityIcons name="magnify" size={24} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Czego szukasz? (np. szafa, fotel, pralka, rower, książki...)"
                  placeholderTextColor="#94A3B8"
                  value={localSearch}
                  onChangeText={setLocalSearch}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                />
                {localSearch.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setLocalSearch('');
                      onSearchChange('');
                    }}
                    style={{ padding: 4 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Vertical Divider */}
              <View style={styles.searchDivider} />

              {/* Field 2: City / Location picker */}
              <TouchableOpacity
                style={styles.searchLocationWrapper}
                onPress={onOpenCityPicker}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={22} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.searchLocationText} numberOfLines={1}>
                  {cityLabel}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              {/* Search Submit Button */}
              <TouchableOpacity
                style={styles.searchSubmitButton}
                onPress={handleSearchSubmit}
                activeOpacity={0.85}
              >
                <Text style={styles.searchSubmitButtonText}>Szukaj</Text>
                <MaterialCommunityIcons name="magnify" size={20} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>

            {/* Quick stats pill row under search */}
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <MaterialCommunityIcons name="account-group-outline" size={16} color="#059669" />
                <Text style={styles.heroStatText}>
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>{usersCount}</Text> sąsiadów online
                </Text>
              </View>
              <View style={styles.heroStatDot} />
              <View style={styles.heroStatItem}>
                <MaterialCommunityIcons name="recycle" size={16} color="#059669" />
                <Text style={styles.heroStatText}>
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>{ecoStats.itemsRescued}</Text> uratowanych rzeczy
                </Text>
              </View>
              <View style={styles.heroStatDot} />
              <View style={styles.heroStatItem}>
                <MaterialCommunityIcons name="leaf" size={16} color="#059669" />
                <Text style={styles.heroStatText}>
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>{ecoStats.co2SavedKg} kg</Text> zaoszczędzonego CO₂
                </Text>
              </View>
            </View>
          </View>
        </View>
      </header>

      {/* 3. CATEGORIES SECTION (OLX Circular Icon Circles) */}
      <View style={styles.categoriesContainer}>
        <View style={styles.categoriesInner}>
          <Text style={styles.sectionHeaderTitle}>Kategorie główne</Text>
          <View style={styles.categoriesGrid}>
            <TouchableOpacity
              style={[
                styles.categoryCircleCard,
                filterCategory === null && styles.categoryCircleCardActive,
              ]}
              onPress={() => onSelectCategory(null)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.categoryCircleIcon,
                  { backgroundColor: filterCategory === null ? '#059669' : '#E2E8F0' },
                ]}
              >
                <MaterialCommunityIcons
                  name="view-grid-outline"
                  size={26}
                  color={filterCategory === null ? '#FFFFFF' : '#334155'}
                />
              </View>
              <Text
                style={[
                  styles.categoryCircleLabel,
                  filterCategory === null && styles.categoryCircleLabelActive,
                ]}
                numberOfLines={1}
              >
                Wszystko
              </Text>
            </TouchableOpacity>

            {CATEGORIES.map((cat) => {
              const isSelected = filterCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryCircleCard,
                    isSelected && styles.categoryCircleCardActive,
                  ]}
                  onPress={() => onSelectCategory(isSelected ? null : cat.id)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.categoryCircleIcon,
                      { backgroundColor: isSelected ? cat.color : `${cat.color}20` },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon as any}
                      size={26}
                      color={isSelected ? '#FFFFFF' : cat.color}
                    />
                  </View>
                  <Text
                    style={[
                      styles.categoryCircleLabel,
                      isSelected && styles.categoryCircleLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* 4. MAIN CONTENT CONTAINER */}
      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' } as any}>
        <View style={styles.mainContentWrapper}>
          {/* Navigation Tabs (All, Wystawki, Do oddania, Tablica, Mapa, Zapisane) */}
          <View style={styles.tabsNavRow}>
            <View style={styles.tabsLeftGroup}>
              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'all' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('all')}
              >
                <MaterialCommunityIcons
                  name="format-list-bulleted"
                  size={18}
                  color={activeTab === 'all' ? '#059669' : '#64748B'}
                />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'all' && styles.desktopTabTextActive,
                  ]}
                >
                  Wszystkie ogłoszenia ({items.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'wystawka' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('wystawka')}
              >
                <View style={[styles.tabBadgeDot, { backgroundColor: '#F59E0B' }]} />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'wystawka' && styles.desktopTabTextActive,
                  ]}
                >
                  Wystawki uliczne ({items.filter((i) => i.type === 'wystawka').length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'oddam' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('oddam')}
              >
                <View style={[styles.tabBadgeDot, { backgroundColor: '#10B981' }]} />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'oddam' && styles.desktopTabTextActive,
                  ]}
                >
                  Do oddania ({items.filter((i) => i.type === 'oddam').length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'board' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('board')}
              >
                <MaterialCommunityIcons
                  name="bulletin-board"
                  size={18}
                  color={activeTab === 'board' ? '#059669' : '#64748B'}
                />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'board' && styles.desktopTabTextActive,
                  ]}
                >
                  Tablica sąsiedzka ({boardPosts.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.desktopTabItem, activeTab === 'map' && styles.desktopTabItemActive]}
                onPress={() => handleTabChange('map')}
              >
                <MaterialCommunityIcons
                  name="map-outline"
                  size={18}
                  color={activeTab === 'map' ? '#059669' : '#64748B'}
                />
                <Text
                  style={[
                    styles.desktopTabText,
                    activeTab === 'map' && styles.desktopTabTextActive,
                  ]}
                >
                  Widok mapy
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filter Reset pill if active */}
            {(filterCategory || searchQuery) && (
              <TouchableOpacity
                style={styles.clearFilterPill}
                onPress={() => {
                  onSelectCategory(null);
                  onSearchChange('');
                  setLocalSearch('');
                }}
              >
                <MaterialCommunityIcons name="filter-remove-outline" size={16} color="#DC2626" />
                <Text style={styles.clearFilterText}>Wyczyść filtry</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* TAB: BOARD POSTS */}
          {activeTab === 'board' && (
            <View style={styles.boardContainer}>
              <View style={styles.boardHeaderRow}>
                <View>
                  <Text style={styles.boardSectionTitle}>Tablica Ogłoszeń Sąsiedzkich</Text>
                  <Text style={styles.boardSectionSub}>
                    Zapytaj sąsiadów, zgłoś poszukiwany przedmiot lub podziel się wieściami w okolicy.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addBoardPostBtn}
                  onPress={onOpenBoardModal}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                  <Text style={styles.addBoardPostBtnText}>Dodaj wpis na tablicę</Text>
                </TouchableOpacity>
              </View>

              {displayedBoardPosts.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <MaterialCommunityIcons name="message-text-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>Brak wpisów na tablicy</Text>
                  <Text style={styles.emptyStateDesc}>
                    Bądź pierwszą osobą, która zada pytanie lub napisze do sąsiadów!
                  </Text>
                </View>
              ) : (
                <View style={styles.boardGrid}>
                  {displayedBoardPosts.map((post) => {
                    const isSaved = savedBoardPostIds.includes(post.id);
                    return (
                      <View key={post.id} style={styles.boardCard}>
                        <View style={styles.boardCardHeader}>
                          <View style={styles.boardAuthorInfo}>
                            <View style={styles.boardAvatar}>
                              <Text style={styles.boardAvatarText}>
                                {(post.authorName || 'Sąsiad').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.boardAuthorName}>{post.authorName || 'Sąsiad'}</Text>
                              <Text style={styles.boardPostTime}>{formatRelativeTime(post.createdAt)}</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => onToggleSaveBoardPost(post)}
                            style={{ padding: 6 }}
                          >
                            <MaterialCommunityIcons
                              name={isSaved ? 'heart' : 'heart-outline'}
                              size={20}
                              color={isSaved ? '#EF4444' : '#94A3B8'}
                            />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.boardCardTitle}>{post.title}</Text>
                        <Text style={styles.boardCardContent}>{post.content}</Text>
                        {post.locationArea && (
                          <View style={styles.boardLocationRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748B" />
                            <Text style={styles.boardLocationText}>{post.locationArea}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB: MAP VIEW (DESKTOP INTERACTIVE / SPLIT VIEW) */}
          {activeTab === 'map' && (
            <View style={styles.mapTabWrapper}>
              <View style={styles.mapTabHeader}>
                <View>
                  <Text style={styles.boardSectionTitle}>Mapa wystawek i punktów odbioru</Text>
                  <Text style={styles.boardSectionSub}>
                    Przeglądaj przedmioty zaznaczone bezpośrednio w wybranej lokalizacji: {cityLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeCityMapBtn}
                  onPress={onOpenCityPicker}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#059669" />
                  <Text style={styles.changeCityMapBtnText}>Zmień miasto</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mapSplitLayout}>
                {/* Left/Main Map iframe */}
                <View style={styles.mapIframeContainer}>
                  {Platform.OS === 'web' ? (
                    <iframe
                      title="Mapa Wystawka"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=22.45%2C51.20%2C22.65%2C51.30&layer=mapnik&marker=${
                        selectedCity?.latitude || 51.2465
                      }%2C${selectedCity?.longitude || 22.5684}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        borderRadius: 16,
                      } as any}
                    />
                  ) : null}
                </View>

                {/* Right side list of markers */}
                <View style={styles.mapItemsSidebar}>
                  <Text style={styles.mapSidebarTitle}>Pinezki w okolicy ({displayedItems.length})</Text>
                  <ScrollView style={styles.mapSidebarScroll}>
                    {displayedItems.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.mapSidebarCard}
                        onPress={() => onOpenDetail(item)}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: item.photos?.[0] || 'https://via.placeholder.com/100' }}
                          style={styles.mapSidebarThumb}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={styles.typeBadgeRow}>
                            <View
                              style={[
                                styles.typeBadge,
                                item.type === 'wystawka' ? styles.typeWystawka : styles.typeOddam,
                              ]}
                            >
                              <Text style={styles.typeBadgeText}>
                                {item.type === 'wystawka' ? 'WYSTAWKA' : 'ODDAM'}
                              </Text>
                            </View>
                            <Text style={styles.freePriceTag}>ZA DARMO</Text>
                          </View>
                          <Text style={styles.mapSidebarItemTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.mapSidebarItemAddress} numberOfLines={1}>
                            {item.location.address || 'Ulica'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          )}

          {/* TAB: ITEMS (ALL, WYSTAWKA, ODDAM, SAVED) - OLX GRID */}
          {activeTab !== 'board' && activeTab !== 'map' && (
            <View style={styles.itemsSection}>
              <View style={styles.itemsSectionHeader}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>
                    {activeTab === 'saved'
                      ? 'Twoje zapisane ogłoszenia'
                      : activeTab === 'wystawka'
                      ? 'Wystawki uliczne do uratowania'
                      : activeTab === 'oddam'
                      ? 'Rzeczy do oddania od sąsiadów'
                      : 'Wszystkie darmowe rzeczy w Twojej okolicy'}
                  </Text>
                  <Text style={styles.sectionHeaderSub}>
                    Znaleziono {displayedItems.length} ogłoszeń w lokalizacji: {cityLabel}
                  </Text>
                </View>
              </View>

              {displayedItems.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <MaterialCommunityIcons name="cube-outline" size={54} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>Brak ogłoszeń w tej kategorii</Text>
                  <Text style={styles.emptyStateDesc}>
                    Nie znaleźliśmy nic dla podanych kryteriów. Spróbuj wyczyścić filtry lub dodać nową wystawkę!
                  </Text>
                  <TouchableOpacity
                    style={[styles.addCtaButton, { marginTop: 18 }]}
                    onPress={onOpenAddModal}
                  >
                    <Text style={styles.addCtaButtonText}>+ Dodaj pierwsze ogłoszenie</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* OLX 4-COLUMN RESPONSIVE GRID */
                <View style={styles.itemsGrid}>
                  {displayedItems.map((item) => {
                    const isSaved = savedItemIds.includes(item.id);
                    const distance = userCoords
                      ? calculateDistance(
                          userCoords.latitude,
                          userCoords.longitude,
                          item.location.latitude,
                          item.location.longitude
                        ).formatted
                      : null;

                    return (
                      <View key={item.id} style={styles.olxCard}>
                        {/* Photo Container */}
                        <TouchableOpacity
                          style={styles.cardImageContainer}
                          onPress={() => onOpenDetail(item)}
                          activeOpacity={0.9}
                        >
                          <Image
                            source={{ uri: item.photos?.[0] || 'https://via.placeholder.com/300' }}
                            style={styles.cardImage}
                            resizeMode="cover"
                          />

                          {/* Type Badge on Top-Left */}
                          <View
                            style={[
                              styles.cardBadge,
                              item.type === 'wystawka' ? styles.cardBadgeWystawka : styles.cardBadgeOddam,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={item.type === 'wystawka' ? 'dump-truck' : 'gift'}
                              size={12}
                              color="#FFFFFF"
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.cardBadgeText}>
                              {item.type === 'wystawka' ? 'WYSTAWKA' : 'ODDAM'}
                            </Text>
                          </View>

                          {/* Favorite Heart on Top-Right */}
                          <TouchableOpacity
                            style={styles.cardFavoriteBtn}
                            onPress={() => onToggleSaveItem(item)}
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons
                              name={isSaved ? 'heart' : 'heart-outline'}
                              size={20}
                              color={isSaved ? '#EF4444' : '#002F34'}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Card Info Details */}
                        <TouchableOpacity
                          style={styles.cardDetails}
                          onPress={() => onOpenDetail(item)}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.cardTitle} numberOfLines={2}>
                            {item.title}
                          </Text>

                          {/* Price Tag (OLX Style) */}
                          <View style={styles.cardPriceRow}>
                            <Text style={styles.cardPriceText}>ZA DARMO</Text>
                            {distance && (
                              <Text style={styles.cardDistanceText}>📍 {distance}</Text>
                            )}
                          </View>

                          {/* Location & Time */}
                          <View style={styles.cardLocationRow}>
                            <Text style={styles.cardLocationText} numberOfLines={1}>
                              {item.location.address || cityLabel}
                            </Text>
                            <Text style={styles.cardTimeText}>
                              {formatRelativeTime(item.createdAt)}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Quick Community Action Footer (Nadal stoi? / Zabrane) */}
                        <View style={styles.cardActionFooter}>
                          <TouchableOpacity
                            style={styles.cardQuickActionBtn}
                            onPress={() => onStillThere(item.id)}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="thumb-up-outline" size={14} color="#059669" />
                            <Text style={styles.cardQuickActionText}>
                              Stoi ({item.stillThereVotes || 0})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.cardQuickActionBtn, { borderColor: '#FCA5A5' }]}
                            onPress={() => onTakeItem(item)}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="check-circle-outline" size={14} color="#EF4444" />
                            <Text style={[styles.cardQuickActionText, { color: '#EF4444' }]}>
                              Zabierz ({item.takenVotes || 0})
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </main>

      {/* 5. OLX-STYLE DESKTOP FOOTER */}
      <footer style={{ width: '100%' } as any}>
        <View style={styles.footerContainer}>
          <View style={styles.footerInner}>
            <View style={styles.footerCol}>
              <View style={{ marginBottom: 12 }}>
                <Image
                  source={require('../assets/web_logo.webp')}
                  style={{ width: 155, height: 50 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.footerDesc}>
                Społecznościowa platforma sąsiedzka łącząca ludzi, którzy chcą uratować rzeczy z ulicy lub oddać
                niepotrzebne przedmioty sąsiadom za darmo.
              </Text>
              <Text style={styles.footerCopyright}>
                © {new Date().getFullYear()} Wystawka Zero-Waste • Wszelkie prawa zastrzeżone
              </Text>
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Kategorie</Text>
              {CATEGORIES.slice(0, 4).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.footerLinkItem}
                  onPress={() => onSelectCategory(c.id)}
                >
                  <Text style={styles.footerLinkText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Społeczność & Pomoc</Text>
              <TouchableOpacity
                style={styles.footerLinkItem}
                onPress={() => handleTabChange('board')}
              >
                <Text style={styles.footerLinkText}>Tablica sąsiedzka</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerLinkItem}
                onPress={() => handleTabChange('map')}
              >
                <Text style={styles.footerLinkText}>Mapa znalezisk</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerLinkItem}
                onPress={() => void safeOpenUrl('https://wystawka.fun/privacy')}
              >
                <Text style={styles.footerLinkText}>Polityka Prywatności i RODO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerLinkItem}
                onPress={() => void safeOpenUrl('https://wystawka.fun/terms')}
              >
                <Text style={styles.footerLinkText}>Regulamin serwisu</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Pobierz aplikację</Text>
              <Text style={styles.footerAppDesc}>
                Korzystaj z Wystawki także w terenie na telefonie z Androidem i iOS z powiadomieniami o wystawkach na Twojej ulicy.
              </Text>
              <TouchableOpacity
                style={styles.footerGooglePlayBtn}
                onPress={() => void safeOpenUrl('https://expo.dev/accounts/hashshashin/projects/wystawka-zero-waste')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="google-play" size={20} color="#FFFFFF" />
                <Text style={styles.footerGooglePlayText}>Pobierz na Androida</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </footer>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F2F4F5',
  },
  pageContent: {
    alignItems: 'center',
    paddingBottom: 40,
  },

  // 1. TOP NAVBAR
  topNavbar: {
    width: '100%',
    backgroundColor: '#002F34',
    borderBottomWidth: 1,
    borderBottomColor: '#002428',
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  topNavbarInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webLogoImage: {
    width: 175,
    height: 55,
  },
  topNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  navLinkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  adminPill: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  addCtaButton: {
    backgroundColor: '#23E5DB', // OLX high-contrast cyan/mint
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#23E5DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addCtaButtonText: {
    color: '#002F34',
    fontSize: 14,
    fontWeight: '700',
  },

  // 2. HERO SEARCH SECTION
  heroSearchSection: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  heroSearchInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroHeading: {
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  searchBarBox: {
    width: '100%',
    maxWidth: 960,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#002F34',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
    outlineWidth: 0 as any,
  },
  searchDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  searchLocationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
  },
  searchLocationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: 160,
  },
  searchSubmitButton: {
    backgroundColor: '#002F34',
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 12,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  heroStatText: {
    color: '#64748B',
    fontSize: 13,
  },

  // 3. CATEGORIES SECTION
  categoriesContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 24,
  },
  categoriesInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#002F34',
    marginBottom: 16,
  },
  sectionHeaderSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryCircleCard: {
    alignItems: 'center',
    width: 104,
  },
  categoryCircleCardActive: {
    transform: [{ scale: 1.05 }],
  },
  categoryCircleIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  categoryCircleLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryCircleLabelActive: {
    fontWeight: '700',
    color: '#059669',
  },

  // 4. MAIN WRAPPER
  mainContentWrapper: {
    maxWidth: 1240,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  bannerWrapper: {
    width: '100%',
    maxWidth: 960,
    aspectRatio: 1024 / 341,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
  },

  // TABS
  tabsNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    marginBottom: 24,
  },
  tabsLeftGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  desktopTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginBottom: -2,
  },
  desktopTabItemActive: {
    borderBottomColor: '#059669',
  },
  desktopTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  desktopTabTextActive: {
    color: '#002F34',
    fontWeight: '700',
  },
  tabBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  clearFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearFilterText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },

  // ITEMS 4-COLUMN GRID (OLX Style)
  itemsSection: {
    width: '100%',
  },
  itemsSectionHeader: {
    marginBottom: 16,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  olxCard: {
    width: 'calc(25% - 15px)' as any,
    minWidth: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardImageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardBadgeWystawka: {
    backgroundColor: '#F59E0B',
  },
  cardBadgeOddam: {
    backgroundColor: '#10B981',
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardFavoriteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  cardDetails: {
    padding: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#002F34',
    lineHeight: 20,
    height: 40,
    marginBottom: 8,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardPriceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  cardDistanceText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  cardLocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  cardLocationText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  cardTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardActionFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    padding: 8,
    gap: 8,
  },
  cardQuickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
    gap: 4,
  },
  cardQuickActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  // EMPTY STATE
  emptyStateBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#002F34',
    marginTop: 12,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 480,
  },

  // BOARD POSTS
  boardContainer: {
    width: '100%',
  },
  boardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  boardSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#002F34',
  },
  boardSectionSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  addBoardPostBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBoardPostBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  boardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  boardCard: {
    width: 'calc(33.333% - 11px)' as any,
    minWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  boardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  boardAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  boardAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  boardPostTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  boardCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#002F34',
    marginBottom: 8,
  },
  boardCardContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 12,
  },
  boardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  boardLocationText: {
    fontSize: 12,
    color: '#64748B',
  },

  // MAP TAB
  mapTabWrapper: {
    width: '100%',
  },
  mapTabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  changeCityMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  changeCityMapBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  mapSplitLayout: {
    flexDirection: 'row',
    height: 600,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapIframeContainer: {
    flex: 2,
    backgroundColor: '#E2E8F0',
  },
  mapItemsSidebar: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  mapSidebarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#002F34',
    marginBottom: 12,
  },
  mapSidebarScroll: {
    flex: 1,
  },
  mapSidebarCard: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapSidebarThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeWystawka: {
    backgroundColor: '#FEF3C7',
  },
  typeOddam: {
    backgroundColor: '#D1FAE5',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
  },
  freePriceTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  mapSidebarItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#002F34',
  },
  mapSidebarItemAddress: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // 5. FOOTER
  footerContainer: {
    width: '100%',
    backgroundColor: '#002F34',
    borderTopWidth: 1,
    borderTopColor: '#002428',
    paddingTop: 48,
    paddingBottom: 32,
    marginTop: 48,
  },
  footerInner: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 32,
  },
  footerCol: {
    width: 'calc(25% - 24px)' as any,
    minWidth: 220,
  },
  footerLogoBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  footerDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  footerCopyright: {
    fontSize: 12,
    color: '#64748B',
  },
  footerColTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  footerLinkItem: {
    marginBottom: 10,
  },
  footerLinkText: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  footerAppDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  footerGooglePlayBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  footerGooglePlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
