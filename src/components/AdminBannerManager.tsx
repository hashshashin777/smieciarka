import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { isSupabaseConfigured, uploadPhotoToStorage } from '../services/supabase';
import {
  BANNER_SLOTS,
  BannerSlotId,
  CustomBannerImages,
  getCustomBannerList,
  resolveBannerImages,
} from '../constants/banners';
import { APP_FONT } from '../constants/categories';

interface AdminBannerManagerProps {
  customBanners: CustomBannerImages;
  bannerIntervalSeconds?: number;
  adsEnabled: boolean;
  onUpdateBannerImage: (slotId: BannerSlotId, uri: string | string[] | null) => void;
  onUpdateBannerInterval?: (seconds: number) => void;
  onResetAllBanners: () => void;
}

export const AdminBannerManager: React.FC<AdminBannerManagerProps> = ({
  customBanners,
  bannerIntervalSeconds = 4,
  adsEnabled,
  onUpdateBannerImage,
  onUpdateBannerInterval,
  onResetAllBanners,
}) => {
  const [urlDrafts, setUrlDrafts] = useState<Partial<Record<BannerSlotId, string>>>({});
  const [uploadingSlot, setUploadingSlot] = useState<BannerSlotId | null>(null);
  const [dragActiveSlot, setDragActiveSlot] = useState<BannerSlotId | null>(null);
  const [previewSlideIdx, setPreviewSlideIdx] = useState<Record<string, number>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Automatyczna rotacja podglądu w panelu administratora
  useEffect(() => {
    const timer = setInterval(() => {
      setPreviewSlideIdx((prev) => {
        const next: Record<string, number> = { ...prev };
        BANNER_SLOTS.forEach((slot) => {
          const list = resolveBannerImages(slot.id, customBanners);
          const current = prev[slot.id] || 0;
          next[slot.id] = (current + 1) % Math.max(1, list.length);
        });
        return next;
      });
    }, bannerIntervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [customBanners, bannerIntervalSeconds]);

  const customCount = BANNER_SLOTS.filter(
    (slot) => getCustomBannerList(slot.id, customBanners).length > 0
  ).length;

  // Przetwarzanie plików (z drag&drop lub inputu file na webie)
  const processUploadedFiles = async (slotId: BannerSlotId, files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      Alert.alert('Błędny format', 'Przeciągnij pliki graficzne (np. PNG, JPG, WEBP, GIF).');
      return;
    }

    setUploadingSlot(slotId);
    try {
      const readDataUrl = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      const newUris: string[] = [];
      for (const file of fileArray) {
        const dataUrl = await readDataUrl(file);
        if (isSupabaseConfigured) {
          const uploadRes = await uploadPhotoToStorage(dataUrl, 'banners');
          if (uploadRes.ok) {
            newUris.push(uploadRes.data);
          } else {
            newUris.push(dataUrl);
          }
        } else {
          newUris.push(dataUrl);
        }
      }

      const existing = getCustomBannerList(slotId, customBanners);
      const combined = [...existing, ...newUris];
      onUpdateBannerImage(slotId, combined);
      Alert.alert('Sukces 🖼️', `Dodano ${newUris.length} ${newUris.length === 1 ? 'obraz' : 'obrazy'} do banera.`);
    } catch {
      Alert.alert('Błąd', 'Nie udało się wczytać przeciągniętych plików.');
    } finally {
      setUploadingSlot(null);
    }
  };

  // Wybór obrazów z galerii (wsparcie wyboru wielu na raz)
  const handlePickFromGallery = async (slotId: BannerSlotId, slotLabel: string) => {
    if (uploadingSlot) return;

    // Na Webie otwieramy ukryty input file z multiple
    if (Platform.OS === 'web') {
      const input = fileInputRefs.current[slotId];
      if (input) {
        input.click();
      }
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Brak uprawnień',
          'Aplikacja potrzebuje dostępu do galerii, aby wybrać nowe obrazy banera.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingSlot(slotId);
        const newUris: string[] = [];

        for (const asset of result.assets) {
          const pickedUri = asset.uri;
          if (isSupabaseConfigured) {
            const uploadRes = await uploadPhotoToStorage(pickedUri, 'banners');
            if (uploadRes.ok) {
              newUris.push(uploadRes.data);
            } else {
              newUris.push(pickedUri);
            }
          } else {
            newUris.push(pickedUri);
          }
        }

        const existing = getCustomBannerList(slotId, customBanners);
        const combined = [...existing, ...newUris];
        onUpdateBannerImage(slotId, combined);
        Alert.alert('Baner zaktualizowany 🖼️', `Dodano obrazy do: ${slotLabel}.`);
      }
    } catch {
      Alert.alert('Błąd galerii', 'Nie udało się wybrać obrazów z galerii.');
    } finally {
      setUploadingSlot(null);
    }
  };

  // Dodawanie URL-i wpisanych ręcznie
  const handleApplyUrl = (slotId: BannerSlotId, slotLabel: string) => {
    const raw = (urlDrafts[slotId] ?? '').trim();
    if (!raw) {
      Alert.alert('Pusty adres', 'Wklej adres URL obrazu (lub wiele adresów oddzielonych przecinkami).');
      return;
    }

    const newUrls = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const existing = getCustomBannerList(slotId, customBanners);
    const combined = [...existing, ...newUrls];
    onUpdateBannerImage(slotId, combined);
    setUrlDrafts((prev) => ({ ...prev, [slotId]: '' }));
    Alert.alert('Zapisano obrazy ✅', `Zaktualizowano listę banerów dla „${slotLabel}”.`);
  };

  // Usunięcie pojedynczego slajdu z danego slotu
  const handleRemoveSingleSlide = (slotId: BannerSlotId, indexToRemove: number) => {
    const currentList = getCustomBannerList(slotId, customBanners);
    const updated = currentList.filter((_, idx) => idx !== indexToRemove);
    onUpdateBannerImage(slotId, updated.length > 0 ? updated : null);
  };

  // Przywrócenie domyślnych dla slotu
  const handleResetSlot = (slotId: BannerSlotId, slotLabel: string) => {
    onUpdateBannerImage(slotId, null);
    setUrlDrafts((prev) => ({ ...prev, [slotId]: '' }));
    Alert.alert('Przywrócono domyślny', `Baner „${slotLabel}” korzysta teraz z domyślnej grafiki.`);
  };

  return (
    <View style={styles.container}>
      {/* 1. SEKCJA SUWAKA CZASU WYŚWIETLANIA OBRAZU */}
      <View style={styles.sliderCard}>
        <View style={styles.sliderHeaderRow}>
          <View style={styles.sliderIconCircle}>
            <MaterialCommunityIcons name="timer-sand" size={20} color="#059669" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.sliderTitle}>Czas wyświetlania pojedynczego obrazu</Text>
            <Text style={styles.sliderSub}>
              Określ, co ile sekund zmienia się baner w aplikacji mobilnej i na stronie WWW.
            </Text>
          </View>
          <View style={styles.sliderBadge}>
            <Text style={styles.sliderBadgeText}>{bannerIntervalSeconds} s</Text>
          </View>
        </View>

        <View style={styles.sliderContainer}>
          <Slider
            style={styles.sliderTrack}
            minimumValue={2}
            maximumValue={15}
            step={1}
            value={bannerIntervalSeconds}
            onValueChange={(val) => {
              if (onUpdateBannerInterval) {
                onUpdateBannerInterval(val);
              }
            }}
            minimumTrackTintColor="#10B981"
            maximumTrackTintColor="#CBD5E1"
            thumbTintColor="#059669"
          />
          <View style={styles.sliderLabelsRow}>
            <Text style={styles.sliderMinMaxLabel}>2 sekundy</Text>
            <Text style={styles.sliderCurrentHint}>
              {bannerIntervalSeconds === 4 ? '4s (zalecane domyślne)' : `${bannerIntervalSeconds} sekundy`}
            </Text>
            <Text style={styles.sliderMinMaxLabel}>15 sekund</Text>
          </View>
        </View>

        {/* Szybkie przyciski wyboru */}
        <View style={styles.quickStepRow}>
          {[2, 3, 4, 5, 8, 10].map((sec) => (
            <TouchableOpacity
              key={sec}
              style={[
                styles.quickStepBtn,
                bannerIntervalSeconds === sec && styles.quickStepBtnActive,
              ]}
              onPress={() => onUpdateBannerInterval && onUpdateBannerInterval(sec)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.quickStepText,
                  bannerIntervalSeconds === sec && styles.quickStepTextActive,
                ]}
              >
                {sec}s {sec === 4 ? '★' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 2. NAGŁÓWEK LISTY SLOTÓW BANERÓW */}
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
            Banery reklamowe są obecnie wyłączone w zakładce System. Grafiki możesz skonfigurować z wyprzedzeniem.
          </Text>
        </View>
      )}

      {/* 3. KARTY POSZCZEGÓLNYCH SLOTÓW BANERÓW */}
      {BANNER_SLOTS.map((slot) => {
        const customList = getCustomBannerList(slot.id, customBanners);
        const isCustom = customList.length > 0;
        const allResolved = resolveBannerImages(slot.id, customBanners);
        const currentActiveIdx = (previewSlideIdx[slot.id] || 0) % allResolved.length;
        const isDragging = dragActiveSlot === slot.id;

        return (
          <View key={slot.id} style={styles.slotCard}>
            {/* Ukryty input dla przeglądarki */}
            {Platform.OS === 'web' && (
              <input
                type="file"
                multiple
                accept="image/*"
                ref={(el) => {
                  fileInputRefs.current[slot.id] = el;
                }}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    processUploadedFiles(slot.id, e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            )}

            <View style={styles.slotHeader}>
              <View style={styles.flexOne}>
                <Text style={styles.slotTitle}>{slot.label}</Text>
                <Text style={styles.slotSub}>{slot.locationHint}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  isCustom ? styles.badgeCustom : styles.badgeDefault,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isCustom ? styles.badgeTextCustom : styles.badgeTextDefault,
                  ]}
                >
                  {isCustom
                    ? `${customList.length} ${customList.length === 1 ? 'slajd' : 'slajdy'}`
                    : 'Domyślny'}
                </Text>
              </View>
            </View>

            {/* Podgląd na żywo karuzeli */}
            <View style={styles.previewWrapper}>
              <Image
                source={allResolved[currentActiveIdx]}
                style={styles.previewImage}
                resizeMode="cover"
              />
              {allResolved.length > 1 && (
                <View style={styles.liveRotationBadge}>
                  <MaterialCommunityIcons name="motion-play-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.liveRotationText}>
                    Slajd {currentActiveIdx + 1} / {allResolved.length} (co {bannerIntervalSeconds}s)
                  </Text>
                </View>
              )}
            </View>

            {/* STREFA PRZECIĄGNIJ I UPUŚĆ (DRAG & DROP) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActiveSlot(slot.id);
              }}
              onDragLeave={() => setDragActiveSlot(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActiveSlot(null);
                if (e.dataTransfer && e.dataTransfer.files) {
                  processUploadedFiles(slot.id, e.dataTransfer.files);
                }
              }}
              onClick={() => handlePickFromGallery(slot.id, slot.label)}
              style={
                {
                  border: isDragging ? '2px dashed #059669' : '2px dashed #CBD5E1',
                  backgroundColor: isDragging ? '#ECFDF5' : '#F8FAFC',
                  borderRadius: 14,
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  margin: '10px 0',
                  transition: 'all 0.2s ease',
                } as any
              }
            >
              <MaterialCommunityIcons
                name={isDragging ? 'tray-arrow-down' : 'cloud-upload-outline'}
                size={28}
                color={isDragging ? '#059669' : '#64748B'}
              />
              <Text
                style={[
                  styles.dragDropTitle,
                  isDragging && { color: '#059669', fontWeight: '700' },
                ]}
              >
                {isDragging
                  ? 'Upuść obrazy tutaj!'
                  : 'Przeciągnij i upuść pliki banera tutaj (lub kliknij)'}
              </Text>
              <Text style={styles.dragDropHint}>
                Możesz zaznaczyć i upuścić kilka obrazów na raz • PNG, JPG, WEBP, GIF
              </Text>
            </div>

            {/* LISTA DODANYCH MINIATUREK DLA TEGO SLOTU */}
            {customList.length > 0 && (
              <View style={styles.miniaturesSection}>
                <Text style={styles.miniaturesHeader}>
                  Własne slajdy ({customList.length}) – rotacja co {bannerIntervalSeconds}s:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniaturesScroll}>
                  {customList.map((uri, idx) => (
                    <View key={idx} style={styles.miniatureCard}>
                      <Image source={{ uri }} style={styles.miniatureImg} resizeMode="cover" />
                      <View style={styles.miniatureIndexBadge}>
                        <Text style={styles.miniatureIndexText}>#{idx + 1}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.miniatureDeleteBtn}
                        onPress={() => handleRemoveSingleSlide(slot.id, idx)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Usuń slajd numer ${idx + 1}`}
                      >
                        <MaterialCommunityIcons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* POLE DO WKLEJENIA URL-I */}
            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.urlInput}
                value={urlDrafts[slot.id] || ''}
                onChangeText={(txt) => setUrlDrafts((prev) => ({ ...prev, [slot.id]: txt }))}
                placeholder="Lub wklej linki URL (oddzielone przecinkami)..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.applyUrlBtn}
                onPress={() => handleApplyUrl(slot.id, slot.label)}
                activeOpacity={0.8}
              >
                <Text style={styles.applyUrlBtnText}>+ Dodaj</Text>
              </TouchableOpacity>
            </View>

            {/* PRZYCISKI AKCJI */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.galleryBtn}
                onPress={() => handlePickFromGallery(slot.id, slot.label)}
                activeOpacity={0.8}
                disabled={uploadingSlot === slot.id}
              >
                {uploadingSlot === slot.id ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="image-multiple-outline" size={18} color="#059669" />
                    <Text style={styles.galleryBtnText}>Wybierz pliki z dysku / galerii</Text>
                  </>
                )}
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
  container: {
    paddingBottom: 24,
  },
  // SEKCJA SUWAKA CZASU ROTACJI
  sliderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sliderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: APP_FONT,
    color: '#0F172A',
  },
  sliderSub: {
    fontSize: 12,
    fontFamily: APP_FONT,
    color: '#64748B',
    marginTop: 2,
  },
  sliderBadge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sliderBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    fontFamily: APP_FONT,
  },
  sliderContainer: {
    marginVertical: 6,
  },
  sliderTrack: {
    width: '100%',
    height: 40,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderMinMaxLabel: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#94A3B8',
  },
  sliderCurrentHint: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: APP_FONT,
    color: '#059669',
  },
  quickStepRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickStepBtn: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickStepBtnActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#059669',
  },
  quickStepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    fontFamily: APP_FONT,
  },
  quickStepTextActive: {
    color: '#059669',
    fontWeight: '800',
  },

  // LISTA SLOTÓW
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: APP_FONT,
  },
  resetAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  resetAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: APP_FONT,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    fontFamily: APP_FONT,
    flex: 1,
  },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  flexOne: {
    flex: 1,
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
    height: 84,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  liveRotationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveRotationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: APP_FONT,
  },
  dragDropTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    fontFamily: APP_FONT,
    marginTop: 6,
    textAlign: 'center',
  },
  dragDropHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: APP_FONT,
    marginTop: 2,
    textAlign: 'center',
  },
  miniaturesSection: {
    marginBottom: 10,
  },
  miniaturesHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    fontFamily: APP_FONT,
    marginBottom: 6,
  },
  miniaturesScroll: {
    flexDirection: 'row',
  },
  miniatureCard: {
    width: 80,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
    position: 'relative',
  },
  miniatureImg: {
    width: '100%',
    height: '100%',
  },
  miniatureIndexBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  miniatureIndexText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  miniatureDeleteBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
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
    color: '#0F172A',
  },
  applyUrlBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
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
