import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { isSupabaseConfigured, uploadPhotoToStorage } from '../services/supabase';
import {
  BANNER_SLOTS,
  BannerSlotId,
  CustomBannerImages,
  resolveBannerSource,
} from '../constants/banners';
import { APP_FONT } from '../constants/categories';

interface AdminBannerManagerProps {
  customBanners: CustomBannerImages;
  adsEnabled: boolean;
  onUpdateBannerImage: (slotId: BannerSlotId, uri: string | null) => void;
  onResetAllBanners: () => void;
}

export const AdminBannerManager: React.FC<AdminBannerManagerProps> = ({
  customBanners,
  adsEnabled,
  onUpdateBannerImage,
  onResetAllBanners,
}) => {
  const [urlDrafts, setUrlDrafts] = useState<Partial<Record<BannerSlotId, string>>>({});
  const [uploadingSlot, setUploadingSlot] = useState<BannerSlotId | null>(null);

  const customCount = BANNER_SLOTS.filter((slot) => Boolean(customBanners[slot.id]?.trim())).length;

  const handlePickFromGallery = async (slotId: BannerSlotId, slotLabel: string) => {
    if (uploadingSlot) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Brak uprawnień',
          'Aplikacja potrzebuje dostępu do galerii, aby wybrać nowy obraz banera.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets.length > 0) {
        const pickedUri = result.assets[0].uri;
        let finalUri = pickedUri;
        if (isSupabaseConfigured) {
          setUploadingSlot(slotId);
          const uploadRes = await uploadPhotoToStorage(pickedUri, 'banners');
          setUploadingSlot(null);
          if (!uploadRes.ok) {
            Alert.alert('Błąd wysyłania', uploadRes.error.message);
            return;
          }
          finalUri = uploadRes.data;
        }
        onUpdateBannerImage(slotId, finalUri);
        setUrlDrafts((prev) => ({ ...prev, [slotId]: finalUri }));
        Alert.alert('Baner zaktualizowany 🖼️', `Podmieniono obraz dla: ${slotLabel}.`);
      }
    } catch {
      setUploadingSlot(null);
      Alert.alert('Błąd galerii', 'Nie udało się wybrać obrazu z galerii.');
    }
  };

  const handleApplyUrl = (slotId: BannerSlotId, slotLabel: string) => {
    const raw = (urlDrafts[slotId] ?? customBanners[slotId] ?? '').trim();
    if (!raw) {
      Alert.alert('Pusty adres', 'Wklej adres URL obrazu (https://...) lub wybierz plik z galerii.');
      return;
    }
    const isValidUri =
      raw.startsWith('https://') ||
      raw.startsWith('http://') ||
      raw.startsWith('file://') ||
      raw.startsWith('data:image/') ||
      raw.startsWith('content://');
    if (!isValidUri) {
      Alert.alert(
        'Nieprawidłowy adres obrazu',
        'Podaj poprawny link zaczynający się od https:// (lub wybierz zdjęcie z galerii).'
      );
      return;
    }

    onUpdateBannerImage(slotId, raw);
    Alert.alert('Zapisano obraz ✅', `Nowy obraz dla „${slotLabel}” jest aktywny.`);
  };

  const handleResetSlot = (slotId: BannerSlotId, slotLabel: string) => {
    onUpdateBannerImage(slotId, null);
    setUrlDrafts((prev) => ({ ...prev, [slotId]: '' }));
    Alert.alert('Przywrócono domyślny', `Baner „${slotLabel}” korzysta teraz z domyślnej grafiki.`);
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Obrazy banerów reklamowych ({BANNER_SLOTS.length})</Text>
        {customCount > 0 && (
          <TouchableOpacity
            style={styles.resetAllBtn}
            onPress={() =>
              Alert.alert(
                'Przywrócić wszystkie banery?',
                'Wszystkie własne grafiki banerów zostaną przywrócone do wersji domyślnych.',
                [
                  { text: 'Anuluj', style: 'cancel' },
                  {
                    text: 'Przywróć',
                    style: 'destructive',
                    onPress: () => {
                      setUrlDrafts({});
                      onResetAllBanners();
                    },
                  },
                ]
              )
            }
            activeOpacity={0.8}
          >
            <Text style={styles.resetAllBtnText}>Przywróć wszystkie</Text>
          </TouchableOpacity>
        )}
      </View>

      {!adsEnabled && (
        <View style={styles.warningBox}>
          <MaterialCommunityIcons name="eye-off-outline" size={16} color="#B45309" />
          <Text style={styles.warningText}>
            Banery reklamowe są obecnie wyłączone w zakładce System. Możesz tu podmienić ich grafiki z wyprzedzeniem.
          </Text>
        </View>
      )}

      {BANNER_SLOTS.map((slot) => {
        const currentCustomUri = customBanners[slot.id]?.trim() || '';
        const isCustom = currentCustomUri.length > 0;
        const inputVal = urlDrafts[slot.id] ?? currentCustomUri;

        return (
          <View key={slot.id} style={styles.slotCard}>
            <View style={styles.slotHeader}>
              <View style={styles.flexOne}>
                <Text style={styles.slotTitle}>{slot.label}</Text>
                <Text style={styles.slotSub}>{slot.locationHint}</Text>
              </View>
              <View style={[styles.statusBadge, isCustom ? styles.badgeCustom : styles.badgeDefault]}>
                <Text style={[styles.statusBadgeText, isCustom ? styles.badgeTextCustom : styles.badgeTextDefault]}>
                  {isCustom ? 'Własny obraz' : 'Domyślny'}
                </Text>
              </View>
            </View>

            <View style={styles.previewWrapper}>
              <Image
                source={resolveBannerSource(slot.id, customBanners)}
                style={styles.previewImage}
                resizeMode="cover"
              />
            </View>

            <Text style={styles.metaHint} numberOfLines={1}>
              {isCustom ? `Źródło: ${currentCustomUri}` : `Domyślnie: ${slot.defaultLabel}`}
            </Text>

            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.urlInput}
                value={inputVal}
                onChangeText={(txt) => setUrlDrafts((prev) => ({ ...prev, [slot.id]: txt }))}
                placeholder="Wklej URL obrazu (https://...)"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.applyUrlBtn}
                onPress={() => handleApplyUrl(slot.id, slot.label)}
                activeOpacity={0.8}
              >
                <Text style={styles.applyUrlBtnText}>Zastosuj</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.galleryBtn}
                onPress={() => handlePickFromGallery(slot.id, slot.label)}
                disabled={uploadingSlot === slot.id}
                activeOpacity={0.85}
              >
                {uploadingSlot === slot.id ? (
                  <ActivityIndicator size="small" color="#047857" />
                ) : (
                  <MaterialCommunityIcons name="image-plus" size={16} color="#047857" />
                )}
                <Text style={styles.galleryBtnText}>
                  {uploadingSlot === slot.id ? 'Wysyłanie...' : 'Wybierz z galerii'}
                </Text>
              </TouchableOpacity>

              {isCustom && (
                <TouchableOpacity
                  style={styles.resetSlotBtn}
                  onPress={() => handleResetSlot(slot.id, slot.label)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="restore" size={16} color="#64748B" />
                  <Text style={styles.resetSlotBtnText}>Domyślny</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resetAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resetAllBtnText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#DC2626',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '500',
    color: '#92400E',
    lineHeight: 16,
  },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  slotTitle: {
    fontSize: 15,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
  },
  slotSub: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeCustom: {
    backgroundColor: '#ECFDF5',
  },
  badgeDefault: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '700',
  },
  badgeTextCustom: {
    color: '#059669',
  },
  badgeTextDefault: {
    color: '#64748B',
  },
  previewWrapper: {
    width: '100%',
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  metaHint: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#64748B',
    marginBottom: 8,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '400',
    color: '#0F172A',
  },
  applyUrlBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  applyUrlBtnText: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  galleryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 9,
  },
  galleryBtnText: {
    fontSize: 13,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#047857',
  },
  resetSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  resetSlotBtnText: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
  },
});
