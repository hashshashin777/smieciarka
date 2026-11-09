import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PostItem } from '../types';
import { THEME, CATEGORIES, APP_FONT } from '../constants/categories';
import { calculateDistance, formatRelativeTime } from '../utils/helpers';

interface ItemCardProps {
  item: PostItem;
  userCoords?: { latitude: number; longitude: number } | null;
  onPress: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

export const ItemCard = React.memo<ItemCardProps>(({
  item,
  userCoords,
  onPress,
  isSaved = false,
  onToggleSave,
}) => {
  const categoryMeta = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];
  
  const distance = userCoords 
    ? calculateDistance(userCoords.latitude, userCoords.longitude, item.location.latitude, item.location.longitude)
    : null;

  const isWystawka = item.type === 'wystawka';

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress} 
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Ogłoszenie: ${item.title}, ${isWystawka ? 'wystawka' : 'oddam'}, kategoria: ${categoryMeta.label}`}
    >
      {/* Photo */}
      <View style={styles.imageContainer}>
        {item.photos && item.photos.length > 0 ? (
          <Image source={{ uri: item.photos[0] }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialCommunityIcons name="image-off-outline" size={32} color="#94A3B8" />
          </View>
        )}
        
        {/* Type Badge */}
        <View style={[styles.typeBadge, isWystawka ? styles.wystawkaBadge : styles.oddamBadge]}>
          <MaterialCommunityIcons 
            name={isWystawka ? 'dump-truck' : 'gift-outline'} 
            size={13} 
            color="#FFFFFF" 
          />
          <Text style={styles.typeBadgeText}>
            {isWystawka ? 'WYSTAWKA' : 'ODDAM'}
          </Text>
        </View>

        {/* Gwiazdka "Zapisz" w prawym górnym rogu */}
        {onToggleSave && (
          <TouchableOpacity
            style={[styles.saveBtn, isSaved && styles.saveBtnActive]}
            onPress={onToggleSave}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? "Usuń z zapisanych" : "Zapisz ogłoszenie do ulubionych"}
          >
            <MaterialCommunityIcons
              name={isSaved ? 'star' : 'star-outline'}
              size={18}
              color={isSaved ? THEME.starYellow : '#FFFFFF'}
            />
          </TouchableOpacity>
        )}

        {/* Distance Badge on top of image */}
        {distance && (
          <View style={styles.distanceBadge}>
            <MaterialCommunityIcons name="map-marker-distance" size={12} color="#FFFFFF" />
            <Text style={styles.distanceText}>{distance.formatted}</Text>
          </View>
        )}
      </View>

      {/* Info Content z gradientem */}
      <LinearGradient
        colors={['#FFFFFF', '#F5FAF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.content}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.locationContainer}>
            <MaterialCommunityIcons name="map-marker" size={14} color={THEME.textMuted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location.address || 'Lokalizacja na mapie'}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerRow}>
          <View style={[styles.categoryTag, { backgroundColor: `${categoryMeta.color}15` }]}>
            <Text style={[styles.categoryText, { color: categoryMeta.color }]}>
              {categoryMeta.label}
            </Text>
          </View>

          {item.takenVotes === 1 && (
            <View style={styles.takenWarningBadge}>
              <MaterialCommunityIcons name="alert-circle-outline" size={12} color="#B45309" />
              <Text style={styles.takenWarningBadgeText}>Może być zabrane (1/2)</Text>
            </View>
          )}

          <View style={styles.timeContainer}>
            {isWystawka && item.stillThereVotes > 0 && (
              <View style={styles.verifiedTag}>
                <MaterialCommunityIcons name="check-decagram" size={13} color={THEME.primaryDark} />
                <Text style={styles.verifiedText}>{item.stillThereVotes}</Text>
              </View>
            )}
            <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 14,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  imageContainer: {
    height: 180,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  wystawkaBadge: {
    backgroundColor: THEME.wystawka,
  },
  oddamBadge: {
    backgroundColor: THEME.oddam,
  },
  typeBadgeText: {
    fontFamily: APP_FONT,
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  typeBadgeTextOddam: {
    fontFamily: APP_FONT,
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  saveBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  saveBtnActive: {
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  distanceText: {
    fontFamily: APP_FONT,
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  content: {
    padding: 14,
  },
  titleRow: {
    marginBottom: 4,
  },
  title: {
    fontFamily: APP_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  description: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#475569',
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  categoryTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  takenWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  takenWarningBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.primaryDark,
  },
  timeText: {
    fontSize: 12,
    color: THEME.textMuted,
  },
});
