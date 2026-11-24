import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ItemCategory, ItemType, PostItem } from '../types';
import { CATEGORIES, THEME } from '../constants/categories';
import { useWebModalEscape } from '../hooks/useWebModalEscape';
import { detectPiiInText } from '../utils/helpers';

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  onAddItem: (newItem: PostItem) => boolean | void | Promise<boolean | void>;
  userCoords?: { latitude: number; longitude: number } | null;
  autoExpireHours?: number;
  autoExpireOddamDays?: number;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  visible,
  onClose,
  onAddItem,
  userCoords,
  autoExpireHours,
  autoExpireOddamDays,
}) => {
  const [type, setType] = useState<ItemType>('wystawka');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ItemCategory>('meble');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    userCoords ? { latitude: userCoords.latitude, longitude: userCoords.longitude } : null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Logistyka dla "Oddam za darmo"
  const [floor, setFloor] = useState('');
  const [hasElevator, setHasElevator] = useState(false);
  const [requiresTransport, setRequiresTransport] = useState(false);
  const [preferredHours, setPreferredHours] = useState('');

  // Czas zauważenia dla "Wystawka uliczna"
  const [spottedAt, setSpottedAt] = useState('Przed chwilą');
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);

  const resetForm = () => {
    setType('wystawka');
    setTitle('');
    setDescription('');
    setCategory('meble');
    setPhotoUri(null);
    setAddress('');
    setCoords(userCoords ? { latitude: userCoords.latitude, longitude: userCoords.longitude } : null);
    setIsLocating(false);
    setIsSubmitting(false);
    setFloor('');
    setHasElevator(false);
    setRequiresTransport(false);
    setPreferredHours('');
    setSpottedAt('Przed chwilą');
    setPiiAcknowledged(false);
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Brak uprawnień', 'Aplikacja potrzebuje dostępu do aparatu, aby zrobić zdjęcie.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });

      if (!result.canceled && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Błąd aparatu', 'Nie udało się otworzyć aparatu.');
    }
  };

  const handlePickGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Brak uprawnień', 'Aplikacja potrzebuje dostępu do galerii zdjęć.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });

      if (!result.canceled && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Błąd galerii', 'Nie udało się otworzyć galerii.');
    }
  };

  const handleUseCurrentGPS = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Brak uprawnień GPS', 'Włącz dostęp do lokalizacji w ustawieniach telefonu.');
        setIsLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      
      const exactCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCoords(exactCoords);

      // Reverse geocoding
      const reverse = await Location.reverseGeocodeAsync(exactCoords);

      if (reverse.length > 0) {
        const place = reverse[0];
        const street = place.street ? `ul. ${place.street} ${place.streetNumber || ''}` : place.name || '';
        const city = place.city || place.subregion || '';
        setAddress(`${street}${street && city ? ', ' : ''}${city}`);
      } else {
        setAddress('Bieżąca dokładna lokalizacja GPS');
      }
    } catch {
      Alert.alert('Błąd GPS', 'Nie udało się pobrać współrzędnych.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  useWebModalEscape(visible, handleClose);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!title.trim()) {
      Alert.alert('Uzupełnij tytuł', 'Podaj nazwę przedmiotu (np. "Fotel drewniany").');
      return;
    }

    if (!photoUri) {
      Alert.alert('Brak zdjęcia', 'Zrób lub wybierz zdjęcie przedmiotu.');
      return;
    }

    const finalLat = coords?.latitude ?? userCoords?.latitude;
    const finalLng = coords?.longitude ?? userCoords?.longitude;
    if (finalLat === undefined || finalLng === undefined) {
      Alert.alert(
        'Brak lokalizacji GPS',
        'Pobierz lokalizację przyciskiem „Pobierz moje GPS”, aby przypiąć znalezisko we właściwym miejscu na mapie.'
      );
      return;
    }

    if (!piiAcknowledged) {
      const pii = detectPiiInText(`${title} ${description}`);
      if (pii.detectedTypes.length > 0) {
        Alert.alert(
          'Ochrona prywatności ⚠️',
          `W treści wykryto ${pii.detectedTypes.join(' oraz ')}. Ogłoszenie będzie widoczne publicznie w internecie. Zalecamy kontakt przez czat w aplikacji.\n\nCzy na pewno chcesz opublikować ogłoszenie z tymi danymi?`,
          [
            { text: 'Popraw opis', style: 'cancel' },
            {
              text: 'Opublikuj mimo to',
              onPress: () => {
                setPiiAcknowledged(true);
                doSubmit(finalLat, finalLng);
              },
            },
          ]
        );
        return;
      }
    }

    doSubmit(finalLat, finalLng);
  };

  const doSubmit = async (finalLat: number, finalLng: number) => {
    setIsSubmitting(true);

    const newItem: PostItem = {
      id: `post-${Date.now()}`,
      type,
      title: title.trim(),
      description: description.trim() || (type === 'wystawka' ? 'Wystawione na ulicy do zabrania.' : 'Do odebrania za darmo.'),
      category,
      photos: [photoUri!],
      location: {
        latitude: finalLat,
        longitude: finalLng,
        address: address.trim() || (type === 'wystawka' ? 'Lokalizacja uliczna' : 'Okolice centrum'),
        isExact: type === 'wystawka',
      },
      createdAt: new Date().toISOString(),
      expiresAt:
        type === 'wystawka'
          ? new Date(Date.now() + (autoExpireHours ?? 6) * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + (autoExpireOddamDays ?? 14) * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      stillThereVotes: type === 'wystawka' ? 1 : 0,
      takenVotes: 0,
      authorName: 'Ty (Łowca Skarbów)',
      pickupDetails:
        type === 'oddam'
          ? {
              floor: floor.trim() ? parseInt(floor.trim(), 10) || 0 : undefined,
              hasElevator,
              requiresTransport,
              preferredHours: preferredHours.trim() || undefined,
            }
          : undefined,
      spottedAt: type === 'wystawka' ? spottedAt : undefined,
    };

    try {
      const okResult = await onAddItem(newItem);
      if (okResult === false) {
        return;
      }
      resetForm();
      onClose();
      Alert.alert('Brawo! 🚀', 'Twoje ogłoszenie zostało opublikowane i pojawiło się na mapie!');
    } catch {
      Alert.alert('Błąd publikacji', 'Nie udało się zapisać ogłoszenia. Spróbuj ponownie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Top Header */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleClose} style={styles.cancelBtn} disabled={isSubmitting}>
              <Text style={styles.cancelBtnText}>Anuluj</Text>
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Dodaj do Śmieciarki</Text>
            <TouchableOpacity onPress={handleSubmit} style={styles.publishBtn} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.publishBtnText}>Dodaj</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Type selector: Wystawka vs Oddam */}
            <Text style={styles.label}>Typ ogłoszenia</Text>
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  type === 'wystawka' && styles.typeOptionWystawkaActive,
                ]}
                onPress={() => setType('wystawka')}
              >
                <MaterialCommunityIcons
                  name="dump-truck"
                  size={24}
                  color={type === 'wystawka' ? '#FFFFFF' : THEME.wystawka}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeOptionTitle, type === 'wystawka' && { color: '#FFFFFF' }]}>
                    Wystawka uliczna
                  </Text>
                  <Text style={[styles.typeOptionSub, type === 'wystawka' && { color: '#FEF3C7' }]}>
                    Stoi na chodniku / przy wiacie
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeOption,
                  type === 'oddam' && styles.typeOptionOddamActive,
                ]}
                onPress={() => setType('oddam')}
              >
                <MaterialCommunityIcons
                  name="gift-outline"
                  size={24}
                  color={type === 'oddam' ? '#FFFFFF' : THEME.oddam}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeOptionTitle, type === 'oddam' && { color: '#FFFFFF' }]}>
                    Oddam za darmo
                  </Text>
                  <Text style={[styles.typeOptionSub, type === 'oddam' && { color: '#D1FAE5' }]}>
                    Odbiór z rąk do rąk z domu
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Photo Section */}
            <Text style={styles.label}>Zdjęcie przedmiotu *</Text>
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setPhotoUri(null)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.removePhotoText}>Usuń</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoButtonsRow}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={handleTakePhoto}>
                  <MaterialCommunityIcons name="camera" size={26} color={THEME.primary} />
                  <Text style={styles.photoActionText}>Zrób zdjęcie</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickGallery}>
                  <MaterialCommunityIcons name="image-multiple" size={26} color="#64748B" />
                  <Text style={styles.photoActionText}>Wybierz z galerii</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Title Input */}
            <Text style={styles.label}>Tytuł / Co to jest? *</Text>
            <TextInput
              style={styles.input}
              placeholder="np. Drewniany stolik kawowy, Karton książek"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
              maxLength={70}
            />

            {/* Category Selector */}
            <Text style={styles.label}>Kategoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && { backgroundColor: cat.color, borderColor: cat.color },
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text style={[styles.categoryChipText, isSelected && { color: '#FFFFFF' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Description */}
            <Text style={styles.label}>Krótki opis / Dokładna lokalizacja</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="np. Stoi obok zielonego kontenera, lekko przetarty róg, stan do wzięcia od zaraz..."
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {/* Address / Location Helper */}
            <View style={styles.locationSection}>
              <View style={styles.locationHeaderRow}>
                <Text style={styles.label}>Adres lub opis miejsca</Text>
                <TouchableOpacity style={styles.gpsAutoBtn} onPress={handleUseCurrentGPS} disabled={isLocating}>
                  {isLocating ? (
                    <ActivityIndicator size="small" color={THEME.primary} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="crosshairs-gps" size={15} color={THEME.primary} />
                      <Text style={styles.gpsAutoText}>Użyj mojego GPS</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="np. ul. Marszałkowska 80 przy bramie"
                placeholderTextColor="#94A3B8"
                value={address}
                onChangeText={setAddress}
              />
            </View>

            {/* Specyficzne pola dla typu ogłoszenia (AUDIT-P1-04) */}
            {type === 'oddam' ? (
              <View style={styles.logisticsContainer}>
                <Text style={styles.logisticsHeader}>📦 Warunki i logistyka odbioru</Text>

                <View style={styles.logisticsRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.subLabel}>Piętro</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="np. 2 (0 = parter)"
                      placeholderTextColor="#94A3B8"
                      value={floor}
                      onChangeText={setFloor}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.subLabel}>Czy jest winda?</Text>
                    <TouchableOpacity
                      style={[styles.toggleBtn, hasElevator && styles.toggleBtnActive]}
                      onPress={() => setHasElevator(!hasElevator)}
                      accessibilityRole="button"
                      accessibilityLabel="Winda dostępna"
                    >
                      <MaterialCommunityIcons
                        name={hasElevator ? 'elevator-passenger' : 'elevator-passenger-outline'}
                        size={18}
                        color={hasElevator ? '#FFFFFF' : '#64748B'}
                      />
                      <Text style={[styles.toggleBtnText, hasElevator && styles.toggleBtnTextActive]}>
                        {hasElevator ? 'Jest winda' : 'Brak windy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.checkboxRow, requiresTransport && styles.checkboxRowActive]}
                  onPress={() => setRequiresTransport(!requiresTransport)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: requiresTransport }}
                >
                  <MaterialCommunityIcons
                    name={requiresTransport ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={requiresTransport ? THEME.primary : '#64748B'}
                  />
                  <Text style={styles.checkboxLabel}>
                    Gabaryt (wymaga kombi/busa lub pomocy 2 osób)
                  </Text>
                </TouchableOpacity>

                <Text style={styles.subLabel}>Preferowane godziny odbioru</Text>
                <TextInput
                  style={styles.input}
                  placeholder="np. W tygodniu po 17:00, w weekendy dowolnie"
                  placeholderTextColor="#94A3B8"
                  value={preferredHours}
                  onChangeText={setPreferredHours}
                  maxLength={100}
                />
              </View>
            ) : (
              <View style={styles.wystawkaSpecificBox}>
                <Text style={styles.subLabel}>Kiedy zauważono wystawkę?</Text>
                <View style={styles.spottedRow}>
                  {['Przed chwilą', '1-2 godz. temu', 'Dziś rano'].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.spottedChip, spottedAt === opt && styles.spottedChipActive]}
                      onPress={() => setSpottedAt(opt)}
                    >
                      <Text
                        style={[
                          styles.spottedChipText,
                          spottedAt === opt && styles.spottedChipTextActive,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.wystawkaDisclaimer}>
                  <MaterialCommunityIcons name="information" size={18} color="#D97706" />
                  <Text style={styles.wystawkaDisclaimerText}>
                    Wystawka uliczna znajduje się w przestrzeni publicznej. Zgłoszenie informuje sąsiadów — brak możliwości rezerwacji (kto pierwszy, ten lepszy).
                  </Text>
                </View>
              </View>
            )}
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
    borderBottomColor: THEME.border,
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
    paddingHorizontal: 16,
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
    marginTop: 12,
  },
  typeSelectorRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  typeOptionWystawkaActive: {
    backgroundColor: THEME.wystawka,
    borderColor: THEME.wystawka,
  },
  typeOptionOddamActive: {
    backgroundColor: THEME.oddam,
    borderColor: THEME.oddam,
  },
  typeOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
  },
  typeOptionSub: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  photoActionBtn: {
    flex: 1,
    height: 100,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  photoPreviewContainer: {
    position: 'relative',
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#E2E8F0',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
    height: 80,
    textAlignVertical: 'top',
  },
  categoriesScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  locationSection: {
    marginTop: 4,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gpsAutoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: THEME.primaryLight,
  },
  gpsAutoText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primaryDark,
  },
  logisticsContainer: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  logisticsHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6,
  },
  logisticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  checkboxRowActive: {
    opacity: 1,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
    fontWeight: '500',
  },
  wystawkaSpecificBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  spottedRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  spottedChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  spottedChipActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  spottedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  spottedChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  wystawkaDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  wystawkaDisclaimerText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
    flex: 1,
  },
});
