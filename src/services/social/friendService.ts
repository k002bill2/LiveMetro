/**
 * Friend Service
 * Manages friend connections and sharing between users
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Firestore 타입 정의
interface FirestoreDocument {
  id: string;
  data(): Record<string, unknown> | undefined;
  exists: boolean;
}

interface FirestoreQuerySnapshot {
  docs: FirestoreDocument[];
  empty: boolean;
}

interface FirestoreDocRef {
  id: string;
  get(): Promise<FirestoreDocument>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}

interface FirestoreCollectionRef {
  doc(id: string): FirestoreDocRef;
  where(field: string, op: string, value: unknown): FirestoreCollectionRef;
  limit(n: number): FirestoreCollectionRef;
  get(): Promise<FirestoreQuerySnapshot>;
  add(data: Record<string, unknown>): Promise<FirestoreDocRef>;
}

interface FirestoreInstance {
  collection(path: string): FirestoreCollectionRef;
}

type FirestoreModule = () => FirestoreInstance;

// Lazy load firestore module
let firestore: FirestoreModule | null = null;

function loadFirestoreModule(): FirestoreInstance | null {
  if (firestore) return firestore();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    firestore = require('@react-native-firebase/firestore').default as FirestoreModule;
    return firestore();
  } catch {
    console.log('ℹ️ @react-native-firebase/firestore not available');
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Friend profile
 */
export interface FriendProfile {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly favoriteStations: readonly string[];
  readonly status: FriendStatus;
  readonly addedAt: Date;
  readonly lastActiveAt?: Date;
}

/**
 * Friend status
 */
export type FriendStatus = 'pending' | 'accepted' | 'blocked';

/**
 * Friend request
 */
export interface FriendRequest {
  readonly id: string;
  readonly fromUserId: string;
  readonly fromUserName: string;
  readonly toUserId: string;
  readonly status: 'pending' | 'accepted' | 'rejected';
  readonly createdAt: Date;
  readonly message?: string;
}

/**
 * Friend invitation
 */
export interface FriendInvitation {
  readonly code: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly maxUses: number;
  readonly currentUses: number;
}

/**
 * Shared commute
 */
export interface SharedCommute {
  readonly id: string;
  readonly userId: string;
  readonly userName: string;
  readonly fromStation: string;
  readonly toStation: string;
  readonly departureTime: string;
  readonly isActive: boolean;
  readonly sharedAt: Date;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  FRIENDS: '@livemetro:friends',
  REQUESTS: '@livemetro:friend_requests',
  INVITATIONS: '@livemetro:friend_invitations',
};

const COLLECTIONS = {
  FRIENDS: 'friends',
  FRIEND_REQUESTS: 'friend_requests',
  INVITATIONS: 'friend_invitations',
  SHARED_COMMUTES: 'shared_commutes',
};

const INVITATION_EXPIRY_DAYS = 7;
const MAX_FRIENDS = 100;

// ============================================================================
// Service
// ============================================================================

class FriendService {
  private friends: Map<string, FriendProfile> = new Map();
  private pendingRequests: FriendRequest[] = [];
  private initialized = false;

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const friendsData = await AsyncStorage.getItem(STORAGE_KEYS.FRIENDS);
      if (friendsData) {
        const parsed = JSON.parse(friendsData);
        for (const friend of parsed) {
          this.friends.set(friend.id, {
            ...friend,
            addedAt: new Date(friend.addedAt),
            lastActiveAt: friend.lastActiveAt ? new Date(friend.lastActiveAt) : undefined,
          });
        }
      }

      const requestsData = await AsyncStorage.getItem(STORAGE_KEYS.REQUESTS);
      if (requestsData) {
        this.pendingRequests = JSON.parse(requestsData).map((r: FriendRequest) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        }));
      }
    } catch {
      // Ignore storage errors
    }

    this.initialized = true;
  }

  /**
   * Get all friends
   */
  async getFriends(): Promise<readonly FriendProfile[]> {
    await this.initialize();
    return Array.from(this.friends.values())
      .filter(f => f.status === 'accepted')
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Get friend by ID
   */
  async getFriend(friendId: string): Promise<FriendProfile | null> {
    await this.initialize();
    return this.friends.get(friendId) ?? null;
  }

  /**
   * Get pending friend requests
   */
  async getPendingRequests(): Promise<readonly FriendRequest[]> {
    await this.initialize();
    return this.pendingRequests.filter(r => r.status === 'pending');
  }

  /**
   * Send friend request
   */
  async sendFriendRequest(
    fromUserId: string,
    fromUserName: string,
    toUserId: string,
    message?: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    // Check if already friends
    if (this.friends.has(toUserId)) {
      return { success: false, error: '이미 친구입니다' };
    }

    // Check friend limit
    if (this.friends.size >= MAX_FRIENDS) {
      return { success: false, error: '친구 목록이 가득 찼습니다' };
    }

    try {
      const request: FriendRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromUserId,
        fromUserName,
        toUserId,
        status: 'pending',
        createdAt: new Date(),
        message,
      };

      // Save to Firestore if available
      const db = loadFirestoreModule();
      if (db) {
        await db
          .collection(COLLECTIONS.FRIEND_REQUESTS)
          .doc(request.id)
          .set({
            ...request,
            createdAt: new Date(),
          });
      }

      // Also save locally
      this.pendingRequests.push(request);
      await this.saveRequests();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '요청 전송 실패',
      };
    }
  }

  /**
   * Accept friend request
   */
  async acceptFriendRequest(requestId: string): Promise<boolean> {
    await this.initialize();

    const request = this.pendingRequests.find(r => r.id === requestId);
    if (!request) return false;

    try {
      // Add friend
      const friend: FriendProfile = {
        id: request.fromUserId,
        displayName: request.fromUserName,
        favoriteStations: [],
        status: 'accepted',
        addedAt: new Date(),
      };

      this.friends.set(friend.id, friend);

      // Update request status
      const db = loadFirestoreModule();
      if (db) {
        await db
          .collection(COLLECTIONS.FRIEND_REQUESTS)
          .doc(requestId)
          .update({ status: 'accepted' });
      }

      // Remove from pending
      this.pendingRequests = this.pendingRequests.filter(r => r.id !== requestId);

      await this.saveFriends();
      await this.saveRequests();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reject friend request
   */
  async rejectFriendRequest(requestId: string): Promise<boolean> {
    await this.initialize();

    try {
      const db = loadFirestoreModule();
      if (db) {
        await db
          .collection(COLLECTIONS.FRIEND_REQUESTS)
          .doc(requestId)
          .update({ status: 'rejected' });
      }

      this.pendingRequests = this.pendingRequests.filter(r => r.id !== requestId);
      await this.saveRequests();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove friend
   */
  async removeFriend(friendId: string): Promise<boolean> {
    await this.initialize();

    if (!this.friends.has(friendId)) return false;

    try {
      this.friends.delete(friendId);
      await this.saveFriends();

      // Update Firestore if available
      const db = loadFirestoreModule();
      if (db) {
        await db
          .collection(COLLECTIONS.FRIENDS)
          .doc(friendId)
          .delete();
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Block user
   */
  async blockUser(userId: string): Promise<boolean> {
    await this.initialize();

    try {
      const existing = this.friends.get(userId);
      const blocked: FriendProfile = existing
        ? { ...existing, status: 'blocked' }
        : {
            id: userId,
            displayName: 'Unknown',
            favoriteStations: [],
            status: 'blocked',
            addedAt: new Date(),
          };

      this.friends.set(userId, blocked);
      await this.saveFriends();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create invitation code
   */
  async createInvitationCode(
    userId: string,
    maxUses = 5
  ): Promise<FriendInvitation | null> {
    try {
      const code = this.generateInvitationCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

      const invitation: FriendInvitation = {
        code,
        userId,
        expiresAt,
        maxUses,
        currentUses: 0,
      };

      const db = loadFirestoreModule();
      if (db) {
        await db
          .collection(COLLECTIONS.INVITATIONS)
          .doc(code)
          .set({
            ...invitation,
            expiresAt: expiresAt.toISOString(),
          });
      }

      return invitation;
    } catch {
      return null;
    }
  }

  /**
   * Use invitation code
   */
  async useInvitationCode(
    code: string,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string; friendId?: string }> {
    try {
      const db = loadFirestoreModule();
      if (!db) {
        return { success: false, error: 'Firestore를 사용할 수 없습니다' };
      }

      const doc = await db
        .collection(COLLECTIONS.INVITATIONS)
        .doc(code)
        .get();

      if (!doc.exists) {
        return { success: false, error: '유효하지 않은 초대 코드입니다' };
      }

      const data = doc.data() as Record<string, unknown> | undefined;
      if (!data) {
        return { success: false, error: '초대 정보를 불러올 수 없습니다' };
      }

      const invitation = {
        code: data.code as string,
        userId: data.userId as string,
        expiresAt: new Date(data.expiresAt as string),
        maxUses: data.maxUses as number,
        currentUses: data.currentUses as number,
      };

      // Check expiry
      if (invitation.expiresAt < new Date()) {
        return { success: false, error: '만료된 초대 코드입니다' };
      }

      // Check uses
      if (invitation.currentUses >= invitation.maxUses) {
        return { success: false, error: '사용 횟수를 초과한 초대 코드입니다' };
      }

      // Can't use own code
      if (invitation.userId === userId) {
        return { success: false, error: '자신의 초대 코드는 사용할 수 없습니다' };
      }

      // Send friend request
      const result = await this.sendFriendRequest(
        userId,
        userName,
        invitation.userId,
        '초대 코드를 통해 친구 추가를 요청합니다'
      );

      if (result.success) {
        // Increment uses
        await db
          .collection(COLLECTIONS.INVITATIONS)
          .doc(code)
          .update({
            currentUses: invitation.currentUses + 1,
          });

        return { success: true, friendId: invitation.userId };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '초대 코드 사용 실패',
      };
    }
  }

  /**
   * Share commute with friends
   */
  async shareCommute(
    userId: string,
    userName: string,
    fromStation: string,
    toStation: string,
    departureTime: string
  ): Promise<string | null> {
    try {
      const sharedCommute: Omit<SharedCommute, 'id'> = {
        userId,
        userName,
        fromStation,
        toStation,
        departureTime,
        isActive: true,
        sharedAt: new Date(),
      };

      const db = loadFirestoreModule();
      if (!db) {
        return null;
      }

      const docRef = await db
        .collection(COLLECTIONS.SHARED_COMMUTES)
        .add({
          ...sharedCommute,
          sharedAt: new Date().toISOString(),
        });

      return docRef.id;
    } catch {
      return null;
    }
  }

  /**
   * Get friends' shared commutes
   */
  async getFriendsSharedCommutes(): Promise<readonly SharedCommute[]> {
    await this.initialize();

    const friendIds = Array.from(this.friends.values())
      .filter(f => f.status === 'accepted')
      .map(f => f.id);

    if (friendIds.length === 0) return [];

    try {
      const db = loadFirestoreModule();
      if (!db) {
        return [];
      }

      const snapshot = await db
        .collection(COLLECTIONS.SHARED_COMMUTES)
        .where('userId', 'in', friendIds.slice(0, 10)) // Firestore limit
        .where('isActive', '==', true)
        .limit(20)
        .get();

      return snapshot.docs.map((doc: FirestoreDocument) => {
        const data = doc.data() ?? {};
        return {
          id: doc.id,
          userId: data.userId as string,
          userName: data.userName as string,
          fromStation: data.fromStation as string,
          toStation: data.toStation as string,
          departureTime: data.departureTime as string,
          isActive: data.isActive as boolean,
          sharedAt: data.sharedAt ? new Date(data.sharedAt as string) : new Date(),
        };
      }) as SharedCommute[];
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate invitation code
   */
  private generateInvitationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Save friends to storage
   */
  private async saveFriends(): Promise<void> {
    try {
      const friends = Array.from(this.friends.values());
      await AsyncStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(friends));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Save requests to storage
   */
  private async saveRequests(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.REQUESTS,
        JSON.stringify(this.pendingRequests)
      );
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const friendService = new FriendService();
export default friendService;
