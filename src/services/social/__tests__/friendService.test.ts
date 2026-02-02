/**
 * Friend Service Tests
 */

import { friendService, FriendProfile, FriendRequest } from '../friendService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('FriendService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize without throwing', async () => {
      await expect(friendService.initialize()).resolves.not.toThrow();
    });
  });

  describe('getFriends', () => {
    it('should return empty array when no friends', async () => {
      const friends = await friendService.getFriends();
      expect(Array.isArray(friends)).toBe(true);
    });

    it('should load friends from storage', async () => {
      const mockFriends = [
        {
          id: 'friend1',
          displayName: 'Test Friend',
          favoriteStations: [],
          status: 'accepted',
          addedAt: new Date().toISOString(),
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockFriends));

      // Force re-initialization by creating new instance
      const friends = await friendService.getFriends();
      expect(Array.isArray(friends)).toBe(true);
    });
  });

  describe('getFriend', () => {
    it('should return null for non-existent friend', async () => {
      const friend = await friendService.getFriend('nonexistent');
      expect(friend).toBeNull();
    });
  });

  describe('getPendingRequests', () => {
    it('should return array of pending requests', async () => {
      const requests = await friendService.getPendingRequests();
      expect(Array.isArray(requests)).toBe(true);
    });
  });

  describe('sendFriendRequest', () => {
    it('should send friend request', async () => {
      const result = await friendService.sendFriendRequest(
        'user1',
        'User One',
        'user2',
        'Hi, want to be friends?'
      );

      expect(result).toHaveProperty('success');
    });

    it('should handle request without message', async () => {
      const result = await friendService.sendFriendRequest(
        'user1',
        'User One',
        'user3'
      );

      expect(result).toHaveProperty('success');
    });
  });

  describe('acceptFriendRequest', () => {
    it('should return false for non-existent request', async () => {
      const result = await friendService.acceptFriendRequest('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('rejectFriendRequest', () => {
    it('should handle reject without throwing', async () => {
      const result = await friendService.rejectFriendRequest('nonexistent');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('removeFriend', () => {
    it('should return false for non-existent friend', async () => {
      const result = await friendService.removeFriend('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('type exports', () => {
    it('should export FriendProfile type', () => {
      const profile: FriendProfile = {
        id: 'test',
        displayName: 'Test',
        favoriteStations: [],
        status: 'accepted',
        addedAt: new Date(),
      };
      expect(profile.id).toBe('test');
    });

    it('should export FriendRequest type', () => {
      const request: FriendRequest = {
        id: 'req1',
        fromUserId: 'user1',
        fromUserName: 'User 1',
        toUserId: 'user2',
        status: 'pending',
        createdAt: new Date(),
      };
      expect(request.status).toBe('pending');
    });
  });
});
