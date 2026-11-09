import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PostItem, BoardPost } from '../types';
import { THEME } from '../constants/categories';
import { ItemCard } from './ItemCard';
import { BoardCard } from './BoardCard';

interface SavedTabProps {
  savedItems: PostItem[];
  savedBoardPosts: BoardPost[];
  userCoords?: { latitude: number; longitude: number } | null;
  onOpenItemDetail: (item: PostItem) => void;
  onToggleSaveItem: (itemId: string) => void;
  onToggleSavePost: (postId: string) => void;
  onExplore: () => void;
}

export const SavedTab: React.FC<SavedTabProps> = ({
  savedItems,
  savedBoardPosts,
  userCoords,
  onOpenItemDetail,
  onToggleSaveItem,
  onToggleSavePost,
  onExplore,
}) => {
  const [subFilter, setSubFilter] = useState<'all' | 'items' | 'posts'>('all');

  const totalCount = savedItems.length + savedBoardPosts.length;

  return (
    <View style={styles.container}>
      {/* Podkategorie zapisanych */}
      <View style={styles.subFilterRow}>
        <TouchableOpacity
          style={[styles.filterPill, subFilter === 'all' && styles.filterPillActive]}
          onPress={() => setSubFilter('all')}
        >
          <Text style={[styles.filterPillText, subFilter === 'all' && styles.filterPillTextActive]}>
            Wszystko ({totalCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, subFilter === 'items' && styles.filterPillActive]}
          onPress={() => setSubFilter('items')}
        >
          <Text style={[styles.filterPillText, subFilter === 'items' && styles.filterPillTextActive]}>
            Znaleziska ({savedItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, subFilter === 'posts' && styles.filterPillActive]}
          onPress={() => setSubFilter('posts')}
        >
          <Text style={[styles.filterPillText, subFilter === 'posts' && styles.filterPillTextActive]}>
            Z tablicy ({savedBoardPosts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {totalCount === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.starCircle}>
            <MaterialCommunityIcons name="star-outline" size={44} color={THEME.starYellow} />
          </View>
          <Text style={styles.emptyTitle}>Brak zapisanych ogłoszeń</Text>
          <Text style={styles.emptySub}>
            Kliknij ikonę gwiazdki ⭐ na dowolnym znalezisku lub wpisie z tablicy, aby mieć do niego szybki dostęp w tym miejscu.
          </Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={onExplore}>
            <MaterialCommunityIcons name="compass-outline" size={18} color="#FFFFFF" />
            <Text style={styles.exploreBtnText}>Przeglądaj mapę i znaleziska</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[
            ...(subFilter !== 'posts' ? savedItems.map((i) => ({ type: 'item' as const, data: i })) : []),
            ...(subFilter !== 'items' ? savedBoardPosts.map((p) => ({ type: 'post' as const, data: p })) : []),
          ]}
          keyExtractor={(entry) => `${entry.type}-${entry.data.id}`}
          renderItem={({ item }) => {
            if (item.type === 'item') {
              return (
                <ItemCard
                  item={item.data}
                  userCoords={userCoords}
                  onPress={() => onOpenItemDetail(item.data)}
                  isSaved={true}
                  onToggleSave={() => onToggleSaveItem(item.data.id)}
                />
              );
            }
            return (
              <BoardCard
                post={item.data}
                isSaved={true}
                onToggleSave={() => onToggleSavePost(item.data.id)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  subFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingTop: 14,
    paddingBottom: 110,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
  },
  starCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 25,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
