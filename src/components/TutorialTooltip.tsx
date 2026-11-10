import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { APP_FONT } from '../constants/categories';

interface TutorialTooltipProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  arrowPosition?: 'top' | 'bottom';
  arrowAlign?: 'center' | 'left' | 'right';
  isLastStep?: boolean;
  onNext: () => void;
  onDismiss: () => void;
}

export const TutorialTooltip: React.FC<TutorialTooltipProps> = ({
  stepNumber,
  totalSteps,
  title,
  description,
  icon,
  iconColor = '#10B981',
  arrowPosition = 'bottom',
  arrowAlign = 'center',
  isLastStep = false,
  onNext,
  onDismiss,
}) => {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {arrowPosition === 'top' && (
        <View
          style={[
            styles.arrow,
            styles.arrowTop,
            arrowAlign === 'left' && styles.arrowLeft,
            arrowAlign === 'right' && styles.arrowRight,
          ]}
        />
      )}

      <View style={styles.bubbleCard}>
        {/* Górny wiersz: Ikona + Krok X/Y + Zamknij krzyżyk */}
        <View style={styles.headerRow}>
          <View style={styles.iconAndBadge}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name={icon} size={15} color={iconColor} />
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                KROK {stepNumber}/{totalSteps}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeIconBtn}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            accessibilityLabel="Wyłącz samouczek"
          >
            <MaterialCommunityIcons name="close" size={14} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Tytuł i treść wyjaśniająca działanie */}
        <Text style={styles.titleText}>{title}</Text>
        <Text style={styles.descText}>{description}</Text>

        {/* Dolny wiersz sterowania: Wyłącz samouczek + Kontynuuj / Zakończ */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissBtnText}>Wyłącz samouczek</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextBtn, isLastStep && styles.finishBtn]}
            onPress={onNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              {isLastStep ? 'Zakończ 🎉' : 'Kontynuuj →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {arrowPosition === 'bottom' && (
        <View
          style={[
            styles.arrow,
            styles.arrowBottom,
            arrowAlign === 'left' && styles.arrowLeft,
            arrowAlign === 'right' && styles.arrowRight,
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    zIndex: 9999,
  },
  bubbleCard: {
    backgroundColor: '#064E3B', // Spójna głęboka zieleń z dotychczasowej chmurki
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  iconAndBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stepBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 0.5,
  },
  closeIconBtn: {
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  titleText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 4,
  },
  descText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '500',
    color: '#E2E8F0',
    lineHeight: 16,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  dismissBtn: {
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  dismissBtnText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
  nextBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  finishBtn: {
    backgroundColor: '#059669',
  },
  nextBtnText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowBottom: {
    borderTopWidth: 7,
    borderTopColor: '#059669',
    marginTop: -1,
  },
  arrowTop: {
    borderBottomWidth: 7,
    borderBottomColor: '#059669',
    marginBottom: -1,
  },
  arrowLeft: {
    alignSelf: 'flex-start',
    marginLeft: 28,
  },
  arrowRight: {
    alignSelf: 'flex-end',
    marginRight: 28,
  },
});
