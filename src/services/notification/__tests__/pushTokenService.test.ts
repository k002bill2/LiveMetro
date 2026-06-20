/**
 * pushTokenService Tests
 */
import * as Notifications from 'expo-notifications';
import { setDoc, deleteDoc } from 'firebase/firestore';
import { notificationService } from '../notificationService';
import { pushTokenService } from '../pushTokenService';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _col, id) => ({ id })),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'ts'),
}));
jest.mock('@/services/firebase/config', () => ({ firestore: {} }));
jest.mock('../notificationService', () => ({
  notificationService: { requestPermissions: jest.fn() },
}));

describe('pushTokenService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers the Expo token + lines when permission is granted', async () => {
    (notificationService.requestPermissions as jest.Mock).mockResolvedValue({ granted: true });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExpoTok[abc]' });

    await pushTokenService.registerPushToken('user-1', ['2', '7']);

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ uid: 'user-1', token: 'ExpoTok[abc]', lines: ['2', '7'] }),
    );
  });

  it('does NOT write when permission is denied', async () => {
    (notificationService.requestPermissions as jest.Mock).mockResolvedValue({ granted: false });
    await pushTokenService.registerPushToken('user-1', ['2']);
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('unregister deletes the token doc', async () => {
    await pushTokenService.unregisterPushToken('user-1');
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
  });

  it('swallows token fetch errors (no throw)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    (notificationService.requestPermissions as jest.Mock).mockResolvedValue({ granted: true });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error('no creds'));
    await expect(pushTokenService.registerPushToken('user-1', ['2'])).resolves.toBeUndefined();
    expect(setDoc).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
