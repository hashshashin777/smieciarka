import React, { useEffect, useMemo, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AdminBlockEntry,
  BoardPost,
  BoardTag,
  ItemCategory,
  ItemType,
  ModerationCase,
  PostItem,
} from '../types';
import { CATEGORIES, APP_FONT } from '../constants/categories';
import { formatRelativeTime } from '../utils/helpers';
import {
  fetchAdminBlocksInCloud,
  fetchModerationCasesInCloud,
  fetchReportedItemsSummaryInCloud,
  recordAdminAuditLogInCloud,
  recordAdminBlockInCloud,
  resolveModerationCaseInCloud,
  revokeAdminBlockInCloud,
} from '../services/supabase';

type ModerationSubTab = 'reports' | 'items' | 'board' | 'blocked';
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
  autoExpireHours?: number;
  autoExpireOddamDays?: number;
  currentActorName?: string;
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
  autoExpireHours = 6,
  autoExpireOddamDays = 14,
  currentActorName = 'Moderator',
}) => {
  const [subTab, setSubTab] = useState<ModerationSubTab>('reports');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemCategory>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [sortMode, setSortMode] = useState<ItemSortMode>('flagged_first');
  const [boardTagFilter, setBoardTagFilter] = useState<'all' | BoardTag>('all');

  // Sprawy moderacyjne (ADM-02)
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [caseFilterStatus, setCaseFilterStatus] = useState<'all' | 'pending' | 'resolved'>('pending');

  // Ustrukturyzowane blokady (ADM-05)
  const [structuredBlocks, setStructuredBlocks] = useState<AdminBlockEntry[]>([]);
  const [blockAuthorDraft, setBlockAuthorDraft] = useState('');
  const [blockReasonDraft, setBlockReasonDraft] = useState('Naruszenie regulaminu / spam');
  const [blockScopeDraft, setBlockScopeDraft] = useState<'all' | 'items' | 'board'>('all');
  const [blockDurationDraft, setBlockDurationDraft] = useState<'7d' | '30d' | 'permanent'>('30d');
  const [isSavingBlock, setIsSavingBlock] = useState(false);

  // Zaznaczanie zbiorcze (Bulk Moderation)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const [reportsMap, setReportsMap] = useState<Record<string, { count: number; latestReason: string }>>({});
  const [referenceTime] = useState(() => Date.now());

  // Ładowanie zgłoszeń i blokad
  const loadModerationData = async () => {
    setIsLoadingCases(true);
    try {
      const [casesRes, blocksRes, repRes] = await Promise.all([
        fetchModerationCasesInCloud(),
        fetchAdminBlocksInCloud(),
        fetchReportedItemsSummaryInCloud(),
      ]);

      if (casesRes.ok && casesRes.data) {
        setCases(casesRes.data);
      }
      if (blocksRes.ok && blocksRes.data) {
        setStructuredBlocks(blocksRes.data);
      }
      if (repRes.ok && repRes.data) {
        const map: Record<string, { count: number; latestReason: string }> = {};
        for (const r of repRes.data) {
          map[r.itemId] = { count: r.reportsCount, latestReason: r.latestReason };
        }
        setReportsMap(map);
      }
    } finally {
      setIsLoadingCases(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      const [casesRes, blocksRes, repRes] = await Promise.all([
        fetchModerationCasesInCloud(),
        fetchAdminBlocksInCloud(),
        fetchReportedItemsSummaryInCloud(),
      ]);

      if (isMounted) {
        if (casesRes.ok && casesRes.data) {
          setCases(casesRes.data);
        }
        if (blocksRes.ok && blocksRes.data) {
          setStructuredBlocks(blocksRes.data);
        }
        if (repRes.ok && repRes.data) {
          const map: Record<string, { count: number; latestReason: string }> = {};
          for (const r of repRes.data) {
            map[r.itemId] = { count: r.reportsCount, latestReason: r.latestReason };
          }
          setReportsMap(map);
        }
        setIsLoadingCases(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeStructuredBlocks = useMemo(() => {
    return structuredBlocks.filter((b) => {
      if (b.revokedAt) return false;
      if (b.expiresAt && new Date(b.expiresAt).getTime() <= referenceTime) return false;
      return true;
    });
  }, [structuredBlocks, referenceTime]);

  const blockedSet = useMemo(() => {
    const set = new Set(blockedAuthors.map((a) => a.toLowerCase().trim()));
    for (const b of activeStructuredBlocks) {
      const name = b.targetValue || b.authorName || '';
      if (name) {
        set.add(name.toLowerCase().trim());
      }
    }
    return set;
  }, [blockedAuthors, activeStructuredBlocks]);

  const isAuthorBlocked = (name?: string): boolean =>
    Boolean(name && blockedSet.has(name.trim().toLowerCase()));

  const counts = useMemo(() => {
    let active = 0;
    let flagged = 0;
    let expired = 0;
    let archived = 0;
    for (const item of items) {
      const isAct = isItemActiveCheck(item);
      const isItemReported = Boolean(reportsMap[item.id]);
      if (isAct) {
        active += 1;
        if (item.takenVotes > 0 || isItemReported) flagged += 1;
      } else if (item.status === 'taken') {
        archived += 1;
      } else {
        expired += 1;
      }
    }
    return { active, flagged, expired, archived };
  }, [items, isItemActiveCheck, reportsMap]);

  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      map[cat.id] = cat.label;
    }
    return map;
  }, []);

  // Wykrywanie miast z adresów ogłoszeń (ADM-06)
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const addr = item.location?.address;
      if (!addr) continue;
      const parts = addr.split(',').map((p) => p.trim());
      if (parts.length > 1) {
        const cityCandidate = parts[parts.length - 1].replace(/\d{2}-\d{3}\s*/g, '').trim();
        if (cityCandidate.length > 2) {
          set.add(cityCandidate);
        }
      }
    }
    return Array.from(set).sort();
  }, [items]);

  // Liczba aktywnych filtrów (ADM-06)
  const activeFiltersCount = useMemo(() => {
    let cnt = 0;
    if (statusFilter !== 'all') cnt++;
    if (typeFilter !== 'all') cnt++;
    if (categoryFilter !== 'all') cnt++;
    if (cityFilter !== 'all') cnt++;
    if (dateFilter !== 'all') cnt++;
    if (authorFilter.trim().length > 0) cnt++;
    if (search.trim().length > 0) cnt++;
    return cnt;
  }, [statusFilter, typeFilter, categoryFilter, cityFilter, dateFilter, authorFilter, search]);

  const resetAllFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setCategoryFilter('all');
    setCityFilter('all');
    setDateFilter('all');
    setAuthorFilter('');
    setSearch('');
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const authorQ = authorFilter.trim().toLowerCase();
    const now = referenceTime;

    const list = items.filter((item) => {
      const isAct = isItemActiveCheck(item);
      if (statusFilter === 'active' && !isAct) return false;
      if (statusFilter === 'flagged' && !(isAct && (item.takenVotes > 0 || Boolean(reportsMap[item.id])))) return false;
      if (statusFilter === 'expired' && !(!isAct && item.status !== 'taken')) return false;
      if (statusFilter === 'archived' && !(!isAct && item.status === 'taken')) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Filtr miasta
      if (cityFilter !== 'all') {
        const addr = (item.location?.address || '').toLowerCase();
        if (!addr.includes(cityFilter.toLowerCase())) return false;
      }

      // Filtr daty
      if (dateFilter !== 'all') {
        const itemTime = new Date(item.createdAt).getTime();
        const diffMs = now - itemTime;
        if (dateFilter === 'today' && diffMs > 24 * 3600 * 1000) return false;
        if (dateFilter === '7d' && diffMs > 7 * 24 * 3600 * 1000) return false;
        if (dateFilter === '30d' && diffMs > 30 * 24 * 3600 * 1000) return false;
      }

      // Filtr autora
      if (authorQ.length > 0) {
        const author = (item.authorName || '').toLowerCase();
        if (!author.includes(authorQ)) return false;
      }

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
  }, [
    items,
    statusFilter,
    typeFilter,
    categoryFilter,
    cityFilter,
    dateFilter,
    authorFilter,
    search,
    sortMode,
    isItemActiveCheck,
    reportsMap,
    referenceTime,
  ]);

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

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const isPending = (c.caseStatus || c.status || 'pending') === 'pending';
      if (caseFilterStatus === 'pending' && !isPending) return false;
      if (caseFilterStatus === 'resolved' && isPending) return false;
      return true;
    });
  }, [cases, caseFilterStatus]);

  const pendingCasesCount = useMemo(() => {
    return cases.filter((c) => (c.caseStatus || c.status || 'pending') === 'pending').length;
  }, [cases]);

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Obsługa akcji zbiorczych (ADM-03)
  const handleBulkAction = (action: 'restore' | 'archive' | 'delete') => {
    if (selectedIds.length === 0) return;

    if (action === 'delete') {
      Alert.alert(
        'Usunąć zaznaczone ogłoszenia?',
        `Trwale usuniesz ${selectedIds.length} zaznaczonych ogłoszeń. Tej operacji nie można cofnąć.`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Usuń bezpowrotnie',
            style: 'destructive',
            onPress: () => {
              onBulkItemAction(selectedIds, 'delete');
              void recordAdminAuditLogInCloud({
                actorName: currentActorName,
                actorRole: 'moderator',
                action: 'bulk_delete',
                targetType: 'bulk',
                targetId: 'multiple',
                details: { count: selectedIds.length, ids: selectedIds },
              });
              setSelectedIds([]);
            },
          },
        ]
      );
      return;
    }

    if (action === 'restore') {
      const selectedItems = items.filter((it) => selectedIds.includes(it.id));
      const countWystawka = selectedItems.filter((it) => it.type === 'wystawka').length;
      const countOddam = selectedItems.filter((it) => it.type === 'oddam').length;

      Alert.alert(
        'Zatwierdź / Odnów czas trwania',
        `Przedłużysz widoczność ${selectedIds.length} ogłoszeń zgodnie z ich typem:\n` +
          `• ${countWystawka} wystawek (+${autoExpireHours}h)\n` +
          `• ${countOddam} ogłoszeń „oddam” (+${autoExpireOddamDays} dni).`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Przedłuż czas',
            onPress: () => {
              onBulkItemAction(selectedIds, 'restore');
              void recordAdminAuditLogInCloud({
                actorName: currentActorName,
                actorRole: 'moderator',
                action: 'bulk_restore',
                targetType: 'bulk',
                targetId: 'multiple',
                details: {
                  count: selectedIds.length,
                  countWystawka,
                  countOddam,
                  autoExpireHours,
                  autoExpireOddamDays,
                },
              });
              setSelectedIds([]);
            },
          },
        ]
      );
      return;
    }

    // archive
    onBulkItemAction(selectedIds, action);
    void recordAdminAuditLogInCloud({
      actorName: currentActorName,
      actorRole: 'moderator',
      action: 'bulk_archive',
      targetType: 'bulk',
      targetId: 'multiple',
      details: { count: selectedIds.length, ids: selectedIds },
    });
    setSelectedIds([]);
  };

  const handleConfirmDeleteItem = (item: PostItem) => {
    Alert.alert(
      'Usunąć ogłoszenie?',
      `Czy na pewno chcesz trwale usunąć „${item.title}”?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: () => {
            onDeleteItem(item.id);
            void recordAdminAuditLogInCloud({
              actorName: currentActorName,
              actorRole: 'moderator',
              action: 'delete_item',
              targetType: 'item',
              targetId: item.id,
              details: { title: item.title, author: item.authorName },
            });
          },
        },
      ]
    );
  };

  const handleConfirmDeleteBoardPost = (post: BoardPost) => {
    Alert.alert(
      'Usunąć wpis z Tablicy?',
      `Czy na pewno chcesz usunąć wpis „${post.title}”?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń wpis',
          style: 'destructive',
          onPress: () => {
            onDeleteBoardPost(post.id);
            void recordAdminAuditLogInCloud({
              actorName: currentActorName,
              actorRole: 'moderator',
              action: 'delete_board_post',
              targetType: 'board_post',
              targetId: post.id,
              details: { title: post.title, author: post.authorName },
            });
          },
        },
      ]
    );
  };

  // Rozstrzygnięcie sprawy moderacyjnej (ADM-02)
  const handleResolveCase = async (
    modCase: ModerationCase,
    resolution: 'action_taken' | 'dismissed',
    notes: string
  ) => {
    const res = await resolveModerationCaseInCloud(
      modCase.targetType,
      modCase.targetId,
      resolution,
      currentActorName
    );
    if (!res.ok) {
      Alert.alert('Błąd', res.error?.message || 'Nie udało się rozpatrzyć zgłoszenia.');
      return;
    }

    // Aktualizacja w interfejsie
    if (resolution === 'action_taken') {
      if (modCase.targetType === 'item') {
        onArchiveItem(modCase.targetId);
      } else {
        onDeleteBoardPost(modCase.targetId);
      }
    } else if (resolution === 'dismissed') {
      if (modCase.targetType === 'item') {
        onResetItemFlags(modCase.targetId);
      }
    }

    await recordAdminAuditLogInCloud({
      actorName: currentActorName,
      actorRole: 'moderator',
      action: resolution === 'action_taken' ? 'resolve_case_action' : 'resolve_case_dismiss',
      targetType: modCase.targetType,
      targetId: modCase.targetId,
      details: { caseId: modCase.caseId, notes, resolution },
    });

    setCases((prev) =>
      prev.map((c) =>
        c.caseId === modCase.caseId
          ? {
              ...c,
              caseStatus: resolution,
              status: resolution,
              resolvedAt: new Date().toISOString(),
              resolvedBy: currentActorName,
              resolutionNotes: notes,
            }
          : c
      )
    );

    Alert.alert('Zgłoszenie rozpatrzone ✅', notes);
  };

  // Nakładanie ustrukturyzowanej blokady (ADM-05)
  const handleCreateStructuredBlock = async () => {
    const author = blockAuthorDraft.trim();
    if (!author) {
      Alert.alert('Brak autora', 'Podaj nazwę użytkownika lub nick do zablokowania.');
      return;
    }

    setIsSavingBlock(true);
    let expiresAt: string | null = null;
    if (blockDurationDraft === '7d') {
      expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    } else if (blockDurationDraft === '30d') {
      expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    }

    const res = await recordAdminBlockInCloud({
      targetType: 'author_name',
      targetValue: author,
      authorName: author,
      reason: blockReasonDraft,
      scope: blockScopeDraft,
      duration: blockDurationDraft,
      expiresAt,
      blockedByName: currentActorName,
      issuedBy: currentActorName,
    });

    setIsSavingBlock(false);

    if (!res.ok) {
      Alert.alert('Błąd blokady', res.error?.message || 'Nie udało się zapisać blokady.');
      return;
    }

    // Upewnij się, że autor jest też w prostej liście blockedAuthors
    if (!blockedAuthors.includes(author)) {
      onToggleBlockAuthor(author);
    }

    await recordAdminAuditLogInCloud({
      actorName: currentActorName,
      actorRole: 'moderator',
      action: 'create_block',
      targetType: 'user',
      targetId: author,
      details: {
        reason: blockReasonDraft,
        scope: blockScopeDraft,
        duration: blockDurationDraft,
        expiresAt,
      },
    });

    setBlockAuthorDraft('');
    await loadModerationData();
    Alert.alert('Blokada nałożona 🛡️', `Użytkownik „${author}” został zablokowany.`);
  };

  const handleRevokeBlock = async (block: AdminBlockEntry) => {
    const authorName = block.targetValue || block.authorName || '';
    const res = await revokeAdminBlockInCloud(block.id, currentActorName);
    if (!res.ok) {
      Alert.alert('Błąd', res.error?.message || 'Nie udało się cofnąć blokady.');
      return;
    }

    // Jeśli był na liście prostej, zdejmij
    if (blockedAuthors.includes(authorName)) {
      onToggleBlockAuthor(authorName);
    }

    await recordAdminAuditLogInCloud({
      actorName: currentActorName,
      actorRole: 'moderator',
      action: 'revoke_block',
      targetType: 'user',
      targetId: authorName,
      details: { blockId: block.id },
    });

    setStructuredBlocks((prev) =>
      prev.map((b) => (b.id === block.id ? { ...b, revokedAt: new Date().toISOString() } : b))
    );
    Alert.alert('Blokada cofnięta ✅', `Użytkownik „${authorName}” został odblokowany.`);
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
    const updated: PostItem = {
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
    };
    onUpdateItem(updated);
    void recordAdminAuditLogInCloud({
      actorName: currentActorName,
      actorRole: 'moderator',
      action: 'edit_item',
      targetType: 'item',
      targetId: editingItem.id,
      details: { title: cleanedTitle, type: itemTypeDraft, category: itemCatDraft },
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
    void recordAdminAuditLogInCloud({
      actorName: currentActorName,
      actorRole: 'moderator',
      action: 'edit_board_post',
      targetType: 'board_post',
      targetId: editingBoardPost.id,
      details: { title: boardTitleDraft.trim(), tag: boardTagDraft },
    });
    setEditingBoardPost(null);
    Alert.alert('Zapisano wpis ✅', 'Ogłoszenie na Tablicy zostało zaktualizowane.');
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
      {/* Przełącznik 4 podzakładek moderacji (ADM-02) */}
      <View style={styles.subTabsRow}>
        {(
          [
            {
              id: 'reports',
              label: `Zgłoszenia (${pendingCasesCount})`,
              icon: 'shield-alert-outline',
            },
            {
              id: 'items',
              label: `Ogłoszenia (${items.length})`,
              icon: 'package-variant-closed',
            },
            {
              id: 'board',
              label: `Tablica (${boardPosts.length})`,
              icon: 'bulletin-board',
            },
            {
              id: 'blocked',
              label: `Blokady (${blockedAuthors.length + activeStructuredBlocks.length})`,
              icon: 'account-cancel-outline',
            },
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
                size={14}
                color={active ? '#047857' : '#64748B'}
              />
              <Text
                style={[styles.subTabText, active && styles.subTabTextActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 1. Podzakładka: KOLEJKA SPRAW MODERACYJNYCH (ADM-02) */}
      {subTab === 'reports' && (
        <View>
          <View style={styles.filterPillsRow}>
            {(
              [
                { id: 'pending', label: `Oczekujące (${pendingCasesCount})` },
                { id: 'all', label: `Wszystkie sprawy (${cases.length})` },
                { id: 'resolved', label: `Rozpatrzone (${cases.length - pendingCasesCount})` },
              ] as { id: 'pending' | 'all' | 'resolved'; label: string }[]
            ).map((f) => {
              const selected = caseFilterStatus === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterPill, selected && styles.filterPillActive]}
                  onPress={() => setCaseFilterStatus(f.id)}
                >
                  <Text style={[styles.filterPillText, selected && styles.filterPillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoadingCases && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#047857" />
              <Text style={styles.loadingText}>Ładowanie spraw moderacyjnych...</Text>
            </View>
          )}

          {!isLoadingCases && filteredCases.length === 0 && (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="shield-check" size={32} color="#10B981" />
              <Text style={[styles.emptyBoxText, { marginTop: 8 }]}>
                {caseFilterStatus === 'pending'
                  ? 'Brak oczekujących zgłoszeń. Wszystkie sprawy zostały rozpatrzone!'
                  : 'Brak spraw moderacyjnych w wybranym widoku.'}
              </Text>
            </View>
          )}

          {filteredCases.map((c) => {
            const isPending = (c.caseStatus || c.status || 'pending') === 'pending';
            const matchedItem = c.targetType === 'item' ? items.find((i) => i.id === c.targetId) : null;
            const matchedPost = c.targetType === 'board_post' ? boardPosts.find((p) => p.id === c.targetId) : null;
            const reportsNum = c.reportsCount || c.reportCount || 1;

            return (
              <View
                key={c.caseId || c.targetId}
                style={[
                  styles.modCard,
                  isPending ? styles.modCardPending : styles.modCardResolved,
                ]}
              >
                <View style={styles.modCardTop}>
                  <View style={styles.modBadgeGroup}>
                    <View
                      style={[
                        styles.typeTag,
                        { backgroundColor: c.targetType === 'item' ? '#E0F2FE' : '#F3E8FF' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeTagText,
                          { color: c.targetType === 'item' ? '#0369A1' : '#7E22CE' },
                        ]}
                      >
                        {c.targetType === 'item' ? 'OGŁOSZENIE' : 'TABLICA'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusTag,
                        {
                          backgroundColor: isPending
                            ? '#FEF3C7'
                            : (c.caseStatus || c.status) === 'action_taken'
                            ? '#FEE2E2'
                            : '#ECFDF5',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTagText,
                          {
                            color: isPending
                              ? '#B45309'
                              : (c.caseStatus || c.status) === 'action_taken'
                              ? '#DC2626'
                              : '#047857',
                          },
                        ]}
                      >
                        {isPending
                          ? 'OCZEKUJE'
                          : (c.caseStatus || c.status) === 'action_taken'
                          ? 'UKRYTO / USUNIĘTO'
                          : 'ODRZUCONO'}
                      </Text>
                    </View>

                    <View style={styles.flaggedTag}>
                      <Text style={styles.flaggedTagText}>⚠️ {reportsNum} zgłoszeń</Text>
                    </View>
                  </View>

                  <Text style={styles.modTimeText}>
                    {formatRelativeTime(c.latestReportDate || c.createdAt || new Date().toISOString())}
                  </Text>
                </View>

                {/* Podgląd zgłoszonego obiektu */}
                <Text style={styles.modTitle}>
                  {matchedItem?.title || matchedPost?.title || `Obiekt ID: ${c.targetId}`}
                </Text>

                <Text style={styles.modDescSnippet} numberOfLines={2}>
                  {matchedItem?.description || matchedPost?.content || 'Brak treści obiektu'}
                </Text>

                <Text style={styles.modSub}>
                  Autor: {matchedItem?.authorName || matchedPost?.authorName || 'Anonim'} •{' '}
                  {matchedItem ? `Kat: ${categoryLabelMap[matchedItem.category] || matchedItem.category}` : 'Wpis sąsiedzki'}
                </Text>

                {/* Podsumowanie powodów zgłoszeń */}
                <View style={styles.reasonsSummaryBox}>
                  <Text style={styles.reasonsSummaryTitle}>Zgłoszone powody ({reportsNum}):</Text>
                  {c.reasonsList && c.reasonsList.length > 0 ? (
                    c.reasonsList.map((reason, idx) => (
                      <Text key={`${reason}_${idx}`} style={styles.reasonLine}>
                        • <Text style={styles.reasonName}>{reason}</Text>
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.reasonLine}>
                      • <Text style={styles.reasonName}>{c.latestReason}</Text>
                    </Text>
                  )}
                  {Boolean(c.latestReason) && (
                    <Text style={styles.latestReasonText}>Ostatni powód: „{c.latestReason}”</Text>
                  )}
                </View>

                {/* Notatki rozstrzygnięcia jeśli rozpatrzone */}
                {!isPending && (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionTitle}>
                      Rozpatrzył: {c.resolvedBy || 'Moderator'}
                    </Text>
                    <Text style={styles.resolutionNotes}>{c.resolutionNotes || 'Sprawa rozstrzygnięta'}</Text>
                  </View>
                )}

                {/* Przyciski decyzyjne dla oczekujących */}
                {isPending && (
                  <View style={styles.modActionsRow}>
                    {matchedItem && (
                      <TouchableOpacity
                        style={styles.modActionBtn}
                        onPress={() => onOpenItemDetail(matchedItem)}
                      >
                        <MaterialCommunityIcons name="eye-outline" size={14} color="#334155" />
                        <Text style={styles.modActionBtnText}>Podgląd</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.modActionBtn, styles.modActionArchive]}
                      onPress={() =>
                        void handleResolveCase(
                          c,
                          'action_taken',
                          'Zgłoszenie zasadne: oznaczono jako zabrane / ukryto z widoku'
                        )
                      }
                    >
                      <MaterialCommunityIcons name="shield-check" size={14} color="#B45309" />
                      <Text style={[styles.modActionBtnText, { color: '#B45309' }]}>
                        Zasadne (Ukryj)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modActionBtn, styles.modActionRestore]}
                      onPress={() =>
                        void handleResolveCase(
                          c,
                          'dismissed',
                          'Zgłoszenie odrzucone: treść zgodna z regulaminem, fałszywy alarm'
                        )
                      }
                    >
                      <MaterialCommunityIcons name="shield-remove" size={14} color="#047857" />
                      <Text style={[styles.modActionBtnText, { color: '#047857' }]}>
                        Odrzuć zgłoszenie
                      </Text>
                    </TouchableOpacity>

                    {(matchedItem?.authorName || matchedPost?.authorName) && (
                      <TouchableOpacity
                        style={[styles.modActionBtn, styles.modActionDelete]}
                        onPress={() => {
                          const author = matchedItem?.authorName || matchedPost?.authorName;
                          if (author) {
                            setBlockAuthorDraft(author);
                            setSubTab('blocked');
                          }
                        }}
                      >
                        <MaterialCommunityIcons name="account-cancel" size={14} color="#DC2626" />
                        <Text style={[styles.modActionBtnText, { color: '#DC2626' }]}>
                          Zablokuj autora
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* 2. Podzakładka: MODERACJA OGŁOSZEŃ (ADM-03, ADM-06) */}
      {subTab === 'items' && (
        <View>
          {/* Pasek wyszukiwania */}
          <View style={styles.searchInputBox}>
            <MaterialCommunityIcons name="magnify" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Szukaj po tytule, opisie, ulicy, autorze lub ID..."
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

          {/* Narzędzia: Tryb zaznaczania + Sortowanie */}
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

          {/* Pasek akcji zbiorczych z poprawnymi nazwami i TTL (ADM-03) */}
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
                  <Text style={[styles.bulkActionText, { color: '#047857' }]}>
                    Zatwierdź / Odnów (TTL wg typu)
                  </Text>
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

          {/* Wskaźnik i reset aktywnych filtrów (ADM-06) */}
          {activeFiltersCount > 0 && (
            <View style={styles.activeFiltersBar}>
              <Text style={styles.activeFiltersText}>Aktywne filtry: {activeFiltersCount}</Text>
              <TouchableOpacity onPress={resetAllFilters} style={styles.clearFiltersBtn}>
                <MaterialCommunityIcons name="filter-remove-outline" size={14} color="#DC2626" />
                <Text style={styles.clearFiltersBtnText}>Wyczyść filtry</Text>
              </TouchableOpacity>
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

          {/* Filtry typu i daty (ADM-06, ADM-07) */}
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

            {/* Filtr daty dodania */}
            {(
              [
                { id: 'all', label: 'Wszystkie daty' },
                { id: 'today', label: 'Dziś (24h)' },
                { id: '7d', label: 'Ostatnie 7 dni' },
                { id: '30d', label: 'Ostatnie 30 dni' },
              ] as { id: 'all' | 'today' | '7d' | '30d'; label: string }[]
            ).map((d) => {
              const selected = dateFilter === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.smallFilterPill, selected && styles.smallFilterPillActive]}
                  onPress={() => setDateFilter(d.id)}
                >
                  <Text style={[styles.smallFilterText, selected && styles.smallFilterTextActive]}>
                    📅 {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Filtry kategorii i miast (ADM-06) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {/* Miasta */}
            <TouchableOpacity
              style={[styles.smallFilterPill, cityFilter === 'all' && styles.smallFilterPillActive]}
              onPress={() => setCityFilter('all')}
            >
              <Text style={[styles.smallFilterText, cityFilter === 'all' && styles.smallFilterTextActive]}>
                📍 Wszystkie miasta
              </Text>
            </TouchableOpacity>
            {availableCities.map((c) => {
              const selected = cityFilter === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.smallFilterPill, selected && styles.smallFilterPillActive]}
                  onPress={() => setCityFilter(c)}
                >
                  <Text style={[styles.smallFilterText, selected && styles.smallFilterTextActive]}>
                    📍 {c}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Kategorie */}
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

                    {Boolean(reportsMap[item.id]) && (
                      <View style={styles.reportedTag}>
                        <Text style={styles.reportedTagText}>
                          🛡️ {reportsMap[item.id].count} zgł. ({reportsMap[item.id].latestReason})
                        </Text>
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

                  {/* Poprawiona etykieta czasu trwania: +6h dla wystawki, +14d dla oddam (ADM-03) */}
                  <TouchableOpacity
                    style={[styles.modActionBtn, styles.modActionRestore]}
                    onPress={() => onRestoreItem(item.id)}
                  >
                    <MaterialCommunityIcons name="refresh" size={14} color="#047857" />
                    <Text style={[styles.modActionBtnText, { color: '#047857' }]}>
                      {active
                        ? item.type === 'oddam'
                          ? `+${autoExpireOddamDays}d`
                          : `+${autoExpireHours}h`
                        : 'Przywróć'}
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
                      onPress={() => {
                        const author = item.authorName!.trim();
                        if (authorBlocked) {
                          onToggleBlockAuthor(author);
                        } else {
                          setBlockAuthorDraft(author);
                          setSubTab('blocked');
                        }
                      }}
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

      {/* 3. Podzakładka: TABLICA */}
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
                    onPress={() => {
                      if (authorBlocked) {
                        onToggleBlockAuthor(post.authorName);
                      } else {
                        setBlockAuthorDraft(post.authorName);
                        setSubTab('blocked');
                      }
                    }}
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

      {/* 4. Podzakładka: USTRUKTURYZOWANE BLOKADY (ADM-05) */}
      {subTab === 'blocked' && (
        <View>
          {/* Formularz nakładania nowej blokady */}
          <View style={styles.cardBox}>
            <Text style={styles.sectionHeaderTitle}>Nałóż blokadę na użytkownika</Text>

            <Text style={styles.inputLabel}>Użytkownik / nick:</Text>
            <TextInput
              style={styles.urlInput}
              value={blockAuthorDraft}
              onChangeText={setBlockAuthorDraft}
              placeholder="Wpisz dokładną nazwę autora..."
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Powód blokady:</Text>
            <View style={styles.chipsRowWrap}>
              {(
                [
                  'Naruszenie regulaminu / spam',
                  'Wymóg opłaty za darmowe',
                  'Niebezpieczne zachowanie / oszustwo',
                  'Fałszywe lokalizacje',
                  'Wulgarne zachowanie',
                ]
              ).map((reason) => {
                const selected = blockReasonDraft === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.smallFilterPill, selected && styles.smallFilterPillActive]}
                    onPress={() => setBlockReasonDraft(reason)}
                  >
                    <Text
                      style={[
                        styles.smallFilterText,
                        selected && styles.smallFilterTextActive,
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Zakres blokady:</Text>
            <View style={styles.chipsRowWrap}>
              {(
                [
                  { id: 'all', label: 'Cały serwis (ogłoszenia + tablica)' },
                  { id: 'items', label: 'Tylko dodawanie ogłoszeń' },
                  { id: 'board', label: 'Tylko wpisy na Tablicy' },
                ] as { id: 'all' | 'items' | 'board'; label: string }[]
              ).map((sc) => {
                const selected = blockScopeDraft === sc.id;
                return (
                  <TouchableOpacity
                    key={sc.id}
                    style={[styles.smallFilterPill, selected && styles.smallFilterPillActive]}
                    onPress={() => setBlockScopeDraft(sc.id)}
                  >
                    <Text
                      style={[
                        styles.smallFilterText,
                        selected && styles.smallFilterTextActive,
                      ]}
                    >
                      {sc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Czas trwania:</Text>
            <View style={styles.chipsRowWrap}>
              {(
                [
                  { id: '7d', label: '7 dni' },
                  { id: '30d', label: '30 dni' },
                  { id: 'permanent', label: 'Na stałe (Permanent)' },
                ] as { id: '7d' | '30d' | 'permanent'; label: string }[]
              ).map((dur) => {
                const selected = blockDurationDraft === dur.id;
                return (
                  <TouchableOpacity
                    key={dur.id}
                    style={[styles.smallFilterPill, selected && styles.smallFilterPillActive]}
                    onPress={() => setBlockDurationDraft(dur.id)}
                  >
                    <Text
                      style={[
                        styles.smallFilterText,
                        selected && styles.smallFilterTextActive,
                      ]}
                    >
                      {dur.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.blockBtnFull, isSavingBlock && { opacity: 0.7 }]}
              onPress={() => void handleCreateStructuredBlock()}
              disabled={isSavingBlock}
              activeOpacity={0.85}
            >
              {isSavingBlock ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-lock-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.blockBtnText}>Zatwierdź i nałóż blokadę</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.blockHint}>
              Ogłoszenia i wpisy na Tablicy od zablokowanych autorów są automatycznie ukrywane.
            </Text>
          </View>

          {/* Lista ustrukturyzowanych blokad */}
          <Text style={styles.sectionHeaderTitle}>
            Aktywne blokady w systemie ({activeStructuredBlocks.length})
          </Text>

          {activeStructuredBlocks.map((b) => (
            <View key={b.id} style={styles.modCard}>
              <View style={styles.modCardTop}>
                <View style={styles.modBadgeGroup}>
                  <View style={styles.blockedTag}>
                    <Text style={styles.blockedTagText}>BLOKADA: {b.targetValue || b.authorName}</Text>
                  </View>
                  <View style={styles.statusTag}>
                    <Text style={styles.statusTagText}>
                      Zakres: {b.scope === 'all' ? 'Cały serwis' : b.scope === 'items' ? 'Ogłoszenia' : 'Tablica'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modTimeText}>
                  {b.expiresAt ? `Do ${new Date(b.expiresAt).toLocaleDateString('pl-PL')}` : 'Na stałe'}
                </Text>
              </View>

              <Text style={styles.blockReasonLabel}>Powód: {b.reason}</Text>
              <Text style={styles.modSub}>
                Nałożył: {b.blockedByName || b.issuedBy || 'Admin'} • {formatRelativeTime(b.createdAt)}
              </Text>

              <View style={styles.modActionsRow}>
                <TouchableOpacity
                  style={[styles.modActionBtn, styles.modActionRestore]}
                  onPress={() => void handleRevokeBlock(b)}
                >
                  <MaterialCommunityIcons name="shield-refresh-outline" size={14} color="#047857" />
                  <Text style={[styles.modActionBtnText, { color: '#047857' }]}>
                    Cofnij blokadę (Odblokuj)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Pozostałe proste blokady nicków */}
          {blockedAuthors.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Pozostałe zablokowane nicki ({blockedAuthors.length}):</Text>
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
            </View>
          )}

          {activeStructuredBlocks.length === 0 && blockedAuthors.length === 0 && (
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
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
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
    fontSize: 11,
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
    marginBottom: 8,
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
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1,
  },
  bulkActionText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeFiltersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  activeFiltersText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearFiltersBtnText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#DC2626',
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
  chipsRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  modCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  modCardPending: {
    borderColor: '#F59E0B',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  modCardResolved: {
    borderColor: '#E2E8F0',
    opacity: 0.85,
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
    backgroundColor: '#F1F5F9',
  },
  statusTagText: {
    fontSize: 10,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
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
  reportedTag: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reportedTagText: {
    fontSize: 10,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#B45309',
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
  reasonsSummaryBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reasonsSummaryTitle: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 4,
  },
  reasonLine: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#78350F',
    marginLeft: 4,
  },
  reasonName: {
    fontWeight: '700',
  },
  latestReasonText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#92400E',
    fontStyle: 'italic',
    marginTop: 4,
  },
  resolutionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resolutionTitle: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#475569',
  },
  resolutionNotes: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    color: '#0F172A',
    marginTop: 2,
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
  sectionHeaderTitle: {
    fontSize: 14,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
    marginTop: 4,
  },
  urlInput: {
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
    marginBottom: 8,
  },
  blockBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  blockBtnText: {
    fontSize: 13,
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
    marginTop: 8,
  },
  blockReasonLabel: {
    fontSize: 12.5,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#B91C1C',
    marginTop: 2,
    marginBottom: 2,
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
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 12.5,
    fontFamily: APP_FONT,
    color: '#64748B',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyBoxText: {
    fontSize: 13,
    fontFamily: APP_FONT,
    fontWeight: '500',
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
