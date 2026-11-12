import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, ItemMessage } from '../types';
import { AppResult, fail, ok } from '../types/result';
import { STRINGS_PL } from '../i18n/pl';
import { supabase } from './supabase';

const CHAT_KEY_PREFIX = 'smieciarka_chat_v2_';

interface CloudMessageRow {
  id: string;
  item_id: string;
  sender_id: string;
  sender_name: string;
  sender_provider?: AuthProvider | null;
  text: string;
  created_at: string;
}

function mapCloudRow(row: CloudMessageRow): ItemMessage {
  return {
    id: row.id,
    itemId: row.item_id,
    itemTitle: '',
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderProvider: row.sender_provider || 'email',
    text: row.text,
    createdAt: row.created_at,
  };
}

async function readLocalMessages(itemId: string): Promise<ItemMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`${CHAT_KEY_PREFIX}${itemId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalMessages(itemId: string, messages: ItemMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CHAT_KEY_PREFIX}${itemId}`, JSON.stringify(messages));
  } catch {
    // Ignore local cache write failures
  }
}

export const ChatRepository = {
  async fetchMessages(itemId: string, itemTitle = ''): Promise<AppResult<ItemMessage[]>> {
    const local = await readLocalMessages(itemId);

    if (!supabase) {
      return ok(local);
    }

    const { data, error } = await supabase
      .from('item_messages')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      if (local.length > 0) return ok(local);
      return fail('NETWORK', STRINGS_PL.errors.network, error);
    }

    const cloudMsgs = (data || []).map((row) => ({
      ...mapCloudRow(row as CloudMessageRow),
      itemTitle,
    }));
    const mergedMap = new Map<string, ItemMessage>();
    for (const msg of local) mergedMap.set(msg.id, msg);
    for (const msg of cloudMsgs) mergedMap.set(msg.id, msg);

    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    await writeLocalMessages(itemId, merged);
    return ok(merged);
  },

  async sendMessage(
    itemId: string,
    itemTitle: string,
    text: string,
    sender: { id: string; name: string; provider: AuthProvider }
  ): Promise<AppResult<ItemMessage>> {
    const trimmed = text.trim();
    if (!trimmed) {
      return fail('VALIDATION', 'Wiadomość nie może być pusta.');
    }

    const newMsg: ItemMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      itemId,
      itemTitle,
      senderId: sender.id,
      senderName: sender.name,
      senderProvider: sender.provider,
      text: trimmed,
      createdAt: new Date().toISOString(),
      isMyMessage: true,
    };

    const existing = await readLocalMessages(itemId);
    await writeLocalMessages(itemId, [...existing, newMsg]);

    if (supabase) {
      let userId: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user?.id ?? null;
      } catch {
        userId = null;
      }

      const { error } = await supabase.from('item_messages').insert([
        {
          id: newMsg.id,
          item_id: newMsg.itemId,
          sender_id: newMsg.senderId,
          sender_name: newMsg.senderName,
          sender_provider: newMsg.senderProvider,
          user_id: userId,
          text: newMsg.text,
          created_at: newMsg.createdAt,
        },
      ]);

      if (error) {
        return fail('NETWORK', STRINGS_PL.errors.network, error);
      }
    }

    return ok(newMsg);
  },

  async clearAllLocalChats(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const chatKeys = keys.filter((k) => k.startsWith(CHAT_KEY_PREFIX));
      if (chatKeys.length > 0) {
        await AsyncStorage.multiRemove(chatKeys);
      }
    } catch {
      // Ignore cleanup errors
    }
  },
};
