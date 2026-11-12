import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { PostItem } from '../types';
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

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: ChunkedSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
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

const UPLOADABLE_URI_SCHEMES = ['file://', 'content://', 'ph://', 'assets-library://'];

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
  if (!UPLOADABLE_URI_SCHEMES.some((prefix) => localUri.startsWith(prefix))) {
    return fail('VALIDATION', `Nieobsługiwany format ścieżki zdjęcia: ${localUri}`);
  }

  try {
    const ext = localUri.split('.').pop()?.toLowerCase();
    const safeExt = ext === 'png' || ext === 'webp' ? ext : 'jpg';
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = `${sanitizedFolder}/img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${safeExt}`;

    const response = await fetch(localUri);
    if (!response.ok) {
      return fail('UPLOAD', STRINGS_PL.errors.uploadFailed, response.status);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return fail('UPLOAD', STRINGS_PL.errors.uploadFailed);
    }

    const { error } = await supabase.storage.from('items-photos').upload(filePath, arrayBuffer, {
      contentType: `image/${safeExt === 'png' ? 'png' : safeExt === 'webp' ? 'webp' : 'jpeg'}`,
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
    created_at: item.createdAt,
  });

  if (error) {
    return fail('NETWORK', STRINGS_PL.errors.network, error);
  }

  return ok({
    ...item,
    photos: uploadedPhotos,
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

export async function archiveItemInCloud(itemId: string): Promise<AppResult<void>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');
  const { error } = await supabase.from('items').update({ status: 'expired' }).eq('id', itemId);
  if (error) return fail('NETWORK', STRINGS_PL.errors.network, error);
  return ok(undefined);
}

export async function deleteItemFromCloud(itemId: string): Promise<AppResult<void>> {
  if (!supabase) return fail('NOT_CONFIGURED', 'Brak konfiguracji Supabase.');
  const { error } = await supabase.from('items').delete().eq('id', itemId);
  if (error) return fail('NETWORK', STRINGS_PL.errors.network, error);
  return ok(undefined);
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
