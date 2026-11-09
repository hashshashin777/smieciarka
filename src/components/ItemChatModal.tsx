import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, APP_FONT } from '../constants/categories';
import { PostItem, UserProfile, ItemMessage } from '../types';
import { AuthService } from '../services/authService';

interface ItemChatModalProps {
  visible: boolean;
  onClose: () => void;
  item: PostItem | null;
  currentUser: UserProfile | null;
  onOpenLogin: () => void;
}

const QUICK_SUGGESTIONS = [
  'Cześć! Czy to jeszcze stoi? 👀',
  'W którym dokładnie miejscu to leży? 📍',
  'Będę za 15 minut odebrać! 🏃‍♂️',
  'Czy potrzebna jest pomoc przy zniesieniu? 📦',
];

export const ItemChatModal: React.FC<ItemChatModalProps> = ({
  visible,
  onClose,
  item,
  currentUser,
  onOpenLogin,
}) => {
  const [messages, setMessages] = useState<ItemMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (visible && item) {
      AuthService.getItemMessages(item.id).then((msgs) => setMessages(msgs));
    }
  }, [visible, item]);

  if (!item) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (!currentUser) {
      Alert.alert(
        'Wymagane logowanie 💬',
        'Aby wysyłać wiadomości do znalazców i sąsiadów, zaloguj się przez Apple, Google lub Facebook.',
        [
          { text: 'Zaloguj się', onPress: () => { onClose(); onOpenLogin(); } },
          { text: 'Anuluj', style: 'cancel' },
        ]
      );
      return;
    }

    setIsSending(true);
    try {
      const newMsg = await AuthService.sendItemMessage(item.id, item.title, text, currentUser);
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
    } catch {
      Alert.alert('Błąd', 'Nie udało się wysłać wiadomości.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
            </TouchableOpacity>

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                Rozmowa z: <Text style={{ fontWeight: '700', color: THEME.primaryDark }}>{item.authorName || 'Znalazca'}</Text>
              </Text>
            </View>

            <View style={styles.badgeType}>
              <MaterialCommunityIcons
                name={item.type === 'wystawka' ? 'dump-truck' : 'gift'}
                size={14}
                color="#FFFFFF"
              />
            </View>
          </View>

          {/* Messages list */}
          <FlatList
            data={messages}
            keyExtractor={(msg) => msg.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <MaterialCommunityIcons name="chat-outline" size={44} color="#94A3B8" />
                <Text style={styles.emptyTitle}>Brak wcześniejszych wiadomości</Text>
                <Text style={styles.emptySub}>
                  Napisz do wystawiającego lub wybierz szybkie pytanie poniżej!
                </Text>
              </View>
            }
            renderItem={({ item: msg }) => {
              const isMine = msg.isMyMessage || msg.senderId === currentUser?.id;
              return (
                <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
                  <View style={[styles.msgBubble, isMine ? styles.msgBubbleRight : styles.msgBubbleLeft]}>
                    <Text style={[styles.msgSender, isMine && styles.msgSenderRight]}>
                      {isMine ? 'Ty' : msg.senderName}
                    </Text>
                    <Text style={[styles.msgText, isMine && styles.msgTextRight]}>
                      {msg.text}
                    </Text>
                    <Text style={[styles.msgTime, isMine && styles.msgTimeRight]}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Quick suggestions pills */}
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Szybkie pytania:</Text>
            <View style={styles.suggestionsRow}>
              {QUICK_SUGGESTIONS.map((suggestion, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionPill}
                  onPress={() => handleSendMessage(suggestion)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder={currentUser ? 'Napisz wiadomość o wystawce...' : 'Zaloguj się, aby napisać wiadomość...'}
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              returnKeyType="send"
              onSubmitEditing={() => handleSendMessage()}
              editable={!isSending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isSending}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badgeType: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptySub: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  msgRowRight: {
    justifyContent: 'flex-end',
  },
  msgRowLeft: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  msgBubbleRight: {
    backgroundColor: '#059669',
    borderBottomRightRadius: 4,
  },
  msgBubbleLeft: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
  },
  msgSender: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 3,
  },
  msgSenderRight: {
    color: '#A7F3D0',
  },
  msgText: {
    fontFamily: APP_FONT,
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 19,
  },
  msgTextRight: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  msgTime: {
    fontFamily: APP_FONT,
    fontSize: 10,
    color: '#94A3B8',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  msgTimeRight: {
    color: '#D1FAE5',
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  suggestionsTitle: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#F1F5F9',
    borderRadius: 21,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: APP_FONT,
    color: '#0F172A',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
});
