import { DelayCertificate, DelayReason } from '@/models/delayCertificate';

const createMockCertificate = (): DelayCertificate => ({
  id: 'cert-native-missing',
  userId: 'user1',
  certificateNumber: 'DELAY-2026-001',
  lineId: '2',
  stationId: 'gangnam',
  stationName: '강남',
  date: new Date('2026-06-27T09:00:00+09:00'),
  scheduledTime: '09:00',
  actualTime: '09:15',
  delayMinutes: 15,
  reason: DelayReason.CONGESTION,
  verified: true,
  createdAt: new Date('2026-06-27T09:30:00+09:00'),
  updatedAt: new Date('2026-06-27T09:30:00+09:00'),
});

describe('PdfService native module availability', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('does not require expo-print when ExpoPrint is not registered in the native proxy', async () => {
    const expoPrintRequire = jest.fn(() => {
      throw new Error("Cannot find native module 'ExpoPrint'");
    });

    jest.doMock('expo-modules-core', () => ({
      NativeModulesProxy: {},
    }));
    jest.doMock('expo-print', expoPrintRequire);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pdfService } = require('../pdfService') as typeof import('../pdfService');
    const result = await pdfService.generateCertificatePdf(createMockCertificate());

    expect(result).toEqual({
      success: false,
      error: 'PDF 모듈을 로드할 수 없습니다.',
    });
    expect(expoPrintRequire).not.toHaveBeenCalled();
  });
});
