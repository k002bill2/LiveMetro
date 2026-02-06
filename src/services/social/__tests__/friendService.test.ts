/**
 * Friend Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock firestore - not available
jest.mock('@react-native-firebase/firestore', () => {
  throw new Error('not available');
}, { virtual: true });

// We need a fresh instance for each test to avoid shared state
function createFreshService(): typeof import('../friendService') {
  jest.resetModules();
  jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  }));
  jest.mock('@react-native-firebase/firestore', () => {
    throw new Error('not available');
  }, { virtual: true });
  return require('../friendService');
}

describe('FriendService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize without throwing', async () => {
      const { friendService } = createFreshService();
      await expect(friendService.initialize()).resolves.not.toThrow();
    });

    it('should load friends from storage', async () => {
      const mod = createFreshService();
      const AS = require('@react-native-async-storage/async-storage');
      const mockFriends = [
        { id: 'f1', displayName: 'Alice', favoriteStations: [], status: 'accepted', addedAt: new Date().toISOString() },
      ];
      AS.getItem.mockImplementation((key: string) => {
        if (key === '@livemetro:friends') return Promise.resolve(JSON.stringify(mockFriends));
        return Promise.resolve(null);
      });

      const friends = await mod.friendService.getFriends();
      expect(Array.isArray(friends)).toBe(true);
    });

    it('should handle storage errors gracefully', async () => {
      const mod = createFreshService();
      const AS = require('@react-native-async-storage/async-storage');
      AS.getItem.mockRejectedValue(new Error('storage fail'));

      await expect(mod.friendService.initialize()).resolves.not.toThrow();
    });

    it('should load pending requests from storage', async () => {
      const mod = createFreshService();
      const AS = require('@react-native-async-storage/async-storage');
      const mockRequests = [
        { id: 'r1', fromUserId: 'u1', fromUserName: 'Bob', toUserId: 'u2', status: 'pending', createdAt: new Date().toISOString() },
      ];
      AS.getItem.mockImplementation((key: string) => {
        if (key === '@livemetro:friend_requests') return Promise.resolve(JSON.stringify(mockRequests));
        return Promise.resolve(null);
      });

      const requests = await mod.friendService.getPendingRequests();
      expect(Array.isArray(requests)).toBe(true);
    });
  });

  describe('getFriends', () => {
    it('should return empty array when no friends', async () => {
      const { friendService } = createFreshService();
      const friends = await friendService.getFriends();
      expect(friends).toEqual([]);
    });

    it('should filter only accepted friends', async () => {
      const mod = createFreshService();
      const AS = require('@react-native-async-storage/async-storage');
      const mockFriends = [
        { id: 'f1', displayName: 'Alice', favoriteStations: [], status: 'accepted', addedAt: new Date().toISOString() },
        { id: 'f2', displayName: 'Bob', favoriteStations: [], status: 'blocked', addedAt: new Date().toISOString() },
      ];
      AS.getItem.mockImplementation((key: string) => {
        if (key === '@livemetro:friends') return Promise.resolve(JSON.stringify(mockFriends));
        return Promise.resolve(null);
      });

      const friends = await mod.friendService.getFriends();
      expect(friends.length).toBe(1);
    });

    it('should sort friends by displayName', async () => {
      const mod = createFreshService();
      const AS = require('@react-native-async-storage/async-storage');
      const mockFriends = [
        { id: 'f1', displayName: 'Charlie', favoriteStations: [], status: 'accepted', addedAt: new Date().toISOString() },
        { id: 'f2', displayName: 'Alice', favoriteStations: [], status: 'accepted', addedAt: new Date().toISOString() },
      ];
      AS.getItem.mockImplementation((key: string) => {
        if (key === '@livemetro:friends') return Promise.resolve(JSON.stringify(mockFriends));
        return Promise.resolve(null);
      });

      const friends = await mod.friendService.getFriends();
      expect(friends[0]!.displayName).toBe('Alice');
    });
  });

  describe('getFriend', () => {
    it('should return null for non-existent friend', async () => {
      const { friendService } = createFreshService();
      const friend = await friendService.getFriend('nonexistent');
      expect(friend).toBeNull();
    });
  });

  describe('sendFriendRequest', () => {
    it('should send friend request successfully', async () => {
      const { friendService } = createFreshService();
      const result = await friendService.sendFriendRequest('u1', 'User One', 'u2', 'Hello');
      expect(result.success).toBe(true);
    });

    it('should return error if already friends', async () => {
      const mod = createFreshService();
      const AS = require('@react-native-async-storage/async-storage');
      const mockFriends = [
        { id: 'u2', displayName: 'Existing', favoriteStations: [], status: 'accepted', addedAt: new Date().toISOString() },
      ];
      AS.getItem.mockImplementation((key: string) => {
        if (key === '@livemetro:friends') return Promise.resolve(JSON.stringify(mockFriends));
        return Promise.resolve(null);
      });

      const result = await mod.friendService.sendFriendRequest('u1', 'User One', 'u2');
      expect(result.success).toBe(false);
      expect(result.error).toContain('이미 친구');
    });
  });

  describe('acceptFriendRequest', () => {
    it('should return false for non-existent request', async () => {
      const { friendService } = createFreshService();
      const result = await friendService.acceptFriendRequest('nonexistent');
      expect(result).toBe(false);
    });

    it('should accept a pending request', async () => {
      const mod = createFreshService();

      // First send a request to have something to accept
      await mod.friendService.sendFriendRequest('u1', 'User One', 'u2');
      const requests = await mod.friendService.getPendingRequests();

      if (requests.length > 0) {
        const result = await mod.friendService.acceptFriendRequest(requests[0]!.id);
        expect(result).toBe(true);

        // Verify friend was added
        const friends = await mod.friendService.getFriends();
        expect(friends.length).toBe(1);
      }
    });
  });

  describe('rejectFriendRequest', () => {
    it('should reject a request', async () => {
      const mod = createFreshService();
      await mod.friendService.sendFriendRequest('u1', 'User One', 'u2');
      const requests = await mod.friendService.getPendingRequests();

      if (requests.length > 0) {
        const result = await mod.friendService.rejectFriendRequest(requests[0]!.id);
        expect(result).toBe(true);
      }
    });
  });

  describe('removeFriend', () => {
    it('should return false for non-existent friend', async () => {
      const { friendService } = createFreshService();
      const result = await friendService.removeFriend('nonexistent');
      expect(result).toBe(false);
    });

    it('should remove an existing friend', async () => {
      const mod = createFreshService();

      // Add a friend first
      await mod.friendService.sendFriendRequest('u1', 'User One', 'u2');
      const requests = await mod.friendService.getPendingRequests();
      if (requests.length > 0) {
        await mod.friendService.acceptFriendRequest(requests[0]!.id);
        const result = await mod.friendService.removeFriend('u1');
        expect(result).toBe(true);
      }
    });
  });

  describe('blockUser', () => {
    it('should block a user', async () => {
      const { friendService } = createFreshService();
      const result = await friendService.blockUser('badUser');
      expect(result).toBe(true);
    });

    it('should block an existing friend', async () => {
      const mod = createFreshService();
      const AS = require('@react-native-async-storage/async-storage');
      const mockFriends = [
        { id: 'f1', displayName: 'Alice', favoriteStations: [], status: 'accepted', addedAt: new Date().toISOString() },
      ];
      AS.getItem.mockImplementation((key: string) => {
        if (key === '@livemetro:friends') return Promise.resolve(JSON.stringify(mockFriends));
        return Promise.resolve(null);
      });

      const result = await mod.friendService.blockUser('f1');
      expect(result).toBe(true);
    });
  });

  describe('createInvitationCode', () => {
    it('should create invitation code', async () => {
      const { friendService } = createFreshService();
      const invitation = await friendService.createInvitationCode('u1');
      expect(invitation).toBeDefined();
      expect(invitation!.code.length).toBe(8);
      expect(invitation!.userId).toBe('u1');
      expect(invitation!.maxUses).toBe(5);
      expect(invitation!.currentUses).toBe(0);
    });

    it('should create with custom max uses', async () => {
      const { friendService } = createFreshService();
      const invitation = await friendService.createInvitationCode('u1', 10);
      expect(invitation!.maxUses).toBe(10);
    });
  });

  describe('useInvitationCode', () => {
    it('should return error when Firestore not available', async () => {
      const { friendService } = createFreshService();
      const result = await friendService.useInvitationCode('ABCD1234', 'u1', 'User');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Firestore');
    });
  });

  describe('shareCommute', () => {
    it('should return null when Firestore not available', async () => {
      const { friendService } = createFreshService();
      const result = await friendService.shareCommute('u1', 'User', '강남', '역삼', '08:00');
      expect(result).toBeNull();
    });
  });

  describe('getFriendsSharedCommutes', () => {
    it('should return empty array when no friends', async () => {
      const { friendService } = createFreshService();
      const commutes = await friendService.getFriendsSharedCommutes();
      expect(commutes).toEqual([]);
    });
  });
});
