import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminAuditLogEntry, AdminRole } from '../types';
import { fetchAdminAuditLogInCloud } from '../services/supabase';
import { APP_FONT } from '../constants/categories';
import { formatRelativeTime } from '../utils/helpers';

interface AdminAuditTabProps {
  currentActorRole?: AdminRole;
  currentActorName?: string;
  onRefreshTrigger?: () => void;
}

export const AdminAuditTab: React.FC<AdminAuditTabProps> = ({
  currentActorRole = 'admin',
  currentActorName = 'Administrator',
}) => {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');

  const loadLogs = async () => {
    const res = await fetchAdminAuditLogInCloud(100);
    if (res.ok) {
      setLogs(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      const res = await fetchAdminAuditLogInCloud(100);
      if (isMounted) {
        if (res.ok) {
          setLogs(res.data);
        }
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLogs = logs.filter((entry) => {
    if (filterAction === 'all') return true;
    if (filterAction === 'moderation') {
      return (
        entry.action.includes('report') ||
        entry.action.includes('ban') ||
        entry.action.includes('block')
      );
    }
    if (filterAction === 'items') {
      return entry.action.includes('item');
    }
    if (filterAction === 'settings') {
      return entry.action.includes('setting') || entry.action.includes('banner');
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('restore') || action.includes('renew')) {
      return { label: 'Odnowienie / Przywrócenie', color: '#059669', bg: '#ECFDF5', icon: 'refresh' as const };
    }
    if (action.includes('archive') || action.includes('hidden')) {
      return { label: 'Archiwizacja / Ukrycie', color: '#D97706', bg: '#FFFBEB', icon: 'archive-outline' as const };
    }
    if (action.includes('delete')) {
      return { label: 'Usunięcie treści', color: '#DC2626', bg: '#FEF2F2', icon: 'trash-can-outline' as const };
    }
    if (action.includes('report_action_taken')) {
      return { label: 'Zgłoszenie: Zasadne', color: '#7C3AED', bg: '#F5F3FF', icon: 'shield-alert-outline' as const };
    }
    if (action.includes('report_dismissed')) {
      return { label: 'Zgłoszenie: Odrzucone', color: '#0284C7', bg: '#F0F9FF', icon: 'shield-check-outline' as const };
    }
    if (action.includes('block') || action.includes('ban')) {
      return { label: 'Blokada użytkownika', color: '#991B1B', bg: '#FEE2E2', icon: 'account-cancel' as const };
    }
    if (action.includes('banner')) {
      return { label: 'Zarządzanie banerem', color: '#2563EB', bg: '#EFF6FF', icon: 'bullhorn-outline' as const };
    }
    return { label: action, color: '#475569', bg: '#F1F5F9', icon: 'clipboard-text-outline' as const };
  };

  return (
    <View style={styles.container}>
      {/* 1. Karta bieżących uprawnień sesji */}
      <View style={styles.roleCard}>
        <View style={styles.roleHeaderRow}>
          <View style={styles.roleIconWrap}>
            <MaterialCommunityIcons
              name={currentActorRole === 'admin' ? 'shield-crown' : 'shield-check'}
              size={22}
              color="#047857"
            />
          </View>
          <View style={styles.roleMeta}>
            <Text style={styles.roleTitle}>
              Zalogowano jako: {currentActorName} ({currentActorRole === 'admin' ? 'Administrator' : 'Moderator'})
            </Text>
            <Text style={styles.roleSub}>
              {currentActorRole === 'admin'
                ? 'Pełne uprawnienia: zarządzanie konfiguracją, TTL, banerami, audytem i moderacją treści.'
                : 'Uprawnienia operacyjne: moderacja zgłoszeń, ukrywanie treści i nakładanie blokad.'}
            </Text>
          </View>
          <TouchableOpacity onPress={loadLogs} style={styles.refreshBtn} activeOpacity={0.75}>
            <MaterialCommunityIcons name="refresh" size={18} color="#047857" />
          </TouchableOpacity>
        </View>

        {/* Tabela uprawnień ról */}
        <View style={styles.permTable}>
          <View style={styles.permRow}>
            <Text style={styles.permColTitle}>Operacja</Text>
            <Text style={styles.permColRole}>Moderator</Text>
            <Text style={styles.permColRole}>Administrator</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permCellName}>Kolejka zgłoszeń i rozstrzyganie spraw</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permCellName}>Odnawianie i archiwizacja ogłoszeń</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permCellName}>Blokowanie użytkowników (czasowe/stałe)</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permCellName}>Trwałe usuwanie treści z bazy</Text>
            <Text style={[styles.permCellBadge, styles.permDenied]}>NIE</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permCellName}>Zmiana suwaków TTL i parametrów systemu</Text>
            <Text style={[styles.permCellBadge, styles.permDenied]}>NIE</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
          </View>
          <View style={[styles.permRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.permCellName}>Zarządzanie banerami i publikacja ogłoszeń</Text>
            <Text style={[styles.permCellBadge, styles.permDenied]}>NIE</Text>
            <Text style={[styles.permCellBadge, styles.permAllowed]}>TAK</Text>
          </View>
        </View>
      </View>

      {/* 2. Filtry działań audytowych */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>Dziennik zdarzeń i operacji (Audit Log)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {[
            { id: 'all', label: `Wszystkie (${logs.length})` },
            { id: 'moderation', label: 'Zgłoszenia i blokady' },
            { id: 'items', label: 'Operacje na ogłoszeniach' },
            { id: 'settings', label: 'Ustawienia i banery' },
          ].map((f) => {
            const isSelected = filterAction === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setFilterAction(f.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Lista wpisów audytu */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Ładowanie dziennika audytu...</Text>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="history" size={36} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Brak zarejestrowanych operacji</Text>
          <Text style={styles.emptySub}>
            Wszelkie działania moderatorów i administratorów (rozstrzyganie spraw, odnowienia, blokady) pojawią się w tym miejscu.
          </Text>
        </View>
      ) : (
        <View style={styles.logsList}>
          {filteredLogs.map((entry) => {
            const badge = getActionBadge(entry.action);
            return (
              <View key={entry.id} style={styles.logCard}>
                <View style={styles.logCardHeader}>
                  <View style={[styles.actionBadge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
                    <MaterialCommunityIcons name={badge.icon} size={14} color={badge.color} />
                    <Text style={[styles.actionBadgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                  <Text style={styles.logTime}>{formatRelativeTime(entry.createdAt)}</Text>
                </View>

                <View style={styles.logBody}>
                  <View style={styles.logMetaRow}>
                    <Text style={styles.logActor}>
                      Wykonawca: <Text style={{ fontWeight: '700' }}>{entry.actorName}</Text> ({entry.actorRole})
                    </Text>
                    <Text style={styles.logTarget}>
                      Obiekt: <Text style={{ fontWeight: '700' }}>{entry.targetType} #{entry.targetId ? entry.targetId.slice(0, 12) : 'system'}</Text>
                    </Text>
                  </View>

                  {entry.reason && (
                    <Text style={styles.logReason}>
                      Powód / Uzasadnienie: <Text style={{ fontStyle: 'italic', color: '#1E293B' }}>„{entry.reason}”</Text>
                    </Text>
                  )}

                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <View style={styles.detailsBox}>
                      <Text style={styles.detailsText} numberOfLines={2}>
                        Szczegóły: {JSON.stringify(entry.details)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  roleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleMeta: {
    flex: 1,
  },
  roleTitle: {
    fontFamily: APP_FONT,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleSub: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
  },
  permTable: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  permColTitle: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  permColRole: {
    width: 90,
    textAlign: 'center',
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  permCellName: {
    flex: 1,
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#334155',
  },
  permCellBadge: {
    width: 90,
    textAlign: 'center',
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
  },
  permAllowed: {
    color: '#059669',
  },
  permDenied: {
    color: '#94A3B8',
  },
  filterSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  filterChipText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  loadingBox: {
    padding: 36,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  emptyBox: {
    padding: 36,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
  },
  emptySub: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
  },
  logsList: {
    gap: 10,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
  },
  logTime: {
    fontFamily: APP_FONT,
    fontSize: 11,
    color: '#94A3B8',
  },
  logBody: {
    gap: 4,
  },
  logMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  logActor: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#475569',
  },
  logTarget: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#475569',
  },
  logReason: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  detailsText: {
    fontFamily: 'monospace',
    fontSize: 10.5,
    color: '#64748B',
  },
});
