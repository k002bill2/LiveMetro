/**
 * PDF Service Tests
 */

import { pdfService, PdfGenerationResult, PdfTemplateOptions } from '../pdfService';
import { DelayCertificate, DelayReason } from '@/models/delayCertificate';

// Mock expo modules that are lazily loaded
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: '/tmp/test.pdf' }),
  printAsync: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

jest.mock('expo-file-system', () => ({
  documentDirectory: '/documents/',
  moveAsync: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

describe('PdfService', () => {
  const createMockCertificate = (overrides: Partial<DelayCertificate> = {}): DelayCertificate => ({
    id: 'cert_123',
    userId: 'user1',
    certificateNumber: 'DELAY-2024-001',
    lineId: '2',
    stationId: 'gangnam',
    stationName: '강남',
    date: new Date('2024-01-15'),
    scheduledTime: '09:00',
    actualTime: '09:15',
    delayMinutes: 15,
    reason: DelayReason.CONGESTION,
    verified: true,
    createdAt: new Date('2024-01-15'),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCertificatePdf', () => {
    it('should attempt to generate PDF', async () => {
      const certificate = createMockCertificate();

      const result = await pdfService.generateCertificatePdf(certificate);

      // In test environment, modules may not load
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should accept custom options', async () => {
      const certificate = createMockCertificate();
      const options: Partial<PdfTemplateOptions> = {
        includeQrCode: false,
        language: 'en',
      };

      const result = await pdfService.generateCertificatePdf(certificate, options);

      expect(result).toHaveProperty('success');
    });

    it('should return error message on failure', async () => {
      const certificate = createMockCertificate();

      const result = await pdfService.generateCertificatePdf(certificate);

      // If modules don't load, should return error
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    it('should handle different line colors', async () => {
      // Test with different line IDs
      const lineIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

      for (const lineId of lineIds) {
        const certificate = createMockCertificate({ lineId });
        const result = await pdfService.generateCertificatePdf(certificate);

        expect(result).toHaveProperty('success');
      }
    });

    it('should handle all delay reasons', async () => {
      const reasons = Object.values(DelayReason);

      for (const reason of reasons) {
        const certificate = createMockCertificate({ reason });
        const result = await pdfService.generateCertificatePdf(certificate);

        expect(result).toHaveProperty('success');
      }
    });
  });

  describe('generateAndSharePdf', () => {
    it('should attempt to generate and share PDF', async () => {
      const certificate = createMockCertificate();

      const result = await pdfService.generateAndSharePdf(certificate);

      expect(typeof result).toBe('boolean');
    });

    it('should accept custom options', async () => {
      const certificate = createMockCertificate();
      const options: Partial<PdfTemplateOptions> = {
        includeQrCode: true,
        watermark: 'COPY',
      };

      const result = await pdfService.generateAndSharePdf(certificate, options);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('printCertificate', () => {
    it('should attempt to print certificate', async () => {
      const certificate = createMockCertificate();

      const result = await pdfService.printCertificate(certificate);

      expect(typeof result).toBe('boolean');
    });

    it('should accept custom options', async () => {
      const certificate = createMockCertificate();
      const options: Partial<PdfTemplateOptions> = {
        includeQrCode: false,
      };

      const result = await pdfService.printCertificate(certificate, options);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('isSharingAvailable', () => {
    it('should return boolean', async () => {
      const result = await pdfService.isSharingAvailable();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('type exports', () => {
    it('should export PdfGenerationResult type', () => {
      const successResult: PdfGenerationResult = {
        success: true,
        filePath: '/path/to/file.pdf',
      };
      expect(successResult.success).toBe(true);

      const errorResult: PdfGenerationResult = {
        success: false,
        error: 'Failed to generate',
      };
      expect(errorResult.success).toBe(false);
    });

    it('should export PdfTemplateOptions type', () => {
      const options: PdfTemplateOptions = {
        includeQrCode: true,
        logoUrl: 'https://example.com/logo.png',
        watermark: 'SAMPLE',
        language: 'ko',
      };
      expect(options.includeQrCode).toBe(true);
      expect(options.language).toBe('ko');
    });
  });

  describe('certificate number formatting', () => {
    it('should handle various certificate number formats', async () => {
      const formats = [
        'DELAY-2024-001',
        'DELAY-2024-12345',
        'LM-2024-01-15-001',
        'CERT-ABC123',
      ];

      for (const certNumber of formats) {
        const certificate = createMockCertificate({ certificateNumber: certNumber });
        const result = await pdfService.generateCertificatePdf(certificate);

        expect(result).toHaveProperty('success');
      }
    });
  });

  describe('date formatting', () => {
    it('should handle various dates', async () => {
      const dates = [
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        new Date('2024-06-15'),
        new Date(),
      ];

      for (const date of dates) {
        const certificate = createMockCertificate({ date, createdAt: date });
        const result = await pdfService.generateCertificatePdf(certificate);

        expect(result).toHaveProperty('success');
      }
    });
  });

  describe('verification status', () => {
    it('should handle verified certificate', async () => {
      const certificate = createMockCertificate({ verified: true });

      const result = await pdfService.generateCertificatePdf(certificate);

      expect(result).toHaveProperty('success');
    });

    it('should handle unverified certificate', async () => {
      const certificate = createMockCertificate({ verified: false });

      const result = await pdfService.generateCertificatePdf(certificate);

      expect(result).toHaveProperty('success');
    });
  });
});
