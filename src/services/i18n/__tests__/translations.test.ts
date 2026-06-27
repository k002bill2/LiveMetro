import { translations } from '../translations';

describe('translations', () => {
  it('exposes settings as the bottom tab label instead of me', () => {
    expect(translations.ko.navigation).toEqual(
      expect.objectContaining({
        settings: '설정',
      }),
    );
    expect(translations.en.navigation).toEqual(
      expect.objectContaining({
        settings: 'Settings',
      }),
    );

    expect(translations.ko.navigation).not.toHaveProperty('me');
    expect(translations.en.navigation).not.toHaveProperty('me');
  });
});
