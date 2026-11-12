import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BoardPost,
  BoardTag,
  ItemCategory,
  ItemType,
  PostItem,
} from '../types';
import { CATEGORIES, APP_FONT } from '../constants/categories';
import { formatRelativeTime } from '../utils/helpers';

type ModerationSubTab = 'items' | 'board' | 'blocked';
type ItemStatusFilter = 'all' | 'active' | 'flagged' | 'expired' | 'archived';
type ItemSortMode = 'flagged_first' | 'newest' | 'oldest';

const BOARD_TAGS: { id: BoardTag; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'oddam', label: 'Oddam' },
  { id: 'szukam', label: 'Szukam' },
  { id: 'pomoc', label: 'Pomoc' },
  { id: 'inne', label: 'Inne' },
];

export interface AdminModerationTabProps {
  items: PostItem[];
  boardPosts: BoardPost[];
  blockedAuthors: string[];
  isItemActiveCheck: (item: PostItem) => boolean;
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
}

export const AdminModerationTab: React.FC<AdminModerationTabProps> = ({
  items,
  boardPosts,
  blockedAuthors,
  isItemActiveCheck,
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
}) => {
  const [subTab, setSubTab] = useState<ModerationSubTab>('items');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemCategory>('all');
  const [sortMode, setSortMode] = useState<ItemSortMode>('flagged_first');
  const [boardTagFilter, setBoardTagFilter] = useState<'all' | BoardTag>('all');

  // Zaznaczanie zbiorcze (Bulk Moderation)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Ręczne blokowanie autora
  const [blockAuthorDraft, setBlockAuthorDraft] = useState('');

  // Modal edycji ogłoszenia
  const [editingItem, setEditingItem] = useState<PostItem | null>(null);
  const [itemTitleDraft, setItemTitleDraft] = useState('');
  const [itemDescDraft, setItemDescDraft] = useState('');
  const [itemTypeDraft, setItemTypeDraft] = useState<ItemType>('wystawka');
  const [itemCatDraft, setItemCatDraft] = useState<ItemCategory>('meble');
  const [itemAddressDraft, setItemAddressDraft] = useState('');
  const [itemAuthorDraft, setItemAuthorDraft] = useState('');
  const [itemContactDraft, setItemContactDraft] = useState('');

  // Modal edycji wpisu na tablicy
  const [editingBoardPost, setEditingBoardPost] = useState<BoardPost | null>(null);
  const [boardTitleDraft, setBoardTitleDraft] = useState('');
  const [boardContentDraft, setBoardContentDraft] = useState('');
  const [boardTagDraft, setBoardTagDraft] = useState<BoardTag>('info');
  const [boardAuthorDraft, setBoardAuthorDraft] = useState('');
  const [boardAreaDraft, setBoardAreaDraft] = useState('');

  const blockedSet = useMemo(
    () => new Set(blockedAuthors.map((a) => a.toLowerCase())),
    [blockedAuthors]
  );

  const isAuthorBlocked = (name?: string): boolean =>
    Boolean(name && blockedSet.has(name.trim().toLowerCase()));

  const counts = useMemo(() => {
    let active = 0;
    let flagged = 0;
    let expired = 0;
    let archived = 0;
    for (const item of items) {
      const isAct = isItemActiveCheck(item);
      if (isAct) {
        active += 1;
        if (item.takenVotes > 0) flagged += 1;
      } else if (item.status === 'taken') {
        archived += 1;
      } else {
        expired += 1;
      }
    }
    return { active, flagged, expired, archived };
  }, [items, isItemActiveCheck]);

  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      map[cat.id] = cat.label;
    }
    return map;
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((item) => {
      const isAct = isItemActiveCheck(item);
      if (statusFilter === 'active' && !isAct) return false;
      if (statusFilter === 'flagged' && !(isAct && item.takenVotes > 0)) return false;
      if (statusFilter === 'expired' && !(!isAct && item.status !== 'taken')) return false;
      if (statusFilter === 'archived' && !(!isAct && item.status === 'taken')) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      if (q.length > 0) {
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.location.address?.toLowerCase().includes(q) ?? false) ||
          (item.authorName?.toLowerCase().includes(q) ?? false) ||
          item.id.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'flagged_first') {
        if (b.takenVotes !== a.takenVotes) return b.takenVotes - a.takenVotes;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortMode === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [items, statusFilter, typeFilter, categoryFilter, search, sortMode, isItemActiveCheck]);

  const filteredBoardPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boardPosts.filter((post) => {
      if (boardTagFilter !== 'all' && post.tag !== boardTagFilter) return false;
      if (q.length > 0) {
        return (
          post.title.toLowerCase().includes(q) ||
          post.content.toLowerCase().includes(q) ||
          post.authorName.toLowerCase().includes(q) ||
          (post.locationArea?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [boardPosts, boardTagFilter, search]);

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkAction = (action: 'restore' | 'archive' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (action === 'delete') {
      Alert.alert(
        'Usunąć zaznaczone ogłoszenia?',
        `Trwale usuniesz ${selectedIds.length} zaznaczonych ogłoszeń.`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Usuń',
            style: 'destructive',
            onPress: () => {
              onBulkItemAction(selectedIds, 'delete');
              setSelectedIds([]);
            },
          },
        ]
      );
      return;
    }
    onBulkItemAction(selectedIds, action);
    setSelectedIds([]);
  };

  const handleConfirmDeleteItem = (item: PostItem) => {
    Alert.alert(
      'Usunąć ogłoszenie?',
      `Czy na pewno chcesz trwale usunąć „${item.title}”?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Usuń', style: 'destructive', onPress: () => onDeleteItem(item.id) },
      ]
    );
  };

  const handleConfirmDeleteBoardPost = (post: BoardPost) => {
    Alert.alert(
      'Usunąć wpis z Tablicy?',
      `Czy na pewno chcesz usunąć wpis „${post.title}”?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Usuń wpis', style: 'destructive', onPress: () => onDeleteBoardPost(post.id) },
      ]
    );
  };

  const openEditItemModal = (item: PostItem) => {
    setEditingItem(item);
    setItemTitleDraft(item.title);
    setItemDescDraft(item.description);
    setItemTypeDraft(item.type);
    setItemCatDraft(item.category);
    setItemAddressDraft(item.location.address || '');
    setItemAuthorDraft(item.authorName || '');
    setItemContactDraft(item.contactInfo || '');
  };

  const handleSaveItemEdit = () => {
    if (!editingItem) return;
    const cleanedTitle = itemTitleDraft.trim();
    if (!cleanedTitle) {
      Alert.alert('Brak tytułu', 'Tytuł ogłoszenia nie może być pusty.');
      return;
    }
    onUpdateItem({
      ...editingItem,
      title: cleanedTitle,
      description: itemDescDraft.trim(),
      type: itemTypeDraft,
      category: itemCatDraft,
      location: {
        ...editingItem.location,
        address: itemAddressDraft.trim() || undefined,
      },
      authorName: itemAuthorDraft.trim() || undefined,
      contactInfo: itemContactDraft.trim() || undefined,
    });
    setEditingItem(null);
    Alert.alert('Zapisano zmiany ✅', 'Treść ogłoszenia została zaktualizowana.');
  };

  const openEditBoardModal = (post: BoardPost) => {
    setEditingBoardPost(post);
    setBoardTitleDraft(post.title);
    setBoardContentDraft(post.content);
    setBoardTagDraft(post.tag);
    setBoardAuthorDraft(post.authorName);
    setBoardAreaDraft(post.locationArea || '');
  };

  const handleSaveBoardEdit = () => {
    if (!editingBoardPost) return;
    if (!boardTitleDraft.trim() || !boardContentDraft.trim()) {
      Alert.alert('Uzupełnij pola', 'Tytuł oraz treść wpisu nie mogą być puste.');
      return;
    }
    onUpdateBoardPost({
      ...editingBoardPost,
      title: boardTitleDraft.trim(),
      content: boardContentDraft.trim(),
      tag: boardTagDraft,
      authorName: boardAuthorDraft.trim() || 'Sąsiad',
      locationArea: boardAreaDraft.trim() || undefined,
    });
    setEditingBoardPost(null);
    Alert.alert('Zapisano wpis ✅', 'Ogłoszenie na Tablicy zostało zaktualizowane.');
  };

  const handleBlockManualAuthor = () => {
    const cleaned = blockAuthorDraft.trim();
    if (!cleaned) return;
    if (!isAuthorBlocked(cleaned)) {
      onToggleBlockAuthor(cleaned);
    }
    setBlockAuthorDraft('');
  };

  const cycleSortMode = () => {
    setSortMode((prev) =>
      prev === 'flagged_first' ? 'newest' : prev === 'newest' ? 'oldest' : 'flagged_first'
    );
  };

  const sortLabel =
    sortMode === 'flagged_first'
      ? 'Sort: Zgłoszone'
      : sortMode === 'newest'
      ? 'Sort: Najnowsze'
      : 'Sort: Najstarsze';

  return (
    <View>
      {/* Przełącznik podzakładek moderacji */}
      <View style={styles.subTabsRow}>
        {(
          [
            { id: 'items', label: `Ogłoszenia (${items.length})`, icon: 'package-variant-closed' },
            { id: 'board', label: `Tablica (${boardPosts.length})`, icon: 'bulletin-board' },
            { id: 'blocked', label: `Blokady (${blockedAuthors.length})`, icon: 'account-cancel-outline' },
          ] as { id: ModerationSubTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[]
        ).map((tab) => {
          const active = subTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.subTabBtn, active && styles.subTabBtnActive]}
              onPress={() => setSubTab(tab.id)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={15}
                color={active ? '#047857' : '#64748B'}
              />
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {subTab !== 'blocked' && (
        <View style={styles.searchInputBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder={
              subTab === 'items'
                ? 'Szukaj po tytule, opisie, ulicy, autorze lub ID...'
                : 'Szukaj na Tablicy (tytuł, treść, autor, rejon)...'
            }
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {subTab === 'items' && (
        <View>
          {/* Pasek narzędzi moderacji + Tryb zaznaczania */}
          <View style={styles.toolbarRow}>
            <TouchableOpacity
              style={[styles.toolChip, selectionMode && styles.toolChipActive]}
              onPress={() => {
                setSelectionMode((prev) => !prev);
                setSelectedIds([]);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={selectionMode ? 'checkbox-multiple-marked' : 'checkbox-multiple-blank-outline'}
                size={15}
                color={selectionMode ? '#FFFFFF' : '#334155'}
              />
              <Text style={[styles.toolChipText, selectionMode && styles.toolChipTextActive]}>
                {selectionMode ? 'Zakończ zaznaczanie' : 'Zaznacz wiele'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolChip} onPress={cycleSortMode} activeOpacity={0.8}>
              <MaterialCommunityIcons name="sort" size={15} color="#334155" />
              <Text style={styles.toolChipText}>{sortLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* Pasek akcji zbiorczych */}
          {selectionMode && (
            <View style={styles.bulkBar}>
              <View style={styles.bulkTopRow}>
                <Text style={styles.bulkCountText}>Zaznaczono: {selectedIds.length}</Text>
                <View style={styles.bulkSelectBtns}>
                  <TouchableOpacity
                    onPress={() => setSelectedIds(filteredItems.map((it) => it.id))}
                    style={styles.bulkMiniLink}
                  >
                    <Text style={styles.bulkMiniLinkText}>
                      Zaznacz widoczne ({filteredItems.length})
                    </Text>
                  </TouchableOpacity>
                  {selectedIds.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSelectedIds([])}
                      style={styles.bulkMiniLink}
                    >
                      <Text style={[styles.bulkMiniLinkText, { color: '#64748B' }]}>Wyczyść</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.bulkActionsRow}>
                <TouchableOpacity
                  style={[styles.bulkActionBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                  onPress={() => handleBulkAction('restore')}
                  disabled={selectedIds.length === 0}
                >
                  <Text style={[styles.bulkActionText, { color: '#047857' }]}>Zatwierdź (+6h)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkActionBtn, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                  onPress={() => handleBulkAction('archive')}
                  disabled={selectedIds.length === 0}
                >
                  <Text style={[styles.bulkActionText, { color: '#B45309' }]}>Archiwizuj</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkActionBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                  onPress={() => handleBulkAction('delete')}
                  disabled={selectedIds.length === 0}
                >
                  <Text style={[styles.bulkActionText, { color: '#DC2626' }]}>Usuń</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Filtry statusu */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {(
              [
                { id: 'all', label: `Wszystkie (${items.length})` },
                { id: 'active', label: `Aktywne (${counts.active})` },
                { id: 'flagged', label: `Zgłoszone (${counts.flagged})` },
                { id: 'expired', label: `Wygasłe (${counts.expired})` },
                { id: 'archived', label: `Zabrane (${counts.archived})` },
              ] as { id: ItemStatusFilter; label: string }[]
            ).map((f) => {
              const selected = statusFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterPill, selected && styles.filterPillActive]}
                  onPress={() => setStatusFilter(f.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPillText, selected && styles.filterPillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Filtry typu i kategorii */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {(
              [
                { id: 'all', label: 'Wszystkie typy' },
                { id: 'wystawka', label: 'Wystawka' },
                { id: 'oddam', label: 'Oddam' },
              ] as { id: 'all' | ItemType; label: string }[]
            ).map((t) => {
              const selected = typeFilter === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.smallFilterPill, selected && styles.smallFilterPillActive]}
                  onPress={() => setTypeFilter(t.id)}
                >
                  <Text style={[styles.smallFilterText, selected && styles.smallFilterTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.smallFilterPill,
                categoryFilter === 'all' && styles.smallFilterPillActive,
              ]}
              onPress={() => setCategoryFilter('all')}
            >
              <Text
                style={[
                  styles.smallFilterText,
                  categoryFilter === 'all' && styles.smallFilterTextActive,
                ]}
              >
                Wszystkie kat.
              </Text>
            </TouchableOpacity>

            {CATEGORIES.map((cat) => {
              const selected = categoryFilter === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.smallFilterPill, selected && styles.smallFilterPillActive]}
                  onPress={() => setCategoryFilter(cat.id)}
                >
                  <Text style={[styles.smallFilterText, selected && styles.smallFilterTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredItems.map((item) => {
            const active = isItemActiveCheck(item);
            const authorBlocked = isAuthorBlocked(item.authorName);
            const isSelected = selectedIds.includes(item.id);
            return (
              <View
                key={item.id}
                style={[styles.modCard, isSelected && styles.modCardSelected]}
              >
                <View style={styles.modCardTop}>
                  <View style={styles.modBadgeGroup}>
                    {selectionMode && (
                      <TouchableOpacity
                        onPress={() => toggleSelectItem(item.id)}
                        style={styles.checkboxBtn}
                      >
                        <MaterialCommunityIcons
                          name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                          size={20}
                          color={isSelected ? '#059669' : '#94A3B8'}
                        />
                      </TouchableOpacity>
                    )}

                    <View
                      style={[
                        styles.typeTag,
                        { backgroundColor: item.type === 'wystawka' ? '#FEF3C7' : '#D1FAE5' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeTagText,
                          { color: item.type === 'wystawka' ? '#B45309' : '#047857' },
                        ]}
                      >
                        {item.type === 'wystawka' ? 'WYSTAWKA' : 'ODDAM'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusTag,
                        { backgroundColor: active ? '#ECFDF5' : '#F1F5F9' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTagText,
                          { color: active ? '#059669' : '#64748B' },
                        ]}
                      >
                        {active ? 'Aktywne' : item.status === 'taken' ? 'Zabrane' : 'Wygasłe'}
                      </Text>
                    </View>

                    {item.takenVotes > 0 && active && (
                      <View style={styles.flaggedTag}>
                        <Text style={styles.flaggedTagText}>⚠️ {item.takenVotes}/2</Text>
                      </View>
                    )}

                    {authorBlocked && (
                      <View style={styles.blockedTag}>
                        <Text style={styles.blockedTagText}>Zablokowany autor</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.modTimeText}>{formatRelativeTime(item.createdAt)}</Text>
                </View>

                <Text style={styles.modTitle}>{item.title}</Text>
                {Boolean(item.description) && (
                  <Text style={styles.modDescSnippet} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                <Text style={styles.modSub} numberOfLines={1}>
                  {categoryLabelMap[item.category] || item.category} •{' '}
                  {item.location.address || 'Brak adresu'} • {item.authorName || 'Sąsiad'}
                </Text>
                <Text style={styles.modVotesMeta}>
                  👍 Stoi: {item.stillThereVotes} • ⚠️ Zabrane: {item.takenVotes} • 📷{' '}
                  {item.photos.length} • ID: {item.id}
                </Text>

                <View style={styles.modActionsRow}>
                  <TouchableOpacity
                    style={styles.modActionBtn}
                    onPress={() => onOpenItemDetail(item)}
                  >
                    <MaterialCommunityIcons name="eye-outline" size={14} color="#334155" />
                    <Text style={styles.modActionBtnText}>Podgląd</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modActionBtn, styles.modActionEdit]}
                    onPress={() => openEditItemModal(item)}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={14} color="#0284C7" />
                    <Text style={[styles.modActionBtnText, { color: '#0284C7' }]}>Edytuj</Text>
                  </TouchableOpacity>

                  {item.takenVotes > 0 && (
                    <TouchableOpacity
                      style={[styles.modActionBtn, styles.modActionRestore]}
                      onPress={() => onResetItemFlags(item.id)}
                    >
                      <MaterialCommunityIcons name="flag-off-outline" size={14} color="#047857" />
                      <Text style={[styles.modActionBtnText, { color: '#047857' }]}>Reset ⚠️</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.modActionBtn, styles.modActionRestore]}
                    onPress={() => onRestoreItem(item.id)}
                  >
                    <MaterialCommunityIcons name="refresh" size={14} color="#047857" />
                    <Text style={[styles.modActionBtnText, { color: '#047857' }]}>
                      {active ? '+6h' : 'Przywróć'}
                    </Text>
                  </TouchableOpacity>

                  {active && (
                    <TouchableOpacity
                      style={[styles.modActionBtn, styles.modActionArchive]}
                      onPress={() => onArchiveItem(item.id)}
                    >
                      <MaterialCommunityIcons name="archive-outline" size={14} color="#B45309" />
                      <Text style={[styles.modActionBtnText, { color: '#B45309' }]}>
                        Archiwizuj
                      </Text>
                    </TouchableOpacity>
                  )}

                  {Boolean(item.authorName?.trim()) && (
                    <TouchableOpacity
                      style={[
                        styles.modActionBtn,
                        authorBlocked ? styles.modActionRestore : styles.modActionArchive,
                      ]}
                      onPress={() => onToggleBlockAuthor(item.authorName!)}
                    >
                      <MaterialCommunityIcons
                        name={authorBlocked ? 'account-check-outline' : 'account-cancel-outline'}
                        size={14}
                        color={authorBlocked ? '#047857' : '#B45309'}
                      />
                      <Text
                        style={[
                          styles.modActionBtnText,
                          { color: authorBlocked ? '#047857' : '#B45309' },
                        ]}
                      >
                        {authorBlocked ? 'Odblokuj' : 'Blokuj autora'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.modActionBtn, styles.modActionDelete]}
                    onPress={() => handleConfirmDeleteItem(item)}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={14} color="#DC2626" />
                    <Text style={[styles.modActionBtnText, { color: '#DC2626' }]}>Usuń</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {filteredItems.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxText}>
                Brak ogłoszeń spełniających wybrane kryteria moderacji.
              </Text>
            </View>
          )}
        </View>
      )}

      {subTab === 'board' && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            <TouchableOpacity
              style={[styles.filterPill, boardTagFilter === 'all' && styles.filterPillActive]}
              onPress={() => setBoardTagFilter('all')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  boardTagFilter === 'all' && styles.filterPillTextActive,
                ]}
              >
                Wszystkie ({boardPosts.length})
              </Text>
            </TouchableOpacity>
            {BOARD_TAGS.map((t) => {
              const selected = boardTagFilter === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.filterPill, selected && styles.filterPillActive]}
                  onPress={() => setBoardTagFilter(t.id)}
                >
                  <Text style={[styles.filterPillText, selected && styles.filterPillTextActive]}>
                    #{t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredBoardPosts.map((post) => {
            const authorBlocked = isAuthorBlocked(post.authorName);
            return (
              <View key={post.id} style={styles.modCard}>
                <View style={styles.modCardTop}>
                  <View style={styles.modBadgeGroup}>
                    <Text style={styles.boardTagBadge}>#{post.tag.toUpperCase()}</Text>
                    {authorBlocked && (
                      <View style={styles.blockedTag}>
                        <Text style={styles.blockedTagText}>Zablokowany autor</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.modTimeText}>{formatRelativeTime(post.createdAt)}</Text>
                </View>
                <Text style={styles.modTitle}>{post.title}</Text>
                <Text style={styles.modDescSnippet} numberOfLines={3}>
                  {post.content}
                </Text>
                <Text style={styles.modVotesMeta}>
                  {post.authorName}
                  {post.locationArea ? ` • ${post.locationArea}` : ''} • ❤️ {post.likesCount}
                </Text>
                <View style={styles.modActionsRow}>
                  <TouchableOpacity
                    style={[styles.modActionBtn, styles.modActionEdit]}
                    onPress={() => openEditBoardModal(post)}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={14} color="#0284C7" />
                    <Text style={[styles.modActionBtnText, { color: '#0284C7' }]}>Edytuj</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modActionBtn,
                      authorBlocked ? styles.modActionRestore : styles.modActionArchive,
                    ]}
                    onPress={() => onToggleBlockAuthor(post.authorName)}
                  >
                    <MaterialCommunityIcons
                      name={authorBlocked ? 'account-check-outline' : 'account-cancel-outline'}
                      size={14}
                      color={authorBlocked ? '#047857' : '#B45309'}
                    />
                    <Text
                      style={[
                        styles.modActionBtnText,
                        { color: authorBlocked ? '#047857' : '#B45309' },
                      ]}
                    >
                      {authorBlocked ? 'Odblokuj autora' : 'Blokuj autora'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modActionBtn, styles.modActionDelete]}
                    onPress={() => handleConfirmDeleteBoardPost(post)}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={14} color="#DC2626" />
                    <Text style={[styles.modActionBtnText, { color: '#DC2626' }]}>Usuń wpis</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {filteredBoardPosts.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxText}>Brak wpisów na Tablicy dla wybranego filtra.</Text>
            </View>
          )}
        </View>
      )}

      {subTab === 'blocked' && (
        <View>
          <View style={styles.cardBox}>
            <Text style={styles.inputLabel}>Zablokuj użytkownika / nick:</Text>
            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.urlInput}
                value={blockAuthorDraft}
                onChangeText={setBlockAuthorDraft}
                placeholder="Wpisz dokładną nazwę autora..."
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={styles.blockBtn}
                onPress={handleBlockManualAuthor}
                activeOpacity={0.85}
              >
                <Text style={styles.blockBtnText}>Zablokuj</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.blockHint}>
              Ogłoszenia i wpisy na Tablicy od zablokowanych autorów są automatycznie ukrywane przed użytkownikami.
            </Text>
          </View>

          {blockedAuthors.map((author) => {
            const authoredItems = items.filter(
              (i) => i.authorName?.trim().toLowerCase() === author.toLowerCase()
            ).length;
            const authoredPosts = boardPosts.filter(
              (p) => p.authorName.trim().toLowerCase() === author.toLowerCase()
            ).length;
            return (
              <View key={author} style={styles.blockedRow}>
                <View style={styles.flexOne}>
                  <Text style={styles.blockedAuthorName}>{author}</Text>
                  <Text style={styles.blockedAuthorMeta}>
                    {authoredItems} ogłoszeń • {authoredPosts} wpisów na Tablicy
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.unblockBtn}
                  onPress={() => onToggleBlockAuthor(author)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.unblockBtnText}>Odblokuj</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {blockedAuthors.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxText}>Brak zablokowanych autorów.</Text>
            </View>
          )}
        </View>
      )}

      {/* Modal edycji ogłoszenia */}
      <Modal
        visible={Boolean(editingItem)}
        animationType="slide"
        onRequestClose={() => setEditingItem(null)}
      >
        <SafeAreaView style={styles.editSafeArea}>
          <KeyboardAvoidingView
            style={styles.flexOne}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.editHeader}>
              <Text style={styles.editHeaderTitle}>Edytuj ogłoszenie</Text>
              <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.editCloseBtn}>
                <MaterialCommunityIcons name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Typ ogłoszenia:</Text>
              <View style={styles.editChipsRow}>
                {(['wystawka', 'oddam'] as ItemType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.editChip, itemTypeDraft === t && styles.editChipActive]}
                    onPress={() => setItemTypeDraft(t)}
                  >
                    <Text
                      style={[
                        styles.editChipText,
                        itemTypeDraft === t && styles.editChipTextActive,
                      ]}
                    >
                      {t === 'wystawka' ? 'Wystawka' : 'Oddam'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Kategoria:</Text>
              <View style={styles.editChipsRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.editChip, itemCatDraft === cat.id && styles.editChipActive]}
                    onPress={() => setItemCatDraft(cat.id)}
                  >
                    <Text
                      style={[
                        styles.editChipText,
                        itemCatDraft === cat.id && styles.editChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Tytuł:</Text>
              <TextInput
                style={styles.editInput}
                value={itemTitleDraft}
                onChangeText={setItemTitleDraft}
                placeholder="Tytuł ogłoszenia"
              />

              <Text style={styles.inputLabel}>Opis:</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                multiline
                numberOfLines={4}
                value={itemDescDraft}
                onChangeText={setItemDescDraft}
                placeholder="Opis przedmiotu"
              />

              <Text style={styles.inputLabel}>Adres / lokalizacja:</Text>
              <TextInput
                style={styles.editInput}
                value={itemAddressDraft}
                onChangeText={setItemAddressDraft}
                placeholder="Np. ul. Lipowa 12, Lublin"
              />

              <Text style={styles.inputLabel}>Autor:</Text>
              <TextInput
                style={styles.editInput}
                value={itemAuthorDraft}
                onChangeText={setItemAuthorDraft}
                placeholder="Nazwa autora"
              />

              <Text style={styles.inputLabel}>Kontakt:</Text>
              <TextInput
                style={styles.editInput}
                value={itemContactDraft}
                onChangeText={setItemContactDraft}
                placeholder="Informacje kontaktowe"
              />

              <TouchableOpacity
                style={styles.saveEditBtn}
                onPress={handleSaveItemEdit}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="content-save" size={18} color="#FFFFFF" />
                <Text style={styles.saveEditBtnText}>Zapisz zmiany ogłoszenia</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal edycji wpisu na Tablicy */}
      <Modal
        visible={Boolean(editingBoardPost)}
        animationType="slide"
        onRequestClose={() => setEditingBoardPost(null)}
      >
        <SafeAreaView style={styles.editSafeArea}>
          <KeyboardAvoidingView
            style={styles.flexOne}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.editHeader}>
              <Text style={styles.editHeaderTitle}>Edytuj wpis na Tablicy</Text>
              <TouchableOpacity
                onPress={() => setEditingBoardPost(null)}
                style={styles.editCloseBtn}
              >
                <MaterialCommunityIcons name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Tag wpisu:</Text>
              <View style={styles.editChipsRow}>
                {BOARD_TAGS.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.editChip, boardTagDraft === t.id && styles.editChipActive]}
                    onPress={() => setBoardTagDraft(t.id)}
                  >
                    <Text
                      style={[
                        styles.editChipText,
                        boardTagDraft === t.id && styles.editChipTextActive,
                      ]}
                    >
                      #{t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Tytuł wpisu:</Text>
              <TextInput
                style={styles.editInput}
                value={boardTitleDraft}
                onChangeText={setBoardTitleDraft}
              />

              <Text style={styles.inputLabel}>Treść:</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                multiline
                numberOfLines={5}
                value={boardContentDraft}
                onChangeText={setBoardContentDraft}
              />

              <Text style={styles.inputLabel}>Autor:</Text>
              <TextInput
                style={styles.editInput}
                value={boardAuthorDraft}
                onChangeText={setBoardAuthorDraft}
              />

              <Text style={styles.inputLabel}>Okolica / dzielnica:</Text>
              <TextInput
                style={styles.editInput}
                value={boardAreaDraft}
                onChangeText={setBoardAreaDraft}
              />

              <TouchableOpacity
                style={styles.saveEditBtn}
                onPress={handleSaveBoardEdit}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="content-save" size={18} color="#FFFFFF" />
                <Text style={styles.saveEditBtnText}>Zapisz zmiany wpisu</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  subTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subTabBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  subTabText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#64748B',
  },
  subTabTextActive: {
    color: '#047857',
    fontFamily: APP_FONT,
    fontWeight: '700',
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#0F172A',
    padding: 0,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  toolChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  toolChipText: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#334155',
  },
  toolChipTextActive: {
    color: '#FFFFFF',
  },
  bulkBar: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  bulkTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bulkCountText: {
    fontSize: 12.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#047857',
  },
  bulkSelectBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  bulkMiniLink: {
    paddingVertical: 2,
  },
  bulkMiniLinkText: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#0284C7',
  },
  bulkActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bulkActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  bulkActionText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  smallFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smallFilterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  smallFilterText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '500',
    color: '#475569',
  },
  smallFilterTextActive: {
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
  modCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
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
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
  },
  checkboxBtn: {
    marginRight: 2,
  },
  typeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeTagText: {
    fontSize: 10,
    fontFamily: APP_FONT,
    fontWeight: '700',
  },
  statusTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontFamily: APP_FONT,
    fontWeight: '600',
  },
  flaggedTag: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flaggedTagText: {
    fontSize: 10,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#DC2626',
  },
  blockedTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  blockedTagText: {
    fontSize: 10,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modTimeText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#94A3B8',
  },
  modTitle: {
    fontSize: 14.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  modDescSnippet: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#475569',
    marginBottom: 4,
  },
  modSub: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#64748B',
  },
  modVotesMeta: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '500',
    color: '#475569',
    marginTop: 4,
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
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modActionEdit: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  modActionRestore: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  modActionArchive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  modActionDelete: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  modActionBtnText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#334155',
  },
  boardTagBadge: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#0F172A',
  },
  blockBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockBtnText: {
    fontSize: 12.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  blockHint: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#64748B',
    lineHeight: 16,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  blockedAuthorName: {
    fontSize: 14,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
  },
  blockedAuthorMeta: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 2,
  },
  unblockBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  unblockBtnText: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#047857',
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
    fontSize: 13,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#64748B',
    textAlign: 'center',
  },
  editSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  editHeaderTitle: {
    fontSize: 17,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
  },
  editCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  editScroll: {
    padding: 16,
  },
  editChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  editChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  editChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  editChipText: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
  },
  editChipTextActive: {
    color: '#FFFFFF',
  },
  editInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#0F172A',
    marginBottom: 12,
  },
  editTextArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  saveEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 6,
    marginBottom: 32,
  },
  saveEditBtnText: {
    fontSize: 14.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
