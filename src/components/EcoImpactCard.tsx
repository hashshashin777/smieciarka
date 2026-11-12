import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_FONT } from '../constants/categories';
import { EcoStats } from '../services/storageCache';

interface EcoImpactCardProps {
  stats: EcoStats;
  streakDays?: number;
  isDark?: boolean;
  style?: StyleProp<ViewStyle>;
}

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const MONTHS_SHORT_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function getCalendarWeekDays(streakDays: number) {
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7; // 0 = Pn .. 6 = Nd
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - todayIndex);

  const days = WEEKDAYS.map((label, idx) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + idx);
    const isToday = idx === todayIndex;
    const isCompleted = idx <= todayIndex && todayIndex - idx < Math.max(streakDays, 1);
    const isFuture = idx > todayIndex;

    return {
      label,
      dayNumber: date.getDate(),
      isToday,
      isCompleted,
      isFuture,
    };
  });

  const todayFormatted = `${WEEKDAYS[todayIndex]}, ${now.getDate()} ${MONTHS_SHORT_PL[now.getMonth()]}`;
  return { days, todayFormatted };
}

export const EcoImpactCard: React.FC<EcoImpactCardProps> = ({
  stats,
  streakDays = 3,
  isDark = false,
  style,
}) => {
  const { days: calendarDays, todayFormatted } = React.useMemo(
    () => getCalendarWeekDays(streakDays),
    [streakDays]
  );
  const getRank = (rescued: number) => {
    if (rescued >= 10) return { title: 'Bohater Zero-Waste', icon: 'shield-crown', color: '#10B981' };
    if (rescued >= 5) return { title: 'Mistrz Drugiego Życia', icon: 'medal', color: '#F59E0B' };
    if (rescued >= 2) return { title: 'Aktywny Poszukiwacz', icon: 'star-circle', color: '#3B82F6' };
    return { title: 'Młody Zbieracz', icon: 'sprout', color: '#10B981' };
  };

  const rank = getRank(stats.itemsRescued);

  const handleShareImpact = async () => {
    try {
      await Share.share({
        message: `🌱 W aplikacji Śmieciarka uratowałem już ${stats.itemsRescued} rzeczy przed wysypiskiem i zaoszczędziłem ${stats.co2SavedKg} kg CO₂! Ratuj wystawki i oddawaj rzeczy sąsiadom za darmo: https://smieciarka.fun`,
        title: 'Mój wpływ Zero-Waste',
      });
    } catch {
      // Ignore
    }
  };

  return (
    <LinearGradient
      colors={isDark ? ['#132E27', '#0F172A'] : ['#FFFFFF', '#F0FDF4']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, isDark && styles.containerDark, style]}
    >
      {/* Nagłówek */}
      <View style={styles.headerRow}>
        <View style={styles.badgeTitleRow}>
          <View style={styles.leafIconContainer}>
            <MaterialCommunityIcons name="recycle" size={20} color="#10B981" />
          </View>
          <View>
            <Text style={[styles.headerTitle, isDark && styles.textWhite]}>Twój Wpływ Zero-Waste</Text>
            <View style={styles.rankRow}>
              <MaterialCommunityIcons name={rank.icon as any} size={14} color={rank.color} />
              <Text style={[styles.rankText, { color: rank.color }]}>{rank.title}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.shareBadgeBtn} 
          onPress={handleShareImpact}
          activeOpacity={0.8}
          accessibilityLabel="Udostępnij swój wpływ ekologiczny"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="share-variant" size={16} color="#047857" />
          <Text style={styles.shareBadgeText}>Podziel się</Text>
        </TouchableOpacity>
      </View>

      {/* Kafelki metryk z gradientem */}
      <View style={styles.metricsRow}>
        <LinearGradient
          colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.metricBox, isDark && styles.metricBoxDark]}
        >
          <Text style={styles.metricVal}>{stats.itemsRescued}</Text>
          <Text style={styles.metricLabel}>Uratowane rzeczy</Text>
        </LinearGradient>

        <LinearGradient
          colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.metricBox, isDark && styles.metricBoxDark]}
        >
          <Text style={[styles.metricVal, { color: isDark ? '#34D399' : '#059669' }]}>{stats.co2SavedKg} kg</Text>
          <Text style={styles.metricLabel}>Zaoszczędzone CO₂</Text>
        </LinearGradient>

        <LinearGradient
          colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.metricBox, isDark && styles.metricBoxDark]}
        >
          <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{stats.postsCreated}</Text>
          <Text style={styles.metricLabel}>Twoje wystawki</Text>
        </LinearGradient>
      </View>

      {/* Licznik Dni z Rzędu (Nowy wariant graficzny + dzisiejszy dzień wg kalendarza) */}
      <LinearGradient
        colors={isDark ? ['#0F2922', '#091815'] : ['#064E3B', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.streakContainer, isDark && styles.streakContainerDark]}
      >
        <View style={styles.streakTopRow}>
          <View style={styles.flameIconBox}>
            <MaterialCommunityIcons name="fire" size={22} color="#FBBF24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakTitle}>
              Seria: <Text style={styles.streakHighlight}>{streakDays} {streakDays === 1 ? 'dzień' : 'dni'} z rzędu</Text>
            </Text>
            <Text style={styles.streakSub}>
              {streakDays >= 5
                ? 'Świetna regularność Zero-Waste!'
                : 'Wracaj codziennie po nowe wystawki'}
            </Text>
          </View>
          <View style={styles.calendarDateBadge}>
            <MaterialCommunityIcons name="calendar-today" size={12} color="#FDE68A" />
            <Text style={styles.calendarDateText}>{todayFormatted}</Text>
          </View>
        </View>

        {/* Tydzień kalendarzowy (Pn - Nd) z zaznaczonym dzisiejszym dniem */}
        <View style={styles.weekCalendarRow}>
          {calendarDays.map((day) => (
            <View key={day.label} style={styles.calendarDayCol}>
              <Text
                style={[
                  styles.calendarWeekdayLabel,
                  day.isToday && styles.calendarWeekdayLabelToday,
                  day.isFuture && styles.calendarWeekdayLabelFuture,
                ]}
              >
                {day.label}
              </Text>
              <View
                style={[
                  styles.calendarCircle,
                  day.isCompleted && !day.isToday && styles.calendarCircleDone,
                  day.isToday && styles.calendarCircleToday,
                  day.isFuture && styles.calendarCircleFuture,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayNumber,
                    day.isCompleted && !day.isToday && styles.calendarDayNumberDone,
                    day.isToday && styles.calendarDayNumberToday,
                    day.isFuture && styles.calendarDayNumberFuture,
                  ]}
                >
                  {day.dayNumber}
                </Text>
                {day.isCompleted && !day.isToday && (
                  <View style={styles.calendarDoneDot}>
                    <MaterialCommunityIcons name="check" size={8} color="#064E3B" />
                  </View>
                )}
              </View>
              {day.isToday ? (
                <Text style={styles.todayTag}>DZIŚ</Text>
              ) : (
                <View style={styles.todayTagSpacer} />
              )}
            </View>
          ))}
        </View>
      </LinearGradient>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  containerDark: {
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leafIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(62, 240, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(62, 240, 196, 0.4)',
  },
  headerTitle: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rankText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
  },
  shareBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(62, 240, 196, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(62, 240, 196, 0.4)',
  },
  shareBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(62, 240, 196, 0.25)',
  },
  metricBoxDark: {
    borderColor: 'rgba(62, 240, 196, 0.35)',
  },
  metricVal: {
    fontFamily: APP_FONT,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  textWhite: {
    color: '#F8FAFC',
  },
  streakContainer: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  streakContainerDark: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  flameIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  streakTitle: {
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ECFDF5',
  },
  streakHighlight: {
    color: '#FDE68A',
    fontWeight: '900',
  },
  streakSub: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#A7F3D0',
    marginTop: 1,
  },
  calendarDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.35)',
  },
  calendarDateText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#FEF3C7',
  },
  weekCalendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  calendarDayCol: {
    flex: 1,
    alignItems: 'center',
  },
  calendarWeekdayLabel: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '700',
    color: '#A7F3D0',
    marginBottom: 5,
  },
  calendarWeekdayLabelToday: {
    color: '#FDE68A',
    fontWeight: '900',
  },
  calendarWeekdayLabelFuture: {
    color: 'rgba(167, 243, 208, 0.5)',
  },
  calendarCircle: {
    position: 'relative',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  calendarCircleDone: {
    backgroundColor: '#10B981',
    borderColor: '#6EE7B7',
  },
  calendarCircleToday: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  calendarCircleFuture: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarDayNumber: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#ECFDF5',
  },
  calendarDayNumberDone: {
    color: '#FFFFFF',
  },
  calendarDayNumberToday: {
    color: '#064E3B',
    fontWeight: '900',
  },
  calendarDayNumberFuture: {
    color: 'rgba(236, 253, 245, 0.45)',
  },
  calendarDoneDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayTag: {
    fontFamily: APP_FONT,
    fontSize: 8.5,
    fontWeight: '900',
    color: '#FDE68A',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  todayTagSpacer: {
    height: 14,
  },
});
