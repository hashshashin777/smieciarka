import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BoardPost, BoardTag } from '../types';
import { BOARD_TAGS } from '../constants/boardTags';
import { THEME } from '../constants/categories';

interface AddBoardPostModalProps {
  visible: boolean;
  onClose: () => void;
  onAddPost: (newPost: BoardPost) => void;
}

export const AddBoardPostModal: React.FC<AddBoardPostModalProps> = ({
  visible,
  onClose,
  onAddPost,
}) => {
  const [tag, setTag] = useState<BoardTag>('szukam');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [locationArea, setLocationArea] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  const resetForm = () => {
    setTag('szukam');
    setTitle('');
    setContent('');
    setAuthorName('');
    setLocationArea('');
    setContactInfo('');
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Brak tytułu', 'Podaj krótki tytuł ogłoszenia.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Brak treści', 'Wpisz treść swojego ogłoszenia.');
      return;
    }

    const newPost: BoardPost = {
      id: `board-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      tag,
      authorName: authorName.trim() || 'Sąsiad',
      locationArea: locationArea.trim() || 'Lokalnie',
      contactInfo: contactInfo.trim() || undefined,
      createdAt: new Date().toISOString(),
      likesCount: 1,
    };

    onAddPost(newPost);
    resetForm();
    onClose();
    Alert.alert('Opublikowano! 📌', 'Twoje ogłoszenie pojawiło się na tablicy społeczności.');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Anuluj</Text>
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Nowy wpis na tablicy</Text>
            <TouchableOpacity onPress={handleSubmit} style={styles.publishBtn}>
              <Text style={styles.publishBtnText}>Dodaj</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Tag selector */}
            <Text style={styles.label}>Typ ogłoszenia *</Text>
            <View style={styles.tagsGrid}>
              {BOARD_TAGS.map((t) => {
                const isSelected = tag === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.tagChip,
                      isSelected && { backgroundColor: t.bgColor, borderColor: t.color },
                    ]}
                    onPress={() => setTag(t.id)}
                  >
                    <MaterialCommunityIcons
                      name={t.icon as any}
                      size={15}
                      color={isSelected ? t.color : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.tagChipText,
                        isSelected && { color: t.color, fontWeight: '700' },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Title */}
            <Text style={styles.label}>Tytuł ogłoszenia *</Text>
            <TextInput
              style={styles.input}
              placeholder="np. Szukam transportu pralki, Oddam 20 słoików..."
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />

            {/* Content */}
            <Text style={styles.label}>Treść ogłoszenia *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Opisz dokładnie, czego potrzebujesz, co masz do oddania lub w czym możesz pomóc sąsiadom..."
              placeholderTextColor="#94A3B8"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={4}
            />

            {/* Author Name */}
            <Text style={styles.label}>Twoje imię / Nick</Text>
            <TextInput
              style={styles.input}
              placeholder="np. Kasia, Marek (Mokotów)"
              placeholderTextColor="#94A3B8"
              value={authorName}
              onChangeText={setAuthorName}
              maxLength={40}
            />

            {/* District / City Area */}
            <Text style={styles.label}>Dzielnica / Miasto</Text>
            <TextInput
              style={styles.input}
              placeholder="np. Warszawa, Mokotów (okolice Pola Mokotowskiego)"
              placeholderTextColor="#94A3B8"
              value={locationArea}
              onChangeText={setLocationArea}
            />

            {/* Contact Info */}
            <Text style={styles.label}>Kontakt (widoczny w ogłoszeniu)</Text>
            <TextInput
              style={styles.input}
              placeholder="np. Pisz na priv, SMS: 600-XXX-XXX"
              placeholderTextColor="#94A3B8"
              value={contactInfo}
              onChangeText={setContactInfo}
            />
          </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.text,
  },
  publishBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  publishBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 8,
    marginTop: 14,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
});
