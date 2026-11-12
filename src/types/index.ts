export type ItemType = 'wystawka' | 'oddam';

export type ItemCategory =
  | 'meble'
  | 'elektronika'
  | 'agd'
  | 'ksiazki'
  | 'ubrania'
  | 'rosliny'
  | 'dla_dzieci'
  | 'inne';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
  isExact: boolean; // true dla wystawki (dokładny punkt na chodniku), false dla oddam (przybliżony obszar)
}

export interface PostItem {
  id: string;
  type: ItemType; // 'wystawka' = znalezisko na ulicy, 'oddam' = z rąk do rąk
  title: string;
  description: string;
  category: ItemCategory;
  photos: string[];
  location: LocationCoords;
  createdAt: string;
  expiresAt?: string;
  status: 'active' | 'taken' | 'expired';
  stillThereVotes: number; // głosy "Jeszcze stoi!"
  takenVotes: number; // głosy "Zabrane!"
  authorName?: string;
  contactInfo?: string;
}

export interface CategoryMeta {
  id: ItemCategory;
  label: string;
  icon: string;
  color: string;
}

// ==========================================
// 📌 TABLICA OGŁOSZEŃ (COMMUNITY BOARD)
// ==========================================
export type BoardTag = 'szukam' | 'oddam' | 'pomoc' | 'info' | 'inne';

export interface BoardPost {
  id: string;
  title: string;
  content: string;
  tag: BoardTag;
  authorName: string;
  locationArea?: string; // np. "Mokotów, Warszawa"
  createdAt: string;
  likesCount: number;
  contactInfo?: string;
}

export interface BoardTagMeta {
  id: BoardTag;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

// ==========================================
// 👤 UŻYTKOWNIK & WIADOMOŚCI (AUTH & CHAT)
// ==========================================
export type AuthProvider = 'apple' | 'google' | 'facebook' | 'email';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  provider: AuthProvider;
  avatarUrl?: string;
  role?: 'user' | 'admin';
  createdAt: string;
}

export interface ItemMessage {
  id: string;
  itemId: string;
  itemTitle: string;
  senderId: string;
  senderName: string;
  senderProvider: AuthProvider;
  text: string;
  createdAt: string;
  isMyMessage?: boolean;
}

export type SyncAction =
  | {
      id: string;
      kind: 'insert_item';
      payload: PostItem;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'vote_still_there';
      itemId: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'vote_taken';
      itemId: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'insert_board_post';
      payload: BoardPost;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'toggle_board_like';
      postId: string;
      createdAt: string;
    };
