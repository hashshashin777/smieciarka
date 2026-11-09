import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { PostItem } from '../types';

// Pobieranie kluczy z pliku .env (lub domyślne placeholdery)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_URL.includes('twoj-projekt')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Pobieranie ogłoszeń z chmury Supabase (z limitem najnowszych 60 ogłoszeń)
export async function fetchItemsFromCloud(): Promise<PostItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    console.warn('Błąd pobierania z Supabase:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    photos: row.photos || [],
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      isExact: row.is_exact,
    },
    createdAt: row.created_at,
    status: row.status,
    stillThereVotes: row.still_there_votes || 0,
    takenVotes: row.taken_votes || 0,
    authorName: row.author_name,
    contactInfo: row.contact_info,
  }));
}

// Upload zdjęcia z urządzenia do chmury Supabase Storage
export async function uploadPhotoToStorage(localUri: string): Promise<string> {
  if (!supabase || !localUri || !localUri.startsWith('file://')) {
    return localUri;
  }

  try {
    const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `item_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `items/${fileName}`;

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('items-photos')
      .upload(filePath, blob, {
        contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        upsert: false,
      });

    if (error) {
      console.warn('Storage upload error:', error.message);
      return localUri;
    }

    const { data: publicUrlData } = supabase.storage
      .from('items-photos')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || localUri;
  } catch (err: any) {
    console.warn('Upload photo exception:', err.message);
    return localUri;
  }
}

// Dodawanie nowego ogłoszenia do Supabase (z uploadem zdjęć do Storage)
export async function insertItemToCloud(item: PostItem): Promise<boolean> {
  if (!supabase) return false;

  let cloudPhotos = item.photos;
  try {
    cloudPhotos = await Promise.all(item.photos.map((uri) => uploadPhotoToStorage(uri)));
  } catch (e) {}

  const { error } = await supabase.from('items').insert({
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    category: item.category,
    photos: cloudPhotos,
    latitude: item.location.latitude,
    longitude: item.location.longitude,
    address: item.location.address,
    is_exact: item.location.isExact,
    status: item.status,
    still_there_votes: item.stillThereVotes,
    taken_votes: item.takenVotes,
    author_name: item.authorName,
    created_at: item.createdAt,
  });

  if (error) {
    console.error('Błąd dodawania do Supabase:', error.message);
    return false;
  }

  return true;
}

// Głosowanie "Jeszcze stoi" (resetuje ewentualne głosy zabrania i przedłuża czas)
export async function voteStillThereInCloud(itemId: string): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.from('items').select('still_there_votes').eq('id', itemId).single();
  const currentVotes = (data?.still_there_votes || 0) + 1;
  await supabase.from('items').update({
    still_there_votes: currentVotes,
    taken_votes: 0, // Reset zgłoszeń o zabraniu po potwierdzeniu obecności
    status: 'active',
  }).eq('id', itemId);
}

// Zgłoszenie "Zabrane" (Mechanizm konsensusu: 2 głosy archiwizują ogłoszenie)
export async function voteTakenInCloud(itemId: string): Promise<{ newStatus: 'active' | 'taken'; takenVotes: number }> {
  if (!supabase) return { newStatus: 'active', takenVotes: 1 };
  const { data } = await supabase.from('items').select('taken_votes').eq('id', itemId).single();
  const currentVotes = (data?.taken_votes || 0) + 1;
  const newStatus = currentVotes >= 2 ? 'taken' : 'active';

  await supabase.from('items').update({
    taken_votes: currentVotes,
    status: newStatus,
  }).eq('id', itemId);

  return { newStatus, takenVotes: currentVotes };
}
