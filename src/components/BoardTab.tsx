import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BoardPost, BoardTag } from '../types';
import { BOARD_TAGS } from '../constants/boardTags';
import { THEME } from '../constants/categories';
import { BoardCard } from './BoardCard';

interface BoardTabProps {
  posts: BoardPost[];
  searchQuery: string;
  onLikeToggle?: (postId: string) => void;
  onOpenAddPost: () => void;
  savedPostIds?: string[];
  onToggleSavePost?: (postId: string) => void;
}

export const BoardTab: React.FC<BoardTabProps> = ({
  posts,
  searchQuery,
  onLikeToggle,
  onOpenAddPost,
  savedPostIds = [],
  onToggleSavePost,
}) => {
  const [selectedTag, setSelectedTag] = useState<'all' | BoardTag>('all');

  // Filtrowanie postów po tagu i wyszukiwarce
  const filteredPosts = posts.filter((post) => {
    // 1. Tag
    if (selectedTag !== 'all' && post.tag !== selectedTag) return false;

    // 2. Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = post.title.toLowerCase().includes(q);
      const matchContent = post.content.toLowerCase().includes(q);
      const matchAuthor = post.authorName.toLowerCase().includes(q);
      const matchLocation = post.locationArea?.toLowerCase().includes(q);
      return matchTitle || matchContent || matchAuthor || matchLocation;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      {/* Pasek kategorii / tagów tablicy */}
      <View style={styles.tagsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
          <TouchableOpacity
            style={[
              styles.tagPill,
              selectedTag === 'all' && styles.tagPillActive,
            ]}
            onPress={() => setSelectedTag('all')}
          >
            <Text
              style={[
                styles.tagPillText,
                selectedTag === 'all' && styles.tagPillTextActive,
              ]}
            >
              Wszystkie ({posts.length})
            </Text>
          </TouchableOpacity>

          {BOARD_TAGS.map((tag) => {
            const isSelected = selectedTag === tag.id;
            const count = posts.filter((p) => p.tag === tag.id).length;
            return (
              <TouchableOpacity
                key={tag.id}
                style={[
                  styles.tagPill,
                  isSelected && { backgroundColor: tag.bgColor, borderColor: tag.color },
                ]}
                onPress={() => setSelectedTag(tag.id)}
              >
                <MaterialCommunityIcons
                  name={tag.icon as any}
                  size={14}
                  color={isSelected ? tag.color : '#64748B'}
                />
                <Text
                  style={[
                    styles.tagPillText,
                    isSelected && { color: tag.color, fontWeight: '700' },
                  ]}
                >
                  {tag.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Lista postów */}
      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.adBannerCard}
            activeOpacity={0.9}
            onPress={() =>
              Alert.alert(
                'Wypożyczalnia Smaku 🍽️',
                'Catering na Twoją okazję – Wesela, Komunie, Przyjęcia.\n\n📍 Lublin, ul. Jantarowa 5/u5\n📞 Tel: 733 473 721\n🌐 wypozyczalnia-smaku.pl',
                [
                  {
                    text: 'Zadzwoń',
                    onPress: () => Linking.openURL('tel:733473721').catch(() => {}),
                  },
                  {
                    text: 'Strona WWW',
                    onPress: () => Linking.openURL('https://wypozyczalnia-smaku.pl').catch(() => {}),
                  },
                  { text: 'Zamknij', style: 'cancel' },
                ]
              )
            }
          >
            <Image
              source={require('../assets/board_ad_banner.webp')}
              style={styles.adBannerImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <BoardCard
            post={item}
            onLikeToggle={onLikeToggle}
            isSaved={savedPostIds.includes(item.id)}
            onToggleSave={onToggleSavePost}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={50} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Brak wpisów na tablicy</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `Nie znaleziono ogłoszeń dla „${searchQuery}”.`
                : 'Bądź pierwszą osobą, która zamieści ogłoszenie sąsiedzkie!'}
            </Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={onOpenAddPost}>
              <MaterialCommunityIcons name="pencil-plus-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyAddBtnText}>Napisz pierwsze ogłoszenie</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tagsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tagsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tagPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingTop: 14,
    paddingBottom: 110, // Przestrzeń pod zintegrowany dolny pasek nawigacyjny
  },
  adBannerCard: {
    height: 86,
    backgroundColor: '#231815',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#3D2B24',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBannerImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.primary,
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
