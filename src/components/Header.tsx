import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Image, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, APP_FONT } from '../constants/categories';
import { ItemType } from '../types';

interface HeaderProps {
  filterType: 'all' | ItemType;
  onSelectFilter: (type: 'all' | ItemType) => void;
  viewMode: 'home' | 'map' | 'list' | 'board' | 'saved';
  wystawkaCount: number;
  oddamCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  usersCount?: number;
  onGoBackToHome?: () => void;
  isDark?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  filterType,
  onSelectFilter,
  viewMode,
  wystawkaCount,
  oddamCount,
  searchQuery,
  onSearchChange,
  usersCount = 128,
  onGoBackToHome,
  isDark = false,
}) => {
  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* 1. Reklama w zakładce Mapa (Własna grafika w zoptymalizowanym formacie WebP) */}
      {viewMode === 'map' && (
        <TouchableOpacity
          style={styles.adBannerCard}
          activeOpacity={0.9}
          onPress={() =>
            Alert.alert(
              'Odkrywaj rzeczy do oddania! 🚛🗺️',
              'Przeglądaj ogłoszenia o wystawkach i rzeczach za darmo bezpośrednio na mapie w Twojej okolicy!\n\nAplikacja dostępna na Android i iOS.',
              [{ text: 'Super!', style: 'default' }]
            )
          }
        >
          <Image
            source={require('../assets/map_ad_banner.webp')}
            style={styles.adBannerImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      {/* 2. Wiersz z przyciskiem wstecz po lewej stronie i search barem (identycznym jak na pulpicie) */}
      <View style={styles.searchRow}>
        {onGoBackToHome && (
          <TouchableOpacity
            onPress={onGoBackToHome}
            style={[styles.backBtn, isDark && styles.backBtnDark]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
        )}

        <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
          <MaterialCommunityIcons name="magnify" size={26} color={isDark ? '#94A3B8' : '#475569'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, isDark && styles.searchInputDark]}
            placeholder={
              viewMode === 'board'
                ? 'Szukaj na tablicy ogłoszeń...'
                : viewMode === 'saved'
                ? 'Szukaj w zapisanych...'
                : viewMode === 'map'
                ? 'Szukaj skarbów...'
                : 'Szukaj mebli, elektroniki, skarbów...'
            }
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={searchQuery}
            onChangeText={onSearchChange}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => onSearchChange('')} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={22} color="#94A3B8" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="microphone" size={24} color={isDark ? '#94A3B8' : '#475569'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs w stylu zaokrąglonych pigułek jak na wzorcu */}
      {viewMode !== 'board' && viewMode !== 'saved' && (
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {/* Przycisk Wszystko */}
            <TouchableOpacity
              style={[
                styles.filterPill,
                isDark && styles.filterPillDark,
                filterType === 'all' && (isDark ? styles.filterPillActiveDark : styles.filterPillActive),
              ]}
              onPress={() => onSelectFilter('all')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="view-grid-outline"
                size={15}
                color={filterType === 'all' ? '#0284C7' : (isDark ? '#94A3B8' : '#64748B')}
              />
              <Text
                style={[
                  styles.filterText,
                  isDark && styles.filterTextDark,
                  filterType === 'all' && (isDark ? styles.filterTextActiveDark : styles.filterTextActive),
                ]}
              >
                Wszystko ({wystawkaCount + oddamCount})
              </Text>
            </TouchableOpacity>

            {/* Przycisk Wystawki */}
            <TouchableOpacity
              style={[
                styles.filterPill,
                isDark && styles.filterPillDark,
                filterType === 'wystawka' && (isDark ? styles.filterPillWystawkaActiveDark : styles.filterPillWystawkaActive),
              ]}
              onPress={() => onSelectFilter('wystawka')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="dump-truck"
                size={16}
                color={filterType === 'wystawka' ? THEME.wystawka : (isDark ? '#94A3B8' : '#64748B')}
              />
              <Text
                style={[
                  styles.filterText,
                  isDark && styles.filterTextDark,
                  filterType === 'wystawka' && (isDark ? styles.filterTextWystawkaActiveDark : styles.filterTextWystawkaActive),
                ]}
              >
                Wystawki ({wystawkaCount})
              </Text>
            </TouchableOpacity>

            {/* Przycisk Oddam */}
            <TouchableOpacity
              style={[
                styles.filterPill,
                isDark && styles.filterPillDark,
                filterType === 'oddam' && (isDark ? styles.filterPillOddamActiveDark : styles.filterPillOddamActive),
              ]}
              onPress={() => onSelectFilter('oddam')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="gift"
                size={15}
                color={filterType === 'oddam' ? THEME.oddam : (isDark ? '#94A3B8' : '#64748B')}
              />
              <Text
                style={[
                  styles.filterText,
                  isDark && styles.filterTextDark,
                  filterType === 'oddam' && (isDark ? styles.filterTextOddamActiveDark : styles.filterTextOddamActive),
                ]}
              >
                Oddam ({oddamCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  // Styl reklamy w zakładce Mapa (Własna grafika w formacie WebP)
  adBannerCard: {
    width: '100%',
    aspectRatio: 1024 / 341,
    backgroundColor: '#FEFAF4', // Dokładny kolor tła z nowej grafiki
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EFE8DD',
    overflow: 'hidden', // Gwarantuje zachowanie zaokrąglonych brzegów
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBannerImage: {
    width: '100%',
    height: '100%',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
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
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
  filtersContainer: {
    marginTop: 2,
    marginBottom: 4,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999, // Pełna pigułka / capsule jak na zdjęciu
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#38BDF8', // Błękitny pierścień jak na wzorcu ("All")
    borderWidth: 1.5,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.16,
    shadowRadius: 5,
  },
  filterPillWystawkaActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.16,
    shadowRadius: 5,
  },
  filterPillOddamActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
    borderWidth: 1.5,
    shadowColor: '#10B981',
    shadowOpacity: 0.16,
    shadowRadius: 5,
  },
  filterText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  filterTextWystawkaActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  filterTextOddamActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  // Dark mode styles
  containerDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: '#1E293B',
  },
  searchContainerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  backBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  filterPillDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  filterPillActiveDark: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
    borderWidth: 1.5,
    shadowOpacity: 0.25,
  },
  filterPillWystawkaActiveDark: {
    backgroundColor: '#1E293B',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    shadowOpacity: 0.25,
  },
  filterPillOddamActiveDark: {
    backgroundColor: '#1E293B',
    borderColor: '#10B981',
    borderWidth: 1.5,
    shadowOpacity: 0.25,
  },
  filterTextDark: {
    color: '#94A3B8',
  },
  filterTextActiveDark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterTextWystawkaActiveDark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterTextOddamActiveDark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
