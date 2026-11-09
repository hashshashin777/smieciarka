import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BoardPost } from '../types';
import { BOARD_TAGS } from '../constants/boardTags';
import { THEME } from '../constants/categories';
import { formatRelativeTime } from '../utils/helpers';

interface BoardCardProps {
  post: BoardPost;
  onLikeToggle?: (postId: string) => void;
  isSaved?: boolean;
  onToggleSave?: (postId: string) => void;
}

export const BoardCard: React.FC<BoardCardProps> = React.memo(({
  post,
  onLikeToggle,
  isSaved = false,
  onToggleSave,
}) => {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likesCount);

  const tagMeta = BOARD_TAGS.find((t) => t.id === post.tag) || BOARD_TAGS[BOARD_TAGS.length - 1];

  const handleLike = () => {
    if (liked) {
      setLikes((prev) => prev - 1);
      setLiked(false);
    } else {
      setLikes((prev) => prev + 1);
      setLiked(true);
    }
    if (onLikeToggle) {
      onLikeToggle(post.id);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: `Tablica Śmieciarki: ${post.title}`,
        message: `Wpis z Tablicy Śmieciarki: „${post.title}” – ${post.content}\n\nDołącz do sąsiedzkiej tablicy: https://smieciarka.fun/board/${post.id}`,
      });
    } catch (e) {}
  };

  const handleContact = () => {
    if (post.contactInfo) {
      Alert.alert('Kontakt do ogłoszeniodawcy', `${post.authorName}:\n\n${post.contactInfo}`);
    } else {
      Alert.alert('Ogłoszenie', `Autor: ${post.authorName}\n\nAby skontaktować się, dołącz do lokalnej grupy.`);
    }
  };

  // Kolor inicjałów
  const getAvatarColor = (name: string) => {
    const colors = ['#059669', '#0284C7', '#7C3AED', THEME.orange, '#E11D48', '#D97706'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const avatarColor = getAvatarColor(post.authorName);
  const initials = post.authorName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.card}>
      {/* Top Author Row */}
      <View style={styles.headerRow}>
        <View style={styles.authorGroup}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials || 'U'}</Text>
          </View>
          <View>
            <Text style={styles.authorName}>{post.authorName}</Text>
            <View style={styles.timeLocationRow}>
              <Text style={styles.timeText}>{formatRelativeTime(post.createdAt)}</Text>
              {post.locationArea && (
                <>
                  <Text style={styles.dotSeparator}>•</Text>
                  <MaterialCommunityIcons name="map-marker-outline" size={12} color="#64748B" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {post.locationArea}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Tag Badge */}
        <View style={[styles.tagBadge, { backgroundColor: tagMeta.bgColor }]}>
          <MaterialCommunityIcons name={tagMeta.icon as any} size={13} color={tagMeta.color} />
          <Text style={[styles.tagText, { color: tagMeta.color }]}>{tagMeta.label}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>{post.title}</Text>

      {/* Content */}
      <Text style={styles.content}>{post.content}</Text>

      {/* Contact preview banner if present */}
      {post.contactInfo && (
        <View style={styles.contactBanner}>
          <MaterialCommunityIcons name="chat-outline" size={14} color="#059669" />
          <Text style={styles.contactBannerText} numberOfLines={1}>
            {post.contactInfo}
          </Text>
        </View>
      )}

      {/* Footer Actions */}
      <View style={styles.footerRow}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity
            style={[styles.likeBtn, liked && styles.likeBtnActive]}
            onPress={handleLike}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={liked ? 'heart' : 'heart-outline'}
              size={18}
              color={liked ? '#EF4444' : '#64748B'}
            />
            <Text style={[styles.likeText, liked && styles.likeTextActive]}>
              {likes > 0 ? likes : 'Wspieram'}
            </Text>
          </TouchableOpacity>

          {onToggleSave && (
            <TouchableOpacity
              style={[styles.starBtn, isSaved && styles.starBtnActive]}
              onPress={() => onToggleSave(post.id)}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={isSaved ? 'Usuń z zapisanych' : 'Zapisz'}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name={isSaved ? 'star' : 'star-outline'}
                size={18}
                color={isSaved ? THEME.starYellow : '#64748B'}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Udostępnij wpis"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="share-variant-outline" size={17} color="#64748B" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.contactBtn} onPress={handleContact} activeOpacity={0.8}>
          <MaterialCommunityIcons name="send-outline" size={15} color="#0F172A" />
          <Text style={styles.contactBtnText}>Odpowiedz</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  timeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#64748B',
  },
  dotSeparator: {
    color: '#94A3B8',
    fontSize: 12,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    maxWidth: 120,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 8,
    lineHeight: 22,
  },
  content: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    marginBottom: 12,
  },
  contactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 12,
  },
  contactBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starBtn: {
    padding: 7,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starBtnActive: {
    backgroundColor: '#FEF3C7',
  },
  shareBtn: {
    padding: 7,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  likeBtnActive: {
    backgroundColor: '#FEE2E2',
  },
  likeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  likeTextActive: {
    color: '#DC2626',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
});
