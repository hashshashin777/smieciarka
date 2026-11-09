import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PostItem, UserProfile } from '../types';
import { THEME, CATEGORIES, APP_FONT } from '../constants/categories';
import { calculateDistance, formatRelativeTime, openNavigation } from '../utils/helpers';

interface ItemDetailModalProps {
  item: PostItem | null;
  visible: boolean;
  onClose: () => void;
  userCoords?: { latitude: number; longitude: number } | null;
  onVoteStillThere: (itemId: string) => void;
  onVoteTaken: (itemId: string) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  currentUser?: UserProfile | null;
  onOpenChat?: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  visible,
  onClose,
  userCoords,
  onVoteStillThere,
  onVoteTaken,
  isSaved = false,
  onToggleSave,
  currentUser,
  onOpenChat,
}) => {
  if (!item) return null;

  const categoryMeta = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];
  const isWystawka = item.type === 'wystawka';
  const distance = userCoords
    ? calculateDistance(userCoords.latitude, userCoords.longitude, item.location.latitude, item.location.longitude)
    : null;

  const handleNavigate = () => {
    openNavigation(
      item.location.latitude,
      item.location.longitude,
      `Śmieciarka: ${item.title}`
    );
  };

  const handleStillThere = () => {
    onVoteStillThere(item.id);
    Alert.alert('Dziękujemy!', 'Potwierdzono, że wystawka wciąż jest dostępna.');
  };

  const handleTaken = () => {
    Alert.alert(
      'Potwierdź zabranie',
      'Czy na pewno przedmiot został już zabrany?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Tak, zabrane',
          style: 'destructive',
          onPress: () => {
            onVoteTaken(item.id);
            onClose();
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: `Śmieciarka: ${item.title}`,
        message: `Sprawdź to znalezisko na Śmieciarce: „${item.title}” w okolicy ${item.location.address || 'mapy'}! 🚛💚\n\nRatuj rzeczy przed śmietnikiem: https://smieciarka.fun/item/${item.id}`,
      });
    } catch (e) {}
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top bar with close, share, and save buttons */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Zamknij"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="close" size={24} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Szczegóły ogłoszenia</Text>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.actionIconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Udostępnij znalezisko"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="share-variant-outline" size={22} color={THEME.text} />
            </TouchableOpacity>
            {onToggleSave && (
              <TouchableOpacity
                onPress={onToggleSave}
                style={[styles.actionIconBtn, { marginLeft: 8 }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={isSaved ? 'Usuń z zapisanych' : 'Zapisz'}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons
                  name={isSaved ? 'star' : 'star-outline'}
                  size={22}
                  color={isSaved ? THEME.starYellow : THEME.text}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Main Photo */}
          <View style={styles.imageWrapper}>
            {item.photos && item.photos.length > 0 ? (
              <Image source={{ uri: item.photos[0] }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={styles.placeholderWrapper}>
                <MaterialCommunityIcons name="image-off-outline" size={48} color="#94A3B8" />
              </View>
            )}

            {/* Badges on image */}
            <View style={[styles.typeBadge, isWystawka ? styles.wystawkaBadge : styles.oddamBadge]}>
              <MaterialCommunityIcons 
                name={isWystawka ? 'dump-truck' : 'gift-outline'} 
                size={14} 
                color="#FFFFFF" 
              />
              <Text style={styles.typeBadgeText}>
                {isWystawka ? 'WYSTAWKA ULICZNA' : 'ODDAM ZA DARMO'}
              </Text>
            </View>
          </View>

          {/* Details body */}
          <View style={styles.body}>
            {/* Header info */}
            <View style={styles.categoryRow}>
              <View style={[styles.categoryTag, { backgroundColor: `${categoryMeta.color}15` }]}>
                <Text style={[styles.categoryText, { color: categoryMeta.color }]}>
                  {categoryMeta.label}
                </Text>
              </View>
              <Text style={styles.relativeTime}>{formatRelativeTime(item.createdAt)}</Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>

            {/* Distance & Location bar */}
            <View style={styles.locationCard}>
              <MaterialCommunityIcons 
                name={isWystawka ? 'map-marker-radius' : 'shield-account-outline'} 
                size={22} 
                color={isWystawka ? THEME.wystawka : THEME.oddam} 
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>
                  {item.location.address || 'Dokładna pozycja GPS na mapie'}
                </Text>
                <Text style={styles.locationSub}>
                  {distance ? `${distance.formatted} • ` : ''}
                  {isWystawka ? 'Dokładny punkt na chodniku' : 'Przybliżony obszar (ochrona prywatności)'}
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.sectionHeader}>Opis i stan</Text>
            <Text style={styles.descriptionText}>{item.description}</Text>

            {/* Author info */}
            {item.authorName && (
              <View style={styles.authorCard}>
                <MaterialCommunityIcons name="account-circle-outline" size={20} color={THEME.textMuted} />
                <Text style={styles.authorText}>Wystawione przez: <Text style={{ fontWeight: '700' }}>{item.authorName}</Text></Text>
              </View>
            )}

            {/* Community status for Wystawka */}
            {isWystawka && (
              <View style={styles.wystawkaStatusBox}>
                <View style={styles.statusBoxHeader}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={THEME.wystawka} />
                  <Text style={styles.statusBoxTitle}>
                    {(() => {
                      const expiry = item.expiresAt
                        ? new Date(item.expiresAt).getTime()
                        : new Date(item.createdAt).getTime() + 6 * 60 * 60 * 1000;
                      const diffMins = Math.max(0, Math.floor((expiry - Date.now()) / (60 * 1000)));
                      const h = Math.floor(diffMins / 60);
                      const m = diffMins % 60;
                      return `Ważność wystawki: ok. ${h}h ${m}min`;
                    })()}
                  </Text>
                </View>
                <Text style={styles.statusBoxDesc}>
                  Wystawki uliczne są aktywne przez 6 godzin. Potwierdź obecność, aby przedłużyć widoczność o kolejne 2 godziny!
                </Text>
                <View style={styles.voteRow}>
                  <TouchableOpacity style={styles.voteBtnGreen} onPress={handleStillThere}>
                    <MaterialCommunityIcons name="thumb-up-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.voteBtnText}>Jeszcze stoi ({item.stillThereVotes})</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.voteBtnGray} onPress={handleTaken}>
                    <MaterialCommunityIcons name="check" size={18} color="#DC2626" />
                    <Text style={[styles.voteBtnText, { color: '#DC2626' }]}>
                      {item.takenVotes === 1 ? 'Potwierdź brak (1/2)' : 'Już zabrane'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {item.takenVotes === 1 && (
                  <View style={styles.takenWarningBox}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#D97706" />
                    <Text style={styles.takenWarningText}>
                      Jeden użytkownik zgłosił, że przedmiot mógł zostać już zabrany (1/2 potwierdzeń). Jeśli wciąż stoi, kliknij „Jeszcze stoi”!
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Przycisk czatu / wiadomości o wystawce (Konta służą do wiadomości) */}
            <TouchableOpacity
              style={styles.chatActionBtn}
              onPress={onOpenChat}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Napisz wiadomość na temat tej wystawki"
            >
              <View style={styles.chatActionIconBox}>
                <MaterialCommunityIcons name="chat-processing" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatActionTitle}>
                  {item.type === 'wystawka' ? 'Zapytaj o wystawkę / Napisz' : 'Napisz wiadomość do oddającego'}
                </Text>
                <Text style={styles.chatActionSub}>
                  {currentUser ? `Czat aktywny jako: ${currentUser.name}` : 'Wymaga konta (Apple, Google, Facebook)'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#059669" />
            </TouchableOpacity>

            {/* Action buttons (Nawiguj + Udostępnij) */}
            <View style={styles.actionContainer}>
              <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate} activeOpacity={0.85}>
                <MaterialCommunityIcons name="navigation-variant" size={20} color="#FFFFFF" />
                <Text style={styles.navigateBtnText}>Nawiguj do celu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareRowBtn} onPress={handleShare} activeOpacity={0.85}>
                <MaterialCommunityIcons name="share-variant-outline" size={18} color={THEME.primary} />
                <Text style={styles.shareRowBtnText}>Udostępnij</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageWrapper: {
    height: 280,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholderWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  wystawkaBadge: {
    backgroundColor: THEME.wystawka,
  },
  oddamBadge: {
    backgroundColor: THEME.oddam,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  body: {
    padding: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryTag: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  relativeTime: {
    fontSize: 13,
    color: THEME.textMuted,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 16,
    lineHeight: 28,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  locationSub: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 16,
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  authorText: {
    fontSize: 13,
    color: THEME.textMuted,
  },
  wystawkaStatusBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  statusBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusBoxTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B45309',
  },
  statusBoxDesc: {
    fontSize: 13,
    color: '#7C2D12',
    lineHeight: 18,
    marginBottom: 14,
  },
  voteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  voteBtnGreen: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  voteBtnGray: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 10,
  },
  takenWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  takenWarningText: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 16,
  },
  voteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    gap: 12,
  },
  chatActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatActionTitle: {
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#065F46',
  },
  chatActionSub: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  actionContainer: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  navigateBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  shareRowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareRowBtnText: {
    color: THEME.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
