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
  Modal,
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

interface BannerScheduleConfig {
  status: 'published' | 'draft';
  startDate?: string;
  endDate?: string;
}

interface BannerVersionSnapshot {
  timestamp: string;
  snapshot: CustomBannerImages;
  description: string;
}

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

  // ADM-11: Harmonogram i status (Draft vs Published, Start / End Date)
  const [schedules, setSchedules] = useState<Record<BannerSlotId, BannerScheduleConfig>>({
    home: { status: 'published' },
    web: { status: 'published' },
    map: { status: 'published' },
    list: { status: 'published' },
    board: { status: 'published' },
    saved: { status: 'published' },
  });

  // ADM-11: Historia wersji i rollback
  const [versionHistory, setVersionHistory] = useState<BannerVersionSnapshot[]>([]);

  // ADM-11: Podgląd na żywo dla urządzeń (Mobile 390px vs Web 1240px)
  const [previewSlotId, setPreviewSlotId] = useState<BannerSlotId | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'web'>('mobile');

  const pushHistorySnapshot = (desc: string) => {
    setVersionHistory((prev) => [
      {
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        snapshot: JSON.parse(JSON.stringify(customBanners)),
        description: desc,
      },
      ...prev.slice(0, 4), // Trzymaj do 5 ostatnich wersji
    ]);
  };

  const handleRollback = () => {
    if (versionHistory.length === 0) return;
    const lastVersion = versionHistory[0];

    Alert.alert(
      'Cofnąć zmiany (Rollback)?',
      `Przywrócisz stan banerów z godziny ${lastVersion.timestamp} (${lastVersion.description}).`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Przywróć wersję',
          onPress: () => {
            const restored = lastVersion.snapshot;
            // Zastosuj każdy slot
            BANNER_SLOTS.forEach((slot) => {
              onUpdateBannerImage(slot.id, restored[slot.id] || null);
            });
            setVersionHistory((prev) => prev.slice(1));
            Alert.alert('Przywrócono wersję ⏪', 'Stan banerów został cofnięty do poprzedniej wersji.');
          },
        },
      ]
    );
  };

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

  // Przetwarzanie plików (z drag&drop lub inputu file na webie) z kompresją canvas
  const processUploadedFiles = async (slotId: BannerSlotId, files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      Alert.alert('Błędny format', 'Wybierz lub przeciągnij pliki graficzne (np. PNG, JPG, WEBP, GIF).');
      return;
    }

    setUploadingSlot(slotId);
    try {
      const compressFileToWebDataUrl = (file: File): Promise<string> =>
        new Promise((resolve) => {
          if (file.type === 'image/gif') {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            const rawUrl = e.target?.result as string;
            if (typeof window === 'undefined') {
              resolve(rawUrl);
              return;
            }
            const img = new (window as any).Image();
            img.onload = () => {
              const maxW = 1400;
              const maxH = 900;
              let { width, height } = img;
              if (width > maxW || height > maxH) {
                const ratio = Math.min(maxW / width, maxH / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
              }
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', 0.85);
                resolve(compressed);
              } else {
                resolve(rawUrl);
              }
            };
            img.onerror = () => resolve(rawUrl);
            img.src = rawUrl;
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });

      const newUris: string[] = [];
      for (const f of fileArray) {
        if (Platform.OS === 'web') {
          const dataUrl = await compressFileToWebDataUrl(f);
          if (dataUrl) newUris.push(dataUrl);
        } else {
          newUris.push((f as any).uri || '');
        }
      }

      if (newUris.length === 0) {
        Alert.alert('Błąd', 'Nie udało się przetworzyć wybranych plików graficznych.');
        return;
      }

      pushHistorySnapshot(`Dodano ${newUris.length} obrazów do ${slotId}`);
      const existing = getCustomBannerList(slotId, customBanners);
      const combined = [...existing, ...newUris];
      onUpdateBannerImage(slotId, combined);
      Alert.alert('Sukces 🖼️', `Dodano ${newUris.length} ${newUris.length === 1 ? 'obraz' : 'obrazy'} do banera.`);
    } catch {
      Alert.alert('Błąd', 'Wystąpił problem podczas wczytywania plików.');
    } finally {
      setUploadingSlot(null);
    }
  };

  // Wybór obrazów z galerii
  const handlePickFromGallery = async (slotId: BannerSlotId, slotLabel: string) => {
    if (uploadingSlot) return;

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

        pushHistorySnapshot(`Wybór z galerii dla ${slotLabel}`);
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

    pushHistorySnapshot(`Dodano URL dla ${slotLabel}`);
    const existing = getCustomBannerList(slotId, customBanners);
    const combined = [...existing, ...newUrls];
    onUpdateBannerImage(slotId, combined);
    setUrlDrafts((prev) => ({ ...prev, [slotId]: '' }));
    Alert.alert('Zapisano obrazy ✅', `Zaktualizowano listę banerów dla „${slotLabel}”.`);
  };

  // Usunięcie pojedynczego slajdu
  const handleRemoveSingleSlide = (slotId: BannerSlotId, indexToRemove: number) => {
    pushHistorySnapshot(`Usunięto slajd #${indexToRemove + 1} z ${slotId}`);
    const currentList = getCustomBannerList(slotId, customBanners);
    const updated = currentList.filter((_, idx) => idx !== indexToRemove);
    onUpdateBannerImage(slotId, updated.length > 0 ? updated : null);
  };

  // Przywrócenie domyślnych dla slotu
  const handleResetSlot = (slotId: BannerSlotId, slotLabel: string) => {
    pushHistorySnapshot(`Reset slotu ${slotLabel}`);
    onUpdateBannerImage(slotId, null);
    setUrlDrafts((prev) => ({ ...prev, [slotId]: '' }));
    Alert.alert('Przywrócono domyślny', `Baner „${slotLabel}” korzysta teraz z domyślnej grafiki.`);
  };

  const toggleScheduleStatus = (slotId: BannerSlotId) => {
    setSchedules((prev) => {
      const curr = prev[slotId] || { status: 'published' };
      const nextStatus = curr.status === 'published' ? 'draft' : 'published';
      return {
        ...prev,
        [slotId]: { ...curr, status: nextStatus },
      };
    });
  };

  const updateScheduleDate = (slotId: BannerSlotId, field: 'startDate' | 'endDate', val: string) => {
    setSchedules((prev) => {
      const curr = prev[slotId] || { status: 'published' };
      return {
        ...prev,
        [slotId]: { ...curr, [field]: val },
      };
    });
  };

  return (
    <View style={styles.container}>
      {/* Pasek cofania wersji (Rollback) jeśli istnieje historia (ADM-11) */}
      {versionHistory.length > 0 && (
        <View style={styles.rollbackBar}>
          <View style={styles.flexOne}>
            <Text style={styles.rollbackTitle}>Historia zmian banerów dostępna ({versionHistory.length})</Text>
            <Text style={styles.rollbackSub}>
              Ostatnia wersja: {versionHistory[0].timestamp} ({versionHistory[0].description})
            </Text>
          </View>
          <TouchableOpacity style={styles.rollbackBtn} onPress={handleRollback} activeOpacity={0.8}>
            <MaterialCommunityIcons name="undo-variant" size={16} color="#DC2626" />
            <Text style={styles.rollbackBtnText}>Rollback</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1. SEKCJA SUWAKA CZASU WYŚWIETLANIA OBRAZU */}
      <View style={styles.sliderCard}>
        <View style={styles.sliderHeaderRow}>
          <View style={styles.sliderIconCircle}>
            <MaterialCommunityIcons name="timer-sand" size={20} color="#059669" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.sliderTitle}>Czas rotacji slajdów</Text>
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
                      pushHistorySnapshot('Reset wszystkich banerów');
                      setUrlDrafts({});
                      onResetAllBanners();
                    },
                  },
                ]
              )
            }
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="backup-restore" size={16} color="#DC2626" />
            <Text style={styles.resetAllBtnText}>Przywróć domyślne ({customCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KARTY DLA POSZCZEGÓLNYCH SLOTÓW BANERÓW */}
      {BANNER_SLOTS.map((slot) => {
        const customList = getCustomBannerList(slot.id, customBanners);
        const isCustom = customList.length > 0;
        const allResolved = resolveBannerImages(slot.id, customBanners);
        const isDragging = dragActiveSlot === slot.id;
        const currentActiveIdx = (previewSlideIdx[slot.id] || 0) % allResolved.length;
        const schedule = schedules[slot.id] || { status: 'published' };
        const isPublished = schedule.status === 'published';

        return (
          <View key={slot.id} style={styles.slotCard}>
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

              <View style={styles.slotBadgesCol}>
                <View
                  style={[
                    styles.statusBadge,
                    isPublished ? styles.badgePublished : styles.badgeDraft,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isPublished ? styles.badgeTextPublished : styles.badgeTextDraft,
                    ]}
                  >
                    {isPublished ? '● Opublikowany' : '○ Szkic (Draft)'}
                  </Text>
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
            </View>

            {/* Podgląd miniatury karuzeli */}
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

            {/* ADM-11: Przycisk podglądu na żywo urządzeń (Mobile 390px / Web 1240px) */}
            <View style={styles.previewActionsRow}>
              <TouchableOpacity
                style={styles.livePreviewBtn}
                onPress={() => setPreviewSlotId(slot.id)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="cellphone-link" size={16} color="#0284C7" />
                <Text style={styles.livePreviewBtnText}>Podgląd na żywo (Mobile 390px / Web 1240px)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusToggleBtn,
                  isPublished ? styles.statusToggleBtnDraft : styles.statusToggleBtnPub,
                ]}
                onPress={() => toggleScheduleStatus(slot.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.statusToggleText,
                    isPublished ? { color: '#B45309' } : { color: '#047857' },
                  ]}
                >
                  {isPublished ? 'Przełącz na Szkic' : 'Opublikuj baner'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ADM-11: Harmonogram emisji (Start / End Date) */}
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleInputWrap}>
                <Text style={styles.scheduleInputLabel}>Start emisji (opcjonalnie):</Text>
                <TextInput
                  style={styles.scheduleInput}
                  placeholder="RRRR-MM-DD"
                  placeholderTextColor="#94A3B8"
                  value={schedule.startDate || ''}
                  onChangeText={(val) => updateScheduleDate(slot.id, 'startDate', val)}
                />
              </View>
              <View style={styles.scheduleInputWrap}>
                <Text style={styles.scheduleInputLabel}>Koniec emisji (opcjonalnie):</Text>
                <TextInput
                  style={styles.scheduleInput}
                  placeholder="RRRR-MM-DD"
                  placeholderTextColor="#94A3B8"
                  value={schedule.endDate || ''}
                  onChangeText={(val) => updateScheduleDate(slot.id, 'endDate', val)}
                />
              </View>
            </View>

            {/* STREFA PRZECIĄGNIJ I UPUŚĆ */}
            {Platform.OS === 'web' ? (
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
                    padding: '14px 12px',
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
                  size={26}
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
            ) : (
              <TouchableOpacity
                style={styles.dragDropNativeBox}
                onPress={() => handlePickFromGallery(slot.id, slot.label)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="cloud-upload-outline"
                  size={26}
                  color="#059669"
                />
                <Text style={styles.dragDropTitle}>Wybierz obrazy z galerii telefonu</Text>
                <Text style={styles.dragDropHint}>
                  Dotknij, aby wybrać jeden lub więcej obrazów do rotacji
                </Text>
              </TouchableOpacity>
            )}

            {/* LISTA DODANYCH MINIATUREK */}
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
                    <Text style={styles.galleryBtnText}>Wybierz pliki</Text>
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

      {/* ADM-11: MODAL PODGLĄDU NA ŻYWO (MOBILE 390px / WEB 1240px) */}
      <Modal
        visible={Boolean(previewSlotId)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPreviewSlotId(null)}
      >
        {previewSlotId && (() => {
          const slot = BANNER_SLOTS.find((s) => s.id === previewSlotId);
          const images = resolveBannerImages(previewSlotId, customBanners);
          const currentIdx = (previewSlideIdx[previewSlotId] || 0) % images.length;

          return (
            <View style={styles.previewModalContainer}>
              {/* Nagłówek modala podglądu */}
              <View style={styles.previewModalHeader}>
                <View style={styles.flexOne}>
                  <Text style={styles.previewModalTitle}>Podgląd responsywny: {slot?.label}</Text>
                  <Text style={styles.previewModalSub}>
                    Rotacja: {images.length} slajdów co {bannerIntervalSeconds}s
                  </Text>
                </View>

                {/* Przełącznik urządzeń */}
                <View style={styles.deviceSwitchRow}>
                  <TouchableOpacity
                    style={[
                      styles.deviceSwitchBtn,
                      previewDevice === 'mobile' && styles.deviceSwitchBtnActive,
                    ]}
                    onPress={() => setPreviewDevice('mobile')}
                  >
                    <MaterialCommunityIcons
                      name="cellphone"
                      size={16}
                      color={previewDevice === 'mobile' ? '#047857' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.deviceSwitchText,
                        previewDevice === 'mobile' && styles.deviceSwitchTextActive,
                      ]}
                    >
                      Telefon (390px)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.deviceSwitchBtn,
                      previewDevice === 'web' && styles.deviceSwitchBtnActive,
                    ]}
                    onPress={() => setPreviewDevice('web')}
                  >
                    <MaterialCommunityIcons
                      name="monitor"
                      size={16}
                      color={previewDevice === 'web' ? '#047857' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.deviceSwitchText,
                        previewDevice === 'web' && styles.deviceSwitchTextActive,
                      ]}
                    >
                      Komputer (1240px)
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.previewModalCloseBtn}
                  onPress={() => setPreviewSlotId(null)}
                >
                  <MaterialCommunityIcons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>

              {/* Sceneria urządzenia */}
              <ScrollView
                style={styles.previewModalScroll}
                contentContainerStyle={styles.previewModalScrollContent}
              >
                <View
                  style={[
                    styles.deviceFrame,
                    previewDevice === 'mobile' ? styles.deviceFrameMobile : styles.deviceFrameWeb,
                  ]}
                >
                  {/* Pasek imitujący przeglądarkę / telefon */}
                  <View style={styles.deviceTopBar}>
                    <View style={styles.deviceDots}>
                      <View style={[styles.deviceDot, { backgroundColor: '#EF4444' }]} />
                      <View style={[styles.deviceDot, { backgroundColor: '#F59E0B' }]} />
                      <View style={[styles.deviceDot, { backgroundColor: '#10B981' }]} />
                    </View>
                    <Text style={styles.deviceUrl}>
                      https://wystawka-app.vercel.app/ ({previewDevice === 'mobile' ? '390 x 844' : '1240 x 800'})
                    </Text>
                  </View>

                  {/* Symulacja nagłówka strony */}
                  <View style={styles.mockAppHeader}>
                    <Text style={styles.mockLogo}>♻️ Wystawka</Text>
                    <Text style={styles.mockNav}>Mapa • Ogłoszenia • Tablica</Text>
                  </View>

                  {/* Rzeczywisty baner w ramce */}
                  <View
                    style={[
                      styles.simulatedBannerContainer,
                      previewDevice === 'mobile' ? { height: 110 } : { height: 180 },
                    ]}
                  >
                    <Image
                      source={images[currentIdx]}
                      style={styles.simulatedBannerImg}
                      resizeMode="cover"
                    />
                    <View style={styles.simulatedSlideCounter}>
                      <Text style={styles.simulatedSlideText}>
                        Slajd {currentIdx + 1} / {images.length}
                      </Text>
                    </View>
                  </View>

                  {/* Treść przykładowa strony poniżej banera */}
                  <View style={styles.mockContent}>
                    <View style={styles.mockSearch} />
                    <View style={styles.mockCard} />
                    <View style={styles.mockCard} />
                  </View>
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  flexOne: {
    flex: 1,
  },
  rollbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  rollbackTitle: {
    fontSize: 12.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#991B1B',
  },
  rollbackSub: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#B91C1C',
    marginTop: 2,
  },
  rollbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rollbackBtnText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#DC2626',
  },
  sliderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sliderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTitle: {
    fontSize: 13.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
  },
  sliderSub: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#64748B',
    marginTop: 2,
  },
  sliderBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sliderBadgeText: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#047857',
  },
  sliderContainer: {
    paddingVertical: 4,
  },
  sliderTrack: {
    width: '100%',
    height: 36,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sliderMinMaxLabel: {
    fontSize: 10.5,
    fontFamily: APP_FONT,
    color: '#94A3B8',
  },
  sliderCurrentHint: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#047857',
  },
  quickStepRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  quickStepBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickStepBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  quickStepText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
  },
  quickStepTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetAllBtnText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#DC2626',
  },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  slotTitle: {
    fontSize: 14,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
  },
  slotSub: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#64748B',
    marginTop: 1,
  },
  slotBadgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePublished: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeDraft: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeCustom: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeDefault: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: APP_FONT,
    fontWeight: '700',
  },
  badgeTextPublished: {
    color: '#047857',
  },
  badgeTextDraft: {
    color: '#B45309',
  },
  badgeTextCustom: {
    color: '#1D4ED8',
  },
  badgeTextDefault: {
    color: '#64748B',
  },
  previewWrapper: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  liveRotationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveRotationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: APP_FONT,
    fontWeight: '600',
  },
  previewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  livePreviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 9,
    paddingVertical: 7,
  },
  livePreviewBtnText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0369A1',
  },
  statusToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  statusToggleBtnDraft: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusToggleBtnPub: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusToggleText: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '700',
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  scheduleInputWrap: {
    flex: 1,
  },
  scheduleInputLabel: {
    fontSize: 10.5,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 3,
  },
  scheduleInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11.5,
    fontFamily: APP_FONT,
    color: '#0F172A',
  },
  dragDropTitle: {
    fontSize: 12,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#334155',
    marginTop: 4,
    textAlign: 'center',
  },
  dragDropHint: {
    fontSize: 10.5,
    fontFamily: APP_FONT,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  dragDropNativeBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  miniaturesSection: {
    marginBottom: 8,
  },
  miniaturesHeader: {
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  miniaturesScroll: {
    flexDirection: 'row',
  },
  miniatureCard: {
    width: 68,
    height: 48,
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
    fontSize: 12.5,
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
  // Style modala podglądu na żywo
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  previewModalTitle: {
    fontSize: 15,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#0F172A',
  },
  previewModalSub: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    color: '#64748B',
  },
  deviceSwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  deviceSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deviceSwitchBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceSwitchText: {
    fontSize: 11.5,
    fontFamily: APP_FONT,
    fontWeight: '600',
    color: '#64748B',
  },
  deviceSwitchTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  previewModalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  previewModalScroll: {
    flex: 1,
  },
  previewModalScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deviceFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  deviceFrameMobile: {
    width: 390,
    minHeight: 680,
  },
  deviceFrameWeb: {
    width: '100%',
    maxWidth: 1080,
    minHeight: 520,
  },
  deviceTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  deviceDots: {
    flexDirection: 'row',
    gap: 5,
  },
  deviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceUrl: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#64748B',
  },
  mockAppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#047857',
  },
  mockLogo: {
    fontSize: 14,
    fontFamily: APP_FONT,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mockNav: {
    fontSize: 11,
    fontFamily: APP_FONT,
    color: '#A7F3D0',
  },
  simulatedBannerContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#CBD5E1',
  },
  simulatedBannerImg: {
    width: '100%',
    height: '100%',
  },
  simulatedSlideCounter: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  simulatedSlideText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: APP_FONT,
    fontWeight: '700',
  },
  mockContent: {
    padding: 16,
    gap: 12,
  },
  mockSearch: {
    height: 38,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
  },
  mockCard: {
    height: 80,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
