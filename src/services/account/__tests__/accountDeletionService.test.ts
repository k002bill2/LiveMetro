/**
 * accountDeletionService (client) tests.
 *
 * 핵심 계약: 서버 파기가 실패하면 로컬 데이터를 건드리지 않는다(계정이
 * 살아 있으므로 재시도 가능해야 한다). 성공 시에만 로컬을 파기하고,
 * 로컬 파기 실패는 성공 보고를 뒤집지 않는다.
 */

import { deleteAccountAndPurgeLocalData } from '@/services/account/accountDeletionService';

const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  __esModule: true,
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

jest.mock('@/services/firebase/config', () => ({
  __esModule: true,
  auth: { currentUser: null },
  firestore: {},
  functions: {},
}));

const mockPurgeLocalUserData = jest.fn();

jest.mock('@/services/account/localDataPurge', () => ({
  __esModule: true,
  purgeLocalUserData: (...args: unknown[]) => mockPurgeLocalUserData(...args),
}));

describe('deleteAccountAndPurgeLocalData', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockHttpsCallable.mockReturnValue((...args: unknown[]) => mockCallable(...args));
    mockCallable.mockResolvedValue({ data: { success: true } });
    mockPurgeLocalUserData.mockResolvedValue({ removedKeyCount: 12, hadFailure: false });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    errorSpy.mockRestore();
  });

  it('deleteAccount callable을 인자 없이 호출한다 (uid 인자 미전달)', async () => {
    await deleteAccountAndPurgeLocalData();

    expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'deleteAccount');
    expect(mockCallable).toHaveBeenCalledWith();
  });

  it('서버 파기 성공 시 로컬 데이터를 파기하고 성공을 반환한다', async () => {
    const result = await deleteAccountAndPurgeLocalData();

    expect(mockPurgeLocalUserData).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });

  it('서버 파기 실패 시 로컬 데이터를 건드리지 않는다', async () => {
    mockCallable.mockRejectedValue(
      Object.assign(new Error('internal'), { code: 'functions/internal' }),
    );

    const result = await deleteAccountAndPurgeLocalData();

    expect(mockPurgeLocalUserData).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('미인증 오류는 재로그인 안내 메시지로 매핑한다', async () => {
    mockCallable.mockRejectedValue(
      Object.assign(new Error('unauth'), { code: 'functions/unauthenticated' }),
    );

    const result = await deleteAccountAndPurgeLocalData();

    expect(result.error).toBe('로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.');
  });

  it('네트워크 계열 오류는 재시도 안내 메시지로 매핑한다', async () => {
    mockCallable.mockRejectedValue(
      Object.assign(new Error('unavailable'), { code: 'functions/unavailable' }),
    );

    const result = await deleteAccountAndPurgeLocalData();

    expect(result.error).toBe('네트워크가 불안정합니다. 잠시 후 다시 시도해 주세요.');
  });

  it('알 수 없는 오류는 기술 상세를 노출하지 않는다', async () => {
    mockCallable.mockRejectedValue(
      new Error('FirebaseError: internal step delayReportComments failed'),
    );

    const result = await deleteAccountAndPurgeLocalData();

    expect(result.error).toBe('계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    expect(result.error).not.toContain('delayReportComments');
  });

  it('로컬 파기 일부 실패는 성공 보고를 뒤집지 않는다', async () => {
    mockPurgeLocalUserData.mockResolvedValue({ removedKeyCount: 3, hadFailure: true });

    const result = await deleteAccountAndPurgeLocalData();

    expect(result).toEqual({ success: true });
  });
});
