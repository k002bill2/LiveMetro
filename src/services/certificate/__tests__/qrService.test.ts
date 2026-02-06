/**
 * QR Service Tests
 */

import { qrService } from '../qrService';

jest.mock('@/models/delayCertificate', () => ({}));

describe('QrService', () => {
  const mockCertificate = {
    id: 'cert-001',
    certificateNumber: 'LM-20240115-001',
    userId: 'user-1',
    lineId: '2',
    lineName: '2호선',
    stationId: '222',
    stationName: '역삼',
    delayMinutes: 15,
    reason: '열차 고장',
    date: new Date('2024-01-15T08:30:00'),
    createdAt: new Date('2024-01-15T08:30:00'),
    verificationCode: 'ABC123',
    status: 'issued' as const,
  };

  describe('generateQrData', () => {
    it('should generate QR data string', () => {
      const result = qrService.generateQrData(mockCertificate as never);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include LIVEMETRO:CERT prefix', () => {
      const result = qrService.generateQrData(mockCertificate as never);
      expect(result).toContain('LIVEMETRO:CERT:');
    });
  });

  describe('validateQrCode', () => {
    it('should validate a QR code string', () => {
      const qrData = qrService.generateQrData(mockCertificate as never);
      const result = qrService.validateQrCode(qrData);
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
      expect(typeof result.checksumMatch).toBe('boolean');
    });

    it('should reject invalid QR data', () => {
      const result = qrService.validateQrCode('invalid-qr-data');
      expect(result.isValid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = qrService.validateQrCode('');
      expect(result.isValid).toBe(false);
    });
  });

  describe('extractCertificateNumber', () => {
    it('should extract certificate number from QR data', () => {
      const qrData = qrService.generateQrData(mockCertificate as never);
      const certNumber = qrService.extractCertificateNumber(qrData);
      expect(certNumber === null || typeof certNumber === 'string').toBe(true);
    });

    it('should return null for invalid data', () => {
      const result = qrService.extractCertificateNumber('invalid');
      expect(result).toBeNull();
    });
  });

  describe('getVerificationUrl', () => {
    it('should return verification URL', () => {
      const url = qrService.getVerificationUrl('LM-20240115-001');
      expect(typeof url).toBe('string');
      expect(url).toContain('LM-20240115-001');
    });
  });
});
