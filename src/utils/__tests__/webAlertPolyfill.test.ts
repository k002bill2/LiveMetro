import type { AlertButton } from 'react-native';

import { createWebAlert, type BrowserDialogs } from '../webAlertPolyfill';

describe('createWebAlert', () => {
  const makeDialogs = (
    confirmResult: boolean,
  ): { dialogs: BrowserDialogs; alert: jest.Mock; confirm: jest.Mock } => {
    const alert = jest.fn();
    const confirm = jest.fn(() => confirmResult);
    return { dialogs: { alert, confirm }, alert, confirm };
  };

  it('uses window.alert and joins title + message when there are no buttons', () => {
    const { dialogs, alert, confirm } = makeDialogs(true);

    createWebAlert(dialogs)('제목', '본문');

    expect(alert).toHaveBeenCalledWith('제목\n\n본문');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('omits the blank-line separator when message is undefined', () => {
    const { dialogs, alert } = makeDialogs(true);

    createWebAlert(dialogs)('제목만');

    expect(alert).toHaveBeenCalledWith('제목만');
  });

  it('shows an alert and fires the single button onPress for a 1-button alert', () => {
    const { dialogs, alert } = makeDialogs(true);
    const onPress = jest.fn();
    const buttons: AlertButton[] = [{ text: '확인', onPress }];

    createWebAlert(dialogs)('알림', '완료되었습니다', buttons);

    expect(alert).toHaveBeenCalledWith('알림\n\n완료되었습니다');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not throw when a 1-button alert has no onPress', () => {
    const { dialogs, alert } = makeDialogs(true);

    expect(() =>
      createWebAlert(dialogs)('알림', undefined, [{ text: '확인' }]),
    ).not.toThrow();
    expect(alert).toHaveBeenCalledWith('알림');
  });

  it('fires the non-cancel button onPress when the user confirms a 2-button dialog', () => {
    const { dialogs, confirm } = makeDialogs(true);
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const buttons: AlertButton[] = [
      { text: '취소', style: 'cancel', onPress: onCancel },
      { text: '삭제', style: 'destructive', onPress: onConfirm },
    ];

    createWebAlert(dialogs)('즐겨찾기 삭제', '삭제하시겠습니까?', buttons);

    expect(confirm).toHaveBeenCalledWith('즐겨찾기 삭제\n\n삭제하시겠습니까?');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('fires the cancel button onPress when the user dismisses a 2-button dialog', () => {
    const { dialogs } = makeDialogs(false);
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const buttons: AlertButton[] = [
      { text: '취소', style: 'cancel', onPress: onCancel },
      { text: '삭제', style: 'destructive', onPress: onConfirm },
    ];

    createWebAlert(dialogs)('즐겨찾기 삭제', '삭제하시겠습니까?', buttons);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('treats the first non-cancel button as confirm when cancel is listed second', () => {
    const { dialogs } = makeDialogs(true);
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const buttons: AlertButton[] = [
      { text: '확인', onPress: onConfirm },
      { text: '취소', style: 'cancel', onPress: onCancel },
    ];

    createWebAlert(dialogs)('확인', '진행할까요?', buttons);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('falls back to the last button as confirm when every button is cancel-styled', () => {
    const { dialogs } = makeDialogs(true);
    const first = jest.fn();
    const last = jest.fn();
    const buttons: AlertButton[] = [
      { text: '취소1', style: 'cancel', onPress: first },
      { text: '취소2', style: 'cancel', onPress: last },
    ];

    createWebAlert(dialogs)('제목', '본문', buttons);

    // No non-cancel button exists, so the last button is the confirm target.
    expect(last).toHaveBeenCalledTimes(1);
  });

  it('best-effort maps a 3-button dialog: confirm → first non-cancel, cancel → cancel', () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const onCancel = jest.fn();
    const buttons: AlertButton[] = [
      { text: '저장', onPress: onPrimary },
      { text: '저장 안 함', style: 'destructive', onPress: onSecondary },
      { text: '취소', style: 'cancel', onPress: onCancel },
    ];

    const confirmed = makeDialogs(true);
    createWebAlert(confirmed.dialogs)('나가기', undefined, buttons);
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    onPrimary.mockClear();
    const dismissed = makeDialogs(false);
    createWebAlert(dismissed.dialogs)('나가기', undefined, buttons);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPrimary).not.toHaveBeenCalled();
  });
});
