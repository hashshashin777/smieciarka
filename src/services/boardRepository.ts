import { BoardPost } from '../types';
import { AppResult, fail, ok } from '../types/result';
import { STRINGS_PL } from '../i18n/pl';
import { supabase } from './supabase';

export interface CloudBoardRow {
  id: string;
  title: string;
  content: string;
  tag: BoardPost['tag'];
  author_name?: string | null;
  location_area?: string | null;
  contact_info?: string | null;
  likes_count?: number | null;
  created_at: string;
}

export function mapCloudRowToBoardPost(row: CloudBoardRow): BoardPost {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tag: row.tag,
    authorName: row.author_name || 'Sąsiad',
    locationArea: row.location_area || undefined,
    contactInfo: row.contact_info || undefined,
    likesCount: row.likes_count ?? 0,
    createdAt: row.created_at,
  };
}

export const BoardRepository = {
  async fetchAll(): Promise<AppResult<BoardPost[]>> {
    if (!supabase) {
      return fail('NOT_CONFIGURED', 'Supabase nie jest skonfigurowany.');
    }

    const { data, error } = await supabase
      .from('board_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) {
      return fail('NETWORK', STRINGS_PL.errors.network, error);
    }

    return ok((data || []).map((row) => mapCloudRowToBoardPost(row as CloudBoardRow)));
  },

  async insert(post: BoardPost): Promise<AppResult<BoardPost>> {
    if (!supabase) {
      return fail('NOT_CONFIGURED', 'Supabase nie jest skonfigurowany.');
    }

    let userId: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id ?? null;
    } catch {
      userId = null;
    }

    const { error } = await supabase.from('board_posts').insert([
      {
        id: post.id,
        title: post.title,
        content: post.content,
        tag: post.tag,
        author_name: post.authorName,
        location_area: post.locationArea || null,
        contact_info: post.contactInfo || null,
        likes_count: post.likesCount,
        user_id: userId,
        created_at: post.createdAt,
      },
    ]);

    if (error) {
      return fail('NETWORK', STRINGS_PL.errors.network, error);
    }

    return ok(post);
  },

  async toggleLike(
    postId: string,
    voterKey: string
  ): Promise<AppResult<{ liked: boolean; likesCount: number }>> {
    if (!supabase) {
      return fail('NOT_CONFIGURED', 'Supabase nie jest skonfigurowany.');
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_board_like', {
      p_post_id: postId,
      p_voter_key: voterKey,
    });

    if (!rpcError && Array.isArray(rpcData) && rpcData[0]) {
      const row = rpcData[0] as { liked: boolean; likes_count: number };
      return ok({ liked: row.liked, likesCount: row.likes_count });
    }

    return fail('NETWORK', STRINGS_PL.errors.network, rpcError);
  },

  async remove(postId: string): Promise<AppResult<void>> {
    if (!supabase) return fail('NOT_CONFIGURED', 'Supabase nie jest skonfigurowany.');
    const { error } = await supabase.from('board_posts').delete().eq('id', postId);
    if (error) return fail('NETWORK', STRINGS_PL.errors.network, error);
    return ok(undefined);
  },
};
