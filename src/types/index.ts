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

export interface PickupDetails {
  floor?: number;
  hasElevator?: boolean;
  requiresTransport?: boolean;
  preferredHours?: string;
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
  userId?: string;
  editToken?: string;
  pickupDetails?: PickupDetails;
  spottedAt?: string; // np. "Dzisiaj, ok. 10:00" dla wystawek
  durationDays?: number;
  durationHours?: number;
}

export interface ItemReport {
  id: string;
  itemId: string;
  reporterKey: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  createdAt: string;
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
  expiresAt?: string;
  durationDays?: number;
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
  role?: 'user' | 'moderator' | 'admin';
  createdAt: string;
}

// ==========================================
// 🛡️ MODERACJA I ADMINISTRACJA (ADM-01 - ADM-11)
// ==========================================
export type AdminRole = 'admin' | 'moderator' | 'system';

export interface AdminAuditLogEntry {
  id: string;
  actorId?: string | null;
  actorName: string;
  actorRole: AdminRole;
  action: string;
  targetType: 'item' | 'board_post' | 'user' | 'banner' | 'setting' | 'report' | 'bulk';
  targetId?: string;
  reason?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminBlockEntry {
  id: string;
  targetType: 'user_id' | 'author_name' | 'fingerprint';
  targetValue: string;
  authorName?: string;
  reason: string;
  scope: 'all' | 'items' | 'board';
  duration?: '7d' | '30d' | 'permanent';
  status?: 'active' | 'revoked' | 'expired';
  expiresAt?: string | null;
  blockedByName: string;
  issuedBy?: string;
  blockedById?: string | null;
  createdAt: string;
  revokedAt?: string | null;
  revokedByName?: string | null;
}

export interface ModerationCase {
  id?: string;
  caseId: string;
  targetType: 'item' | 'board_post';
  targetId: string;
  reportsCount: number;
  reportCount?: number;
  latestReason: string;
  latestReportDate?: string;
  createdAt?: string;
  updatedAt?: string;
  reasonsList?: string[];
  reasonsSummary?: Record<string, number>;
  caseStatus?: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
  status?: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface AdminGlobalMetrics {
  activeItems: number;
  wystawkaActive: number;
  oddamActive: number;
  totalItemsPeriod: number;
  oddamGivenCount: number;
  oddamCohortTotal14d: number;
  oddamCohortGiven14d: number;
  oddamCohortRatePct: number | null;
  oddamMedianHours: number;
  wystawkaTotal: number;
  wystawkaUnconfirmed: number;
  wystawkaUnconfirmedRatePct: number | null;
  openCasesCount: number;
  oldestOpenCaseAgeHours: number;
  resolvedCasesCount: number;
  substantiveResolvedCasesCount: number;
  substantiveRatePct: number | null;
  globalRescuedCount: number;
  globalCo2Kg: number;
  co2Methodology: string;
  pageviewsCount?: number;
  uniqueVisitorsCount?: number;
  registeredAccountsCount?: number;
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
