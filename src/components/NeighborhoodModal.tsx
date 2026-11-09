import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { THEME, APP_FONT } from '../constants/categories';
import { NeighborhoodSettings } from '../services/storageCache';

interface NeighborhoodModalProps {
  visible: boolean;
  onClose: () => void;
  settings: NeighborhoodSettings;
  onSaveSettings: (settings: NeighborhoodSettings) => void;
  itemsInRadiusCount?: number;
}

const RADIUS_OPTIONS = [
  { value: 1, label: '1 km', sub: 'Spacer (10 min)' },
  { value: 2, label: '2 km', sub: 'Rower (5 min)' },
  { value: 5, label: '5 km', sub: 'Dzielnica' },
  { value: 10, label: '10 km', sub: 'Miasto' },
  { value: 50, label: 'Bez limitu', sub: 'Wszystko' },
];

export const NeighborhoodModal: React.FC<NeighborhoodModalProps> = ({
  visible,
  onClose,
  settings,
  onSaveSettings,
  itemsInRadiusCount = 0,
}) => {
  const [radius, setRadius] = React.useState(settings.radiusKm);
  const [alerts, setAlerts] = React.useState(settings.alertsEnabled);

  React.useEffect(() => {
    if (visible) {
      setRadius(settings.radiusKm);
      setAlerts(settings.alertsEnabled);
    }
  }, [visible, settings]);

  const handleSave = () => {
    const selectedOption = RADIUS_OPTIONS.find((r) => r.value === radius) || RADIUS_OPTIONS[1];
    onSaveSettings({
      radiusKm: radius,
      alertsEnabled: alerts,
      label: radius >= 50 ? 'Całe miasto' : `Promień ${selectedOption.label}`,
    });
    onClose();
    Alert.alert(
      'Mój Rewir zaktualizowany! 📍',
      alerts 
        ? `Ustawiono promień ${selectedOption.label}. Otrzymasz alert, gdy ktoś doda nową wystawkę w Twojej okolicy!`
        : `Ustawiono promień ${selectedOption.label}. Powiadomienia wyłączone.`
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="map-marker-radius" size={24} color="#10B981" />
              </View>
              <View>
                <Text style={styles.title}>Mój Rewir & Alerty</Text>
                <Text style={styles.subtitle}>Zdefiniuj swój promień poszukiwań</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Opcje promienia ze zintegrowanym suwakiem */}
          <Text style={styles.sectionLabel}>Wybierz zasięg Twojej okolicy:</Text>
          
          <View style={styles.sliderContainer}>
            <View style={styles.sliderHeaderRow}>
              <Text style={styles.sliderValueText}>
                Zasięg: <Text style={{ color: '#10B981', fontWeight: '900' }}>{radius >= 50 ? 'Bez limitu (Całe miasto)' : `${radius} km`}</Text>
              </Text>
              <Text style={styles.sliderHint}>Przesuń suwak</Text>
            </View>
            <Slider
              style={styles.modalSlider}
              minimumValue={1}
              maximumValue={25}
              step={1}
              value={radius > 25 ? 25 : radius}
              onValueChange={(val) => setRadius(val)}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#E2E8F0"
              thumbTintColor="#059669"
            />
          </View>

          <View style={styles.optionsGrid}>
            {RADIUS_OPTIONS.map((opt) => {
              const isSelected = radius === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.radiusCard, isSelected && styles.radiusCardSelected]}
                  onPress={() => setRadius(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.radiusVal, isSelected && styles.radiusValSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.radiusSub, isSelected && styles.radiusSubSelected]}>
                    {opt.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Przełącznik powiadomień */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.toggleTitle}>Alerty o nowych wystawkach</Text>
              <Text style={styles.toggleSub}>
                Powiadom mnie natychmiast, gdy sąsiad wystawi meble lub sprzęt w moim rewirze
              </Text>
            </View>
            <Switch
              value={alerts}
              onValueChange={setAlerts}
              trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
              thumbColor={alerts ? '#10B981' : '#F1F5F9'}
            />
          </View>

          {/* Info o znalezionych przedmiotach */}
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#059669" />
            <Text style={styles.infoBannerText}>
              W wybranym rewirze jest obecnie aktywnych: <Text style={{ fontWeight: '800' }}>{itemsInRadiusCount}</Text> wystawek i ofert.
            </Text>
          </View>

          {/* Zapisz */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Zapisz ustawienia rewiru</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 30, 38, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  title: {
    fontFamily: APP_FONT,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  sectionLabel: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  sliderContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sliderValueText: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sliderHint: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#94A3B8',
  },
  modalSlider: {
    width: '100%',
    height: 34,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  radiusCard: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  radiusCardSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  radiusVal: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  radiusValSelected: {
    color: '#059669',
  },
  radiusSub: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  radiusSubSelected: {
    color: '#047857',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleTitle: {
    fontFamily: APP_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  toggleSub: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  infoBannerText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#166534',
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnText: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
