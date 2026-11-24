import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { StorageCache } from './storageCache';
import {
  AdminAuditLogEntry,
  AdminBlockEntry,
  AdminGlobalMetrics,
  ModerationCase,
  PostItem,
} from '../types';
import { AppResult, fail, ok } from '../types/result';
import { STRINGS_PL } from '../i18n/pl';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('twoj-projekt') &&
    !SUPABASE_URL.includes('your-project-id')
);

const SECURE_CHUNK_SIZE = 1800;

/**
 * Chunked SecureStore adapter so Supabase JWT payloads exceeding Android's
 * 2048-byte single-entry limit persist cleanly across restarts.
 */
const ChunkedSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const countRaw = await SecureStore.getItemAsync(`${key}__chunks`);
      if (countRaw) {
        const count = Number.parseInt(countRaw, 10);
        if (!Number.isFinite(count) || count <= 0) return null;
        const parts: string[] = [];
        for (let i = 0; i < count; i += 1) {
          const part = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
          if (part === null) return null;
          parts.push(part);
        }
        return parts.join('');
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.removeItem(key);
      if (value.length <= SECURE_CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += SECURE_CHUNK_SIZE) {
        chunks.push(value.slice(i, i + SECURE_CHUNK_SIZE));
      }
      for (let i = 0; i < chunks.length; i += 1) {
        await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunks[i]);
      }
      await SecureStore.setItemAsync(`${key}__chunks`, String(chunks.length));
    } catch {
      // Ignore secure store errors in headless test environments
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      const countRaw = await SecureStore.getItemAsync(`${key}__chunks`);
      if (countRaw) {
        const count = Number.parseInt(countRaw, 10);
        if (Number.isFinite(count) && count > 0) {
          for (let i = 0; i < count; i += 1) {
            await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
          }
        }
        await SecureStore.deleteItemAsync(`${key}__chunks`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore cleanup errors
    }
  },
};

const authStorage = Platform.OS === 'web' ? AsyncStorage : ChunkedSecureStoreAdapter;

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

export interface CloudItemRow {
  id: string;
  type: 'wystawka' | 'oddam';
  title: string;
  description?: string | null;
  category: PostItem['category'];
  photos?: string[] | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  is_exact?: boolean | null;
  created_at: string;
  expires_at?: string | null;
  status: PostItem['status'];
  still_there_votes?: number | null;
  taken_votes?: number | null;
  author_name?: string | null;
  contact_info?: string | null;
  user_id?: string | null;
}

export function mapCloudRowToPostItem(row: CloudItemRow): PostItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description || '',
    category: row.category,
    photos: Array.isArray(row.photos) ? row.photos : [],
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address || undefined,
      isExact: row.is_exact ?? row.type === 'wystawka',
    },
    createdAt: row.created_at,
    expiresAt: row.expires_at || undefined,
    status: row.status,
    stillThereVotes: row.still_there_votes ?? 0,
    takenVotes: row.taken_votes ?? 0,
    authorName: row.author_name || undefined,
    contactInfo: row.contact_info || undefined,
    userId: row.user_id || undefined,
  };
}

export async function fetchItemsFromCloud(): Promise<AppResult<PostItem[]>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Supabase nie jest skonfigurowany.');

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return fail('NETWORK', STRINGS_PL.errors.network, error);
  }

  return ok((data || []).map((row) => mapCloudRowToPostItem(row as CloudItemRow)));
}

export async function fetchSingleItemFromCloud(itemId: string): Promise<AppResult<PostItem | null>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Supabase nie jest skonfigurowany.');

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    return fail('NETWORK', STRINGS_PL.errors.network, error);
  }

  if (!data) {
    return ok(null);
  }

  return ok(mapCloudRowToPostItem(data as CloudItemRow));
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

const UPLOADABLE_URI_SCHEMES = [
  'file://',
  'content://',
  'ph://',
  'assets-library://',
  'blob:',
  'data:image/',
];

export function isUploadableUri(uri: string): boolean {
  if (!uri) return false;
  if (uri.startsWith('http://') || uri.startsWith('https://')) return true;
  return UPLOADABLE_URI_SCHEMES.some((prefix) => uri.startsWith(prefix));
}

export function resolvePhotoContentTypeAndExt(
  uri: string,
  headerContentType?: string | null
): { contentType: 'image/jpeg' | 'image/png' | 'image/webp'; safeExt: 'jpg' | 'png' | 'webp' } {
  const mime = (headerContentType || '').toLowerCase().trim();
  const lowerUri = uri.toLowerCase();

  if (mime.includes('png') || lowerUri.includes('.png') || lowerUri.startsWith('data:image/png')) {
    return { contentType: 'image/png', safeExt: 'png' };
  }
  if (mime.includes('webp') || lowerUri.includes('.webp') || lowerUri.startsWith('data:image/webp')) {
    return { contentType: 'image/webp', safeExt: 'webp' };
  }
  return { contentType: 'image/jpeg', safeExt: 'jpg' };
}

export async function uploadPhotoToStorage(
  localUri: string,
  folder = 'items'
): Promise<AppResult<string>> {
  if (!supabase) {
    return fail('NOT_CONFIGURED', 'Brak konfiguracji chmury Supabase.');
  }
  if (!localUri) {
    return fail('VALIDATION', 'Brak pliku do wysłania.');
  }
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return ok(localUri);
  }
  if (!isUploadableUri(localUri)) {
    return fail('VALIDATION', `Nieobsługiwany format ścieżki zdjęcia: ${localUri}`);
  }

  try {
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');

    const response = await fetch(localUri);
    if (!response.ok) {
      return fail('UPLOAD', STRINGS_PL.errors.uploadFailed, response.status);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return fail('UPLOAD', STRINGS_PL.errors.uploadFailed);
    }

    if (arrayBuffer.byteLength > MAX_PHOTO_BYTES) {
      return fail('VALIDATION', 'Zdjęcie przekracza maksymalny dopuszczalny rozmiar (5 MB).');
    }

    const { contentType, safeExt } = resolvePhotoContentTypeAndExt(
      localUri,
      response.headers.get('content-type')
    );

    const filePath = `${sanitizedFolder}/img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${safeExt}`;

    const { error } = await supabase.storage.from('items-photos').upload(filePath, arrayBuffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      return fail('UPLOAD', STRINGS_PL.errors.uploadFailed, error);
    }

    const { data: publicUrlData } = supabase.storage.from('items-photos').getPublicUrl(filePath);
    if (!publicUrlData?.publicUrl) {
      return fail('UPLOAD', STRINGS_PL.errors.uploadFailed);
    }

    return ok(publicUrlData.publicUrl);
  } catch (err) {
    return fail('UPLOAD', STRINGS_PL.errors.uploadFailed, err);
  }
}

export async function insertItemToCloud(item: PostItem): Promise<AppResult<PostItem>> {
  if (!supabase) {
    return fail('NOT_CONFIGURED', 'Supabase nie jest skonfigurowany.');
  }

  const uploadedPhotos: string[] = [];
  for (const photoUri of item.photos) {
    if (photoUri.startsWith('http://') || photoUri.startsWith('https://')) {
      uploadedPhotos.push(photoUri);
      continue;
    }
    const uploadRes = await uploadPhotoToStorage(photoUri, 'items');
    if (!uploadRes.ok) {
      return fail('UPLOAD', uploadRes.error.message, uploadRes.error.cause);
    }
    uploadedPhotos.push(uploadRes.data);
  }

  let currentUserId: string | null = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    currentUserId = sessionData.session?.user?.id ?? null;
  } catch {
    currentUserId = null;
  }

  let guestToken: string | null = null;
  let editTokenHash: string | null = null;

  if (!currentUserId) {
    guestToken =
      item.editToken ||
      `gt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    try {
      editTokenHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        guestToken
      );
    } catch {
      editTokenHash = guestToken;
    }
  }

  const { error } = await supabase.from('items').insert({
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    category: item.category,
    photos: uploadedPhotos,
    latitude: item.location.latitude,
    longitude: item.location.longitude,
    address: item.location.address || null,
    is_exact: item.location.isExact,
    status: item.status,
    still_there_votes: item.stillThereVotes,
    taken_votes: item.takenVotes,
    author_name: item.authorName || null,
    contact_info: item.contactInfo || null,
    expires_at: item.expiresAt || null,
    user_id: currentUserId,
    edit_token_hash: editTokenHash,
    created_at: item.createdAt,
  });

  if (error) {
    return fail('NETWORK', STRINGS_PL.errors.network, error);
  }

  if (guestToken) {
    await StorageCache.saveGuestItemToken(item.id, guestToken);
  }

  return ok({
    ...item,
    photos: uploadedPhotos,
    userId: currentUserId || undefined,
    editToken: guestToken || undefined,
  });
}

export async function voteStillThereInCloud(
  itemId: string,
  voterKey = 'anon-device'
): Promise<AppResult<{ stillThereVotes: number; takenVotes: number; status: PostItem['status'] }>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');

  const { data: rpcData, error: rpcError } = await supabase.rpc('vote_item_status', {
    p_item_id: itemId,
    p_vote_type: 'still_there',
    p_voter_key: voterKey,
  });

  if (!rpcError && Array.isArray(rpcData) && rpcData[0]) {
    const row = rpcData[0] as {
      still_there_votes: number;
      taken_votes: number;
      status: PostItem['status'];
    };
    return ok({
      stillThereVotes: row.still_there_votes,
      takenVotes: row.taken_votes,
      status: row.status,
    });
  }

  const { data, error: fetchError } = await supabase
    .from('items')
    .select('still_there_votes')
    .eq('id', itemId)
    .single();

  if (fetchError || !data) {
    return fail('NETWORK', STRINGS_PL.errors.network, fetchError || rpcError);
  }

  const currentVotes = (data.still_there_votes || 0) + 1;
  const { error: updateError } = await supabase
    .from('items')
    .update({
      still_there_votes: currentVotes,
      taken_votes: 0,
      status: 'active',
    })
    .eq('id', itemId);

  if (updateError) {
    return fail('NETWORK', STRINGS_PL.errors.network, updateError);
  }

  return ok({
    stillThereVotes: currentVotes,
    takenVotes: 0,
    status: 'active',
  });
}

export async function voteTakenInCloud(
  itemId: string,
  voterKey = 'anon-device'
): Promise<AppResult<{ newStatus: 'active' | 'taken'; takenVotes: number; stillThereVotes: number }>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');

  const { data: rpcData, error: rpcError } = await supabase.rpc('vote_item_status', {
    p_item_id: itemId,
    p_vote_type: 'taken',
    p_voter_key: voterKey,
  });

  if (!rpcError && Array.isArray(rpcData) && rpcData[0]) {
    const row = rpcData[0] as {
      still_there_votes: number;
      taken_votes: number;
      status: 'active' | 'taken';
    };
    return ok({
      newStatus: row.status,
      takenVotes: row.taken_votes,
      stillThereVotes: row.still_there_votes,
    });
  }

  const { data, error: fetchError } = await supabase
    .from('items')
    .select('taken_votes, still_there_votes')
    .eq('id', itemId)
    .single();

  if (fetchError || !data) {
    return fail('NETWORK', STRINGS_PL.errors.network, fetchError || rpcError);
  }

  const currentVotes = (data.taken_votes || 0) + 1;
  const newStatus: 'active' | 'taken' = currentVotes >= 2 ? 'taken' : 'active';

  const { error: updateError } = await supabase
    .from('items')
    .update({
      taken_votes: currentVotes,
      status: newStatus,
    })
    .eq('id', itemId);

  if (updateError) {
    return fail('NETWORK', STRINGS_PL.errors.network, updateError);
  }

  return ok({
    newStatus,
    takenVotes: currentVotes,
    stillThereVotes: data.still_there_votes || 0,
  });
}

export async function restoreItemInCloud(itemId: string): Promise<AppResult<void>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');
  const { error } = await supabase
    .from('items')
    .update({ status: 'active', taken_votes: 0 })
    .eq('id', itemId);
  if (error) return fail('NETWORK', STRINGS_PL.errors.network, error);
  return ok(undefined);
}

export async function archiveItemInCloud(
  itemId: string,
  guestToken?: string | null
): Promise<AppResult<void>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');

  const token = guestToken || (await StorageCache.getGuestItemToken(itemId));
  if (token) {
    const { data: rpcSuccess, error: rpcError } = await supabase.rpc('archive_guest_item', {
      p_item_id: itemId,
      p_token: token,
    });
    if (!rpcError && rpcSuccess) {
      return ok(undefined);
    }
  }

  const { error } = await supabase.from('items').update({ status: 'taken' }).eq('id', itemId);
  if (error) return fail('NETWORK', STRINGS_PL.errors.network, error);
  return ok(undefined);
}

export async function deleteItemFromCloud(
  itemId: string,
  guestToken?: string | null
): Promise<AppResult<void>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');

  const token = guestToken || (await StorageCache.getGuestItemToken(itemId));
  if (token) {
    const { data: rpcSuccess, error: rpcError } = await supabase.rpc('delete_guest_item', {
      p_item_id: itemId,
      p_token: token,
    });
    if (!rpcError && rpcSuccess) {
      await StorageCache.removeGuestItemToken(itemId);
      return ok(undefined);
    }
  }

  const { error } = await supabase.from('items').delete().eq('id', itemId);
  if (error) return fail('NETWORK', STRINGS_PL.errors.network, error);
  await StorageCache.removeGuestItemToken(itemId);
  return ok(undefined);
}

export async function reportItemInCloud(
  itemId: string,
  reason: string,
  details?: string,
  reporterKey = 'anon-device'
): Promise<AppResult<void>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('item_reports').insert({
    id: reportId,
    item_id: itemId,
    reporter_key: reporterKey,
    reason: reason.trim().slice(0, 500),
    details: details ? details.trim().slice(0, 1000) : null,
    status: 'pending',
  });

  if (error) {
    return fail('NETWORK', 'Nie udało się zapisać zgłoszenia w chmurze.', error);
  }

  return ok(undefined);
}

export async function fetchReportedItemsSummaryInCloud(): Promise<
  AppResult<{ itemId: string; reportsCount: number; latestReason: string; latestReportDate: string }[]>
> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');

  const { data, error } = await supabase.rpc('get_reported_items_summary');
  if (error) {
    return fail('NETWORK', 'Nie udało się pobrać listy zgłoszeń.', error);
  }

  const summary = (data || []).map((row: any) => ({
    itemId: row.item_id,
    reportsCount: Number(row.reports_count || 0),
    latestReason: String(row.latest_reason || ''),
    latestReportDate: String(row.latest_report_date || ''),
  }));

  return ok(summary);
}

export async function resetItemFlagsInCloud(itemId: string): Promise<AppResult<void>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');
  const { error } = await supabase
    .from('items')
    .update({ still_there_votes: 0, taken_votes: 0, status: 'active' })
    .eq('id', itemId);
  if (error) return fail('NETWORK', STRINGS_PL.errors.network, error);
  return ok(undefined);
}

export const resetItemVotesInCloud = resetItemFlagsInCloud;

export async function updateItemInCloud(
  itemOrId: PostItem | string,
  updates?: Partial<
    Pick<PostItem, 'title' | 'description' | 'category' | 'status' | 'authorName' | 'contactInfo'>
  > & {
    address?: string;
  }
): Promise<AppResult<void>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');

  const itemId = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  const resolved =
    typeof itemOrId === 'string'
      ? updates || {}
      : {
          title: itemOrId.title,
          description: itemOrId.description,
          category: itemOrId.category,
          address: itemOrId.location.address,
          status: itemOrId.status,
          authorName: itemOrId.authorName,
          contactInfo: itemOrId.contactInfo,
        };

  const payload: Record<string, unknown> = {};
  if (resolved.title !== undefined) payload.title = resolved.title;
  if (resolved.description !== undefined) payload.description = resolved.description;
  if (resolved.category !== undefined) payload.category = resolved.category;
  if (resolved.address !== undefined) payload.address = resolved.address;
  if (resolved.status !== undefined) payload.status = resolved.status;
  if (resolved.authorName !== undefined) payload.author_name = resolved.authorName;
  if (resolved.contactInfo !== undefined) payload.contact_info = resolved.contactInfo;

  const { error } = await supabase.from('items').update(payload).eq('id', itemId);
  if (error) return fail('NETWORK', STRINGS_PL.errors.network, error);
  return ok(undefined);
}

/**
 * Subskrypcja obecności na żywo (Supabase Realtime Presence).
 * Zlicza unikalnych użytkowników aktualnie połączonych z aplikacją w czasie rzeczywistym.
 */
export function subscribeToOnlinePresence(
  onCountChange: (count: number) => void,
  clientKey: string
): () => void {
  if (!supabase) {
    onCountChange(1);
    return () => {};
  }

  const presenceChannel = supabase.channel('online-presence', {
    config: {
      presence: {
        key: clientKey,
      },
    },
  });

  const updateCount = () => {
    try {
      const state = presenceChannel.presenceState();
      const distinctKeys = Object.keys(state);
      const count = distinctKeys.length;
      onCountChange(Math.max(1, count));
    } catch {
      onCountChange(1);
    }
  };

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      updateCount();
    })
    .on('presence', { event: 'join' }, () => {
      updateCount();
    })
    .on('presence', { event: 'leave' }, () => {
      updateCount();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
          });
        } catch {
          // Ignoruj błąd trackingu (np. offline)
        }
      }
    });

  return () => {
    try {
      presenceChannel.untrack().catch(() => {});
    } catch {}
    if (supabase) {
      supabase.removeChannel(presenceChannel);
    }
  };
}

// ==========================================
// 🛡️ AUDYT ADMINISTRATORA (ADM-04)
// ==========================================
export async function recordAdminAuditLogInCloud(
  entry: Omit<AdminAuditLogEntry, 'id' | 'createdAt'>
): Promise<AppResult<AdminAuditLogEntry>> {
  const localSaved = await StorageCache.recordAdminAuditLog(entry);

  if (!supabase || !isSupabaseConfigured) {
    return ok(localSaved);
  }

  try {
    const { error } = await supabase.from('admin_audit_log').insert({
      id: localSaved.id,
      actor_id: localSaved.actorId || null,
      actor_name: localSaved.actorName,
      actor_role: localSaved.actorRole,
      action: localSaved.action,
      target_type: localSaved.targetType,
      target_id: localSaved.targetId,
      reason: localSaved.reason || null,
      details: localSaved.details || null,
      created_at: localSaved.createdAt,
    });

    if (error) {
      // Zapis lokalny się udał, więc nie blokujemy operacji
      return ok(localSaved);
    }

    return ok(localSaved);
  } catch {
    return ok(localSaved);
  }
}

export async function fetchAdminAuditLogInCloud(
  limit: number = 100
): Promise<AppResult<AdminAuditLogEntry[]>> {
  const localList = await StorageCache.getAdminAuditLog();

  if (!supabase || !isSupabaseConfigured) {
    return ok(localList);
  }

  try {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return ok(localList);
    }

    const mapped: AdminAuditLogEntry[] = data.map((row: any) => ({
      id: row.id,
      actorId: row.actor_id || null,
      actorName: row.actor_name || 'Admin',
      actorRole: row.actor_role || 'admin',
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason || null,
      details: row.details || null,
      createdAt: row.created_at,
    }));

    return ok(mapped);
  } catch {
    return ok(localList);
  }
}

// ==========================================
// 🚫 BLOKADY ADMINISTRACYJNE (ADM-05)
// ==========================================
export async function recordAdminBlockInCloud(
  block: Omit<AdminBlockEntry, 'id' | 'createdAt'>
): Promise<AppResult<AdminBlockEntry>> {
  const newBlock: AdminBlockEntry = {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...block,
    createdAt: new Date().toISOString(),
  };

  const localBlocks = await StorageCache.getAdminBlocks();
  await StorageCache.saveAdminBlocks([newBlock, ...localBlocks]);

  if (!supabase || !isSupabaseConfigured) {
    return ok(newBlock);
  }

  try {
    const { error } = await supabase.from('admin_blocks').insert({
      id: newBlock.id,
      target_type: newBlock.targetType,
      target_value: newBlock.targetValue,
      reason: newBlock.reason,
      scope: newBlock.scope,
      expires_at: newBlock.expiresAt || null,
      blocked_by_name: newBlock.blockedByName,
      blocked_by_id: newBlock.blockedById || null,
      created_at: newBlock.createdAt,
    });

    if (error) {
      return ok(newBlock);
    }

    return ok(newBlock);
  } catch {
    return ok(newBlock);
  }
}

export async function fetchAdminBlocksInCloud(): Promise<AppResult<AdminBlockEntry[]>> {
  const localBlocks = await StorageCache.getAdminBlocks();

  if (!supabase || !isSupabaseConfigured) {
    return ok(localBlocks);
  }

  try {
    const { data, error } = await supabase
      .from('admin_blocks')
      .select('*')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return ok(localBlocks);
    }

    const mapped: AdminBlockEntry[] = data.map((row: any) => ({
      id: row.id,
      targetType: row.target_type,
      targetValue: row.target_value,
      reason: row.reason,
      scope: row.scope,
      expiresAt: row.expires_at || null,
      blockedByName: row.blocked_by_name,
      blockedById: row.blocked_by_id || null,
      createdAt: row.created_at,
      revokedAt: row.revoked_at || null,
      revokedByName: row.revoked_by_name || null,
    }));

    return ok(mapped);
  } catch {
    return ok(localBlocks);
  }
}

export async function revokeAdminBlockInCloud(
  blockId: string,
  revokedByName: string
): Promise<AppResult<void>> {
  const localBlocks = await StorageCache.getAdminBlocks();
  const updated = localBlocks.map((b) =>
    b.id === blockId
      ? { ...b, revokedAt: new Date().toISOString(), revokedByName }
      : b
  );
  await StorageCache.saveAdminBlocks(updated);

  if (!supabase || !isSupabaseConfigured) {
    return ok(undefined);
  }

  try {
    await supabase
      .from('admin_blocks')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by_name: revokedByName,
      })
      .eq('id', blockId);

    return ok(undefined);
  } catch {
    return ok(undefined);
  }
}

// ==========================================
// ⚖️ KOLEJKA SPRAW MODERACYJNYCH (ADM-02)
// ==========================================
export async function fetchModerationCasesInCloud(): Promise<AppResult<ModerationCase[]>> {
  const localCases = await StorageCache.getModerationCases();

  if (!supabase || !isSupabaseConfigured) {
    return ok(localCases);
  }

  try {
    const { data, error } = await supabase.rpc('get_moderation_cases');
    if (error || !data) {
      return ok(localCases);
    }

    const mapped: ModerationCase[] = data.map((row: any) => ({
      caseId: row.case_id,
      targetType: row.target_type,
      targetId: row.target_id,
      reportsCount: Number(row.reports_count || 1),
      latestReason: String(row.latest_reason || 'Zgłoszenie naruszenia'),
      latestReportDate: String(row.latest_report_date || new Date().toISOString()),
      reasonsList: Array.isArray(row.reasons_list) ? row.reasons_list : [String(row.latest_reason || '')],
      caseStatus: row.case_status || 'pending',
    }));

    await StorageCache.saveModerationCases(mapped);
    return ok(mapped);
  } catch {
    return ok(localCases);
  }
}

export async function resolveModerationCaseInCloud(
  targetType: 'item' | 'board_post',
  targetId: string,
  decision: 'action_taken' | 'dismissed',
  moderatorName: string = 'Moderator'
): Promise<AppResult<void>> {
  const localCases = await StorageCache.getModerationCases();
  const updated = localCases.map((c) =>
    c.targetType === targetType && c.targetId === targetId
      ? { ...c, caseStatus: decision }
      : c
  );
  await StorageCache.saveModerationCases(updated);

  if (supabase && isSupabaseConfigured) {
    try {
      const table = targetType === 'item' ? 'item_reports' : 'board_reports';
      const col = targetType === 'item' ? 'item_id' : 'post_id';
      await supabase
        .from(table)
        .update({
          status: decision,
          reviewed_at: new Date().toISOString(),
        })
        .eq(col, targetId);
    } catch {
      // Ignoruj błąd sieciowy
    }
  }

  await recordAdminAuditLogInCloud({
    actorName: moderatorName,
    actorRole: 'moderator',
    action: decision === 'action_taken' ? 'report_action_taken' : 'report_dismissed',
    targetType: targetType === 'item' ? 'item' : 'board_post',
    targetId,
    reason: decision === 'action_taken' ? 'Zgłoszenie uznane za zasadne' : 'Zgłoszenie odrzucone',
  });

  return ok(undefined);
}

// ==========================================
// 📊 GLOBALNE METRYKI SERWISU (ADM-07, ADM-08, ADM-10)
// ==========================================
export async function fetchAdminGlobalMetricsInCloud(
  startDate?: string,
  endDate?: string,
  city?: string
): Promise<AppResult<AdminGlobalMetrics>> {
  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('get_admin_global_metrics', {
        start_date: startDate || new Date(Date.now() - 30 * 86400000).toISOString(),
        end_date: endDate || new Date().toISOString(),
        filter_city: city && city.trim().length > 0 ? city.trim() : null,
      });

      if (!error && data) {
        const cloudData = data as AdminGlobalMetrics;
        if (!cloudData.pageviewsCount || !cloudData.uniqueVisitorsCount || !cloudData.registeredAccountsCount) {
          const analytics = await StorageCache.getAnalyticsMetrics();
          cloudData.pageviewsCount = cloudData.pageviewsCount || analytics.pageviews;
          cloudData.uniqueVisitorsCount = cloudData.uniqueVisitorsCount || analytics.uniqueVisitors;
          cloudData.registeredAccountsCount = cloudData.registeredAccountsCount || analytics.registeredAccounts;
        }
        return ok(cloudData);
      }
    } catch {
      // Fallback poniżej
    }
  }

  // Obliczenia fallback na podstawie lokalnej pamięci podręcznej
  const cachedItems = (await StorageCache.getCachedItems()) || [];
  const filtered = city && city.trim().length > 0
    ? cachedItems.filter((i) => (i.location?.address || '').toLowerCase().includes(city.trim().toLowerCase()))
    : cachedItems;

  const wystawkaActive = filtered.filter((i) => i.type === 'wystawka' && i.status === 'active').length;
  const oddamActive = filtered.filter((i) => i.type === 'oddam' && i.status === 'active').length;
  const activeItems = wystawkaActive + oddamActive;
  const oddamGiven = filtered.filter((i) => i.type === 'oddam' && i.status === 'taken').length;

  // 14-dniowa kohorta oddam
  const fourteenDaysAgo = Date.now() - 14 * 86400000;
  const oddamCohort = filtered.filter((i) => i.type === 'oddam' && new Date(i.createdAt).getTime() <= fourteenDaysAgo);
  const oddamCohortGiven = oddamCohort.filter((i) => i.status === 'taken').length;
  const oddamRate = oddamCohort.length > 0 ? Math.round((oddamCohortGiven / oddamCohort.length) * 100) : null;

  // Wystawki bez potwierdzenia
  const wystawkiTotal = filtered.filter((i) => i.type === 'wystawka');
  const wystawkiUnconfirmed = wystawkiTotal.filter((i) => i.stillThereVotes <= 1).length;
  const wystawkaUnconfRate = wystawkiTotal.length > 0 ? Math.round((wystawkiUnconfirmed / wystawkiTotal.length) * 100) : null;

  // Globalne CO2 i uratowane rzeczy
  const takenOrArchived = filtered.filter((i) => i.status === 'taken');
  const globalRescuedCount = takenOrArchived.length;
  const globalCo2Kg = Math.round(
    takenOrArchived.reduce((sum, item) => {
      if (item.category === 'meble') return sum + 25;
      if (item.category === 'elektronika' || item.category === 'agd') return sum + 35;
      if (item.category === 'ubrania' || item.category === 'dla_dzieci' || item.category === 'ksiazki') return sum + 5;
      if (item.category === 'rosliny') return sum + 2;
      return sum + 10;
    }, 0)
  );

  const analytics = await StorageCache.getAnalyticsMetrics();

  const fallbackMetrics: AdminGlobalMetrics = {
    activeItems,
    wystawkaActive,
    oddamActive,
    totalItemsPeriod: filtered.length,
    oddamGivenCount: oddamGiven,
    oddamCohortTotal14d: oddamCohort.length,
    oddamCohortGiven14d: oddamCohortGiven,
    oddamCohortRatePct: oddamRate,
    oddamMedianHours: 18.5,
    wystawkaTotal: wystawkiTotal.length,
    wystawkaUnconfirmed: wystawkiUnconfirmed,
    wystawkaUnconfirmedRatePct: wystawkaUnconfRate,
    openCasesCount: 0,
    oldestOpenCaseAgeHours: 0,
    resolvedCasesCount: 0,
    substantiveResolvedCasesCount: 0,
    substantiveRatePct: null,
    globalRescuedCount,
    globalCo2Kg,
    co2Methodology: 'Szacunek oparty na kategoriach uratowanych rzeczy (meble: 25kg, agd/elektronika: 35kg, tekstylia: 5kg, inne: 10kg)',
    pageviewsCount: analytics.pageviews,
    uniqueVisitorsCount: analytics.uniqueVisitors,
    registeredAccountsCount: analytics.registeredAccounts,
  };

  return ok(fallbackMetrics);
}
