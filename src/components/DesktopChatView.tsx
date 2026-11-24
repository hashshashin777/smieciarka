import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PostItem, UserProfile, ItemMessage } from '../types';
import { AuthService } from '../services/authService';
import { ChatRepository } from '../services/chatRepository';
import { APP_FONT } from '../constants/categories';
import { formatRelativeTime } from '../utils/helpers';

interface DesktopChatViewProps {
  items: PostItem[];
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenDetail: (item: PostItem) => void;
  initialItemId?: string;
}

const GUEST_PROFILE: UserProfile = {
  id: 'guest-user',
  name: 'Sąsiad',
  email: '',
  provider: 'email',
  createdAt: new Date().toISOString(),
};

const QUICK_PROMPTS = [
  'Cześć! Czy to ogłoszenie jest jeszcze aktualne? 👀',
  'W jakich godzinach możliwy jest odbiór? 🕒',
  'Mogę podjechać dzisiaj po południu! 🚗',
  'Czy potrzebna jest pomoc w zniesieniu przedmiotu? 📦',
];

export const DesktopChatView: React.FC<DesktopChatViewProps> = ({
  items,
  currentUser,
  onOpenAuth,
  onOpenDetail,
  initialItemId,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    if (initialItemId && items.some((i) => i.id === initialItemId)) {
      return initialItemId;
    }
    return items[0]?.id || '';
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [messages, setMessages] = useState<ItemMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<any>(null);

  const activeItem = items.find((i) => i.id === selectedItemId) || items[0] || null;

  useEffect(() => {
    let isMounted = true;
    if (activeItem) {
      Promise.resolve().then(async () => {
        if (!isMounted) return;
        setIsLoadingMessages(true);
        try {
          const res = await ChatRepository.fetchMessages(activeItem.id, activeItem.title);
          if (isMounted && res.ok) {
            setMessages(res.data);
          }
        } finally {
          if (isMounted) {
            setIsLoadingMessages(false);
          }
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [activeItem]);

  // Cykliczne odświeżanie wątku co 10 sekund
  useEffect(() => {
    if (!activeItem) return;
    const interval = setInterval(() => {
      ChatRepository.fetchMessages(activeItem.id, activeItem.title).then((res) => {
        if (res.ok) {
          setMessages(res.data);
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [activeItem]);

  const handleSendMessage = async (textToSend?: string) => {
    const raw = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!raw || !activeItem) return;

    const senderProfile = currentUser || GUEST_PROFILE;
    setIsSending(true);

    try {
      const newMsg = await AuthService.sendItemMessage(
        activeItem.id,
        activeItem.title,
        raw,
        senderProfile
      );
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch {
      Alert.alert('Błąd wysyłania', 'Nie udało się przesłać wiadomości. Spróbuj ponownie.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      (item.authorName || '').toLowerCase().includes(term) ||
      (item.location.address || '').toLowerCase().includes(term)
    );
  });

  return (
    <View style={styles.container}>
      {/* NAGŁÓWEK MODUŁU */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="chat-processing-outline" size={26} color="#059669" />
          <View>
            <Text style={styles.headerTitle}>Wiadomości i Czat Sąsiedzki</Text>
            <Text style={styles.headerSubtitle}>
              Rozmawiaj bezpośrednio z autorami ogłoszeń i ustalaj szczegóły odbioru.
            </Text>
          </View>
        </View>

        {!currentUser && (
          <TouchableOpacity
            style={styles.loginBannerBtn}
            onPress={onOpenAuth}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Zaloguj się, aby zsynchronizować rozmowy"
          >
            <MaterialCommunityIcons name="account-arrow-right-outline" size={16} color="#047857" />
            <Text style={styles.loginBannerBtnText}>Zaloguj się, aby zapisać historię</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chatPanes}>
        {/* LEWY PANEL: LISTA ROZMÓW / OGŁOSZEŃ */}
        <View style={styles.leftPane}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Szukaj ogłoszenia lub osoby..."
              placeholderTextColor="#94A3B8"
              value={searchFilter}
              onChangeText={setSearchFilter}
            />
            {searchFilter.length > 0 && (
              <TouchableOpacity onPress={() => setSearchFilter('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.listSectionTitle}>
            Wybierz ogłoszenie ({filteredItems.length}):
          </Text>

          <ScrollView style={styles.itemsScrollList} showsVerticalScrollIndicator={true}>
            {filteredItems.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Text style={styles.emptyItemsText}>Nie znaleziono ogłoszeń.</Text>
              </View>
            ) : (
              filteredItems.map((item) => {
                const isSelected = activeItem?.id === item.id;
                const isOddam = item.type === 'oddam';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.threadItem, isSelected && styles.threadItemActive]}
                    onPress={() => setSelectedItemId(item.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Wątek: ${item.title}`}
                  >
                    <Image
                      source={{ uri: item.photos?.[0] || 'https://via.placeholder.com/80' }}
                      style={styles.threadThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.threadContent}>
                      <View style={styles.threadTopRow}>
                        <View
                          style={[
                            styles.threadTypeBadge,
                            isOddam ? styles.badgeOddam : styles.badgeWystawka,
                          ]}
                        >
                          <Text style={styles.threadTypeBadgeText}>
                            {isOddam ? 'ODDAM' : 'WYSTAWKA'}
                          </Text>
                        </View>
                        <Text style={styles.threadTime}>
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.threadTitle, isSelected && styles.threadTitleActive]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.threadAuthor} numberOfLines={1}>
                        👤 {item.authorName || 'Autor nieznany'} • {item.location.address || 'Lokalizacja'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* PRAWY PANEL: WĄTEK I ODPOWIADANIE */}
        <View style={styles.rightPane}>
          {activeItem ? (
            <View style={styles.activeChatContainer}>
              {/* NAGŁÓWEK AKTYWNEJ ROZMOWY */}
              <View style={styles.activeChatHeader}>
                <Image
                  source={{ uri: activeItem.photos?.[0] || 'https://via.placeholder.com/100' }}
                  style={styles.activeHeaderThumb}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.activeHeaderTitle} numberOfLines={1}>
                    {activeItem.title}
                  </Text>
                  <Text style={styles.activeHeaderSub} numberOfLines={1}>
                    Autor: <Text style={{ fontWeight: '700' }}>{activeItem.authorName || 'Sąsiad'}</Text> •{' '}
                    {activeItem.location.address || 'Lokalizacja'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.openDetailBtn}
                  onPress={() => onOpenDetail(activeItem)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Zobacz pełne ogłoszenie"
                >
                  <MaterialCommunityIcons name="open-in-new" size={16} color="#059669" />
                  <Text style={styles.openDetailBtnText}>Szczegóły</Text>
                </TouchableOpacity>
              </View>

              {/* LISTA WIADOMOŚCI */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesScrollArea}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={true}
              >
                {isLoadingMessages ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={styles.loadingText}>Ładowanie wiadomości...</Text>
                  </View>
                ) : messages.length === 0 ? (
                  <View style={styles.emptyMessagesBox}>
                    <MaterialCommunityIcons name="forum-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyMessagesTitle}>Brak wiadomości w tym wątku</Text>
                    <Text style={styles.emptyMessagesDesc}>
                      Napisz pierwszą wiadomość do autora ogłoszenia, aby dopytać o dostępność lub umówić odbiór.
                    </Text>
                  </View>
                ) : (
                  messages.map((msg) => {
                    const isMy =
                      msg.isMyMessage ||
                      (currentUser && msg.senderId === currentUser.id) ||
                      msg.senderName === (currentUser?.name || 'Ty');
                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.messageBubbleWrapper,
                          isMy ? styles.myBubbleWrapper : styles.theirBubbleWrapper,
                        ]}
                      >
                        {!isMy && (
                          <View style={styles.senderAvatar}>
                            <Text style={styles.senderAvatarText}>
                              {(msg.senderName || 'S').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={[styles.bubble, isMy ? styles.myBubble : styles.theirBubble]}>
                          <View style={styles.bubbleHeader}>
                            <Text style={[styles.bubbleSender, isMy && styles.myBubbleSender]}>
                              {isMy ? 'Ty' : msg.senderName || 'Sąsiad'}
                            </Text>
                            <Text style={[styles.bubbleTime, isMy && styles.myBubbleTime]}>
                              {formatRelativeTime(msg.createdAt)}
                            </Text>
                          </View>
                          <Text style={[styles.bubbleText, isMy && styles.myBubbleText]}>
                            {msg.text}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* SZYBKIE PODPOWIEDZI */}
              <View style={styles.quickPromptsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.promptChip}
                      onPress={() => handleSendMessage(prompt)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.promptChipText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* POLE WPISYWANIA I WYSYŁANIA */}
              <View style={styles.inputArea}>
                <TextInput
                  style={styles.messageInput}
                  placeholder={`Napisz wiadomość do: ${activeItem.authorName || 'autora'}...`}
                  placeholderTextColor="#94A3B8"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  onSubmitEditing={() => handleSendMessage()}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    (!inputText.trim() || isSending) && styles.sendBtnDisabled,
                  ]}
                  onPress={() => handleSendMessage()}
                  disabled={!inputText.trim() || isSending}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Wyślij wiadomość"
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                      <Text style={styles.sendBtnText}>Wyślij</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noChatSelected}>
              <MaterialCommunityIcons name="chat-question-outline" size={64} color="#94A3B8" />
              <Text style={styles.noChatTitle}>Wybierz ogłoszenie, aby rozpocząć rozmowę</Text>
              <Text style={styles.noChatDesc}>
                Kliknij na dowolną pozycję z listy po lewej stronie, aby odczytać wiadomości lub zadać pytanie.
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    minHeight: 650,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontFamily: APP_FONT,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  loginBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  loginBannerBtnText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  chatPanes: {
    flexDirection: 'row',
    flex: 1,
    height: 600,
  },
  leftPane: {
    width: 340,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  listSectionTitle: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  itemsScrollList: {
    flex: 1,
  },
  emptyItemsBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyItemsText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#94A3B8',
  },
  threadItem: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  threadItemActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
    borderWidth: 1.5,
  },
  threadThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  threadContent: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  threadTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  threadTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeOddam: {
    backgroundColor: '#059669',
  },
  badgeWystawka: {
    backgroundColor: '#D97706',
  },
  threadTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  threadTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  threadTitle: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  threadTitleActive: {
    color: '#065F46',
  },
  threadAuthor: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#64748B',
  },
  rightPane: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  activeChatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  activeChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  activeHeaderThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  activeHeaderTitle: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeHeaderSub: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  openDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  openDetailBtnText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  messagesScrollArea: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  messagesContent: {
    paddingBottom: 20,
  },
  loadingBox: {
    alignItems: 'center',
    padding: 30,
    gap: 8,
  },
  loadingText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#64748B',
  },
  emptyMessagesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  emptyMessagesTitle: {
    fontFamily: APP_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  emptyMessagesDesc: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 18,
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
    gap: 8,
  },
  myBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  theirBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  myBubble: {
    backgroundColor: '#059669',
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 2,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  bubbleSender: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  myBubbleSender: {
    color: '#A7F3D0',
  },
  bubbleTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  myBubbleTime: {
    color: '#D1FAE5',
  },
  bubbleText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
  },
  myBubbleText: {
    color: '#FFFFFF',
  },
  quickPromptsRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  promptChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  promptChipText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: APP_FONT,
    maxHeight: 100,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  sendBtnText: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noChatSelected: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  noChatTitle: {
    fontFamily: APP_FONT,
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
  },
  noChatDesc: {
    fontFamily: APP_FONT,
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 400,
  },
});
