import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME, GRADIENTS, APP_FONT } from '../constants/categories';
import { EcoStats } from '../services/storageCache';

interface EcoImpactCardProps {
  stats: EcoStats;
  streakDays?: number;
  isDark?: boolean;
  style?: any;
}

export const EcoImpactCard: React.FC<EcoImpactCardProps> = ({
  stats,
  streakDays = 3,
  isDark = false,
  style,
}) => {
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

      {/* Licznik Dni z Rzędu (Streak Habit - Moduł Aktywności) */}
      <LinearGradient
        colors={isDark ? ['#241913', '#150E0B'] : ['#FFF7ED', '#FFEDD5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.streakContainer, isDark && styles.streakContainerDark]}
      >
        <View style={styles.streakTopRow}>
          <View style={styles.flameIconBox}>
            <MaterialCommunityIcons name="fire" size={22} color="#EA580C" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.streakTitle, isDark && styles.textWhite]}>
                Seria: <Text style={styles.streakHighlight}>{streakDays} {streakDays === 1 ? 'dzień' : streakDays < 5 ? 'dni' : 'dni'} z rzędu!</Text>
              </Text>
              <View style={styles.streakBadgeMini}>
                <Text style={styles.streakBadgeMiniText}>🔥 Aktywny</Text>
              </View>
            </View>
            <Text style={styles.streakSub}>
              {streakDays >= 5
                ? 'Niesamowita regularność! Jesteś filarem sąsiedzkiego zero-waste.'
                : 'Świetna passa! Wracaj codziennie, by upolować nowe wystawki.'}
            </Text>
          </View>
        </View>

        {/* 7 Dni tygodnia */}
        <View style={styles.weekPillsRow}>
          {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((day, idx) => {
            const isActive = idx < Math.min(streakDays, 7);
            return (
              <View
                key={day}
                style={[
                  styles.dayPill,
                  isActive && styles.dayPillActive,
                  isDark && !isActive && styles.dayPillDark,
                ]}
              >
                <Text
                  style={[
                    styles.dayPillText,
                    isActive && styles.dayPillTextActive,
                    isDark && !isActive && styles.dayPillTextDark,
                  ]}
                >
                  {day}
                </Text>
                {isActive && (
                  <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                )}
              </View>
            );
          })}
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  streakContainerDark: {
    borderTopColor: '#1E293B',
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  flameIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  streakTitle: {
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  streakHighlight: {
    color: '#EA580C',
    fontWeight: '900',
  },
  streakBadgeMini: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  streakBadgeMiniText: {
    fontFamily: APP_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
  },
  streakSub: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  weekPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 4,
  },
  dayPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayPillActive: {
    backgroundColor: '#EA580C',
    borderColor: '#C2410C',
  },
  dayPillDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  dayPillText: {
    fontFamily: APP_FONT,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  dayPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayPillTextDark: {
    color: '#94A3B8',
  },
});
