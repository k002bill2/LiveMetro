/**
 * QR Code Service for Certificate Verification
 * Generates and validates QR codes for delay certificates
 */

import { DelayCertificate } from '@/models/delayCertificate';

// ============================================================================
// Types
// ============================================================================

/**
 * QR code data structure
 */
export interface QrCodeData {
  readonly type: 'LIVEMETRO_CERT';
  readonly version: number;
  readonly certificateNumber: string;
  readonly checksum: string;
  readonly issuedAt: number;
}

/**
 * QR validation result
 */
export interface QrValidationResult {
  readonly isValid: boolean;
  readonly certificateNumber?: string;
  readonly error?: string;
  readonly checksumMatch: boolean;
}

/**
 * QR generation options
 */
export interface QrGenerationOptions {
  readonly size: number;
  readonly errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  readonly includeMetadata: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const QR_VERSION = 1;
const QR_PREFIX = 'LIVEMETRO:CERT:';
const DEFAULT_SIZE = 200;

// ============================================================================
// Service
// ============================================================================

class QrService {
  /**
   * Generate QR code data string for a certificate
   */
  generateQrData(certificate: DelayCertificate): string {
    const checksum = this.calculateChecksum(certificate);
    const timestamp = certificate.createdAt.getTime();

    const data: QrCodeData = {
      type: 'LIVEMETRO_CERT',
      version: QR_VERSION,
      certificateNumber: certificate.certificateNumber,
      checksum,
      issuedAt: timestamp,
    };

    // Encode as base64 JSON
    const jsonStr = JSON.stringify(data);
    const encoded = this.base64Encode(jsonStr);

    return `${QR_PREFIX}${encoded}`;
  }

  /**
   * Generate QR code URL using external API
   */
  getQrCodeUrl(
    certificate: DelayCertificate,
    options: Partial<QrGenerationOptions> = {}
  ): string {
    const size = options.size ?? DEFAULT_SIZE;
    const data = this.generateQrData(certificate);
    const encoded = encodeURIComponent(data);

    // Using free QR code API
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&ecc=${options.errorCorrectionLevel ?? 'M'}`;
  }

  /**
   * Validate QR code data
   */
  validateQrCode(qrData: string): QrValidationResult {
    try {
      // Check prefix
      if (!qrData.startsWith(QR_PREFIX)) {
        return {
          isValid: false,
          error: '유효하지 않은 QR 코드 형식입니다',
          checksumMatch: false,
        };
      }

      // Decode data
      const encoded = qrData.slice(QR_PREFIX.length);
      const jsonStr = this.base64Decode(encoded);
      const data = JSON.parse(jsonStr) as QrCodeData;

      // Validate structure
      if (data.type !== 'LIVEMETRO_CERT') {
        return {
          isValid: false,
          error: '유효하지 않은 증명서 타입입니다',
          checksumMatch: false,
        };
      }

      if (data.version > QR_VERSION) {
        return {
          isValid: false,
          error: '앱 업데이트가 필요합니다',
          checksumMatch: false,
        };
      }

      // Validate certificate number format
      if (!this.isValidCertificateNumber(data.certificateNumber)) {
        return {
          isValid: false,
          error: '유효하지 않은 증명서 번호입니다',
          checksumMatch: false,
        };
      }

      return {
        isValid: true,
        certificateNumber: data.certificateNumber,
        checksumMatch: true, // Would need certificate to fully validate
      };
    } catch {
      return {
        isValid: false,
        error: 'QR 코드를 읽을 수 없습니다',
        checksumMatch: false,
      };
    }
  }

  /**
   * Verify QR code against certificate
   */
  verifyQrWithCertificate(
    qrData: string,
    certificate: DelayCertificate
  ): boolean {
    const validation = this.validateQrCode(qrData);

    if (!validation.isValid) {
      return false;
    }

    if (validation.certificateNumber !== certificate.certificateNumber) {
      return false;
    }

    // Regenerate QR data and compare
    const expectedQrData = this.generateQrData(certificate);
    return qrData === expectedQrData;
  }

  /**
   * Extract certificate number from QR code
   */
  extractCertificateNumber(qrData: string): string | null {
    const validation = this.validateQrCode(qrData);
    return validation.isValid ? (validation.certificateNumber ?? null) : null;
  }

  /**
   * Generate simple verification URL
   */
  getVerificationUrl(certificateNumber: string): string {
    // This would point to a web verification page
    return `https://livemetro.app/verify/${certificateNumber}`;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate checksum for certificate
   */
  private calculateChecksum(certificate: DelayCertificate): string {
    const data = [
      certificate.certificateNumber,
      certificate.lineId,
      certificate.stationId,
      certificate.delayMinutes.toString(),
      certificate.date.getTime().toString(),
    ].join('|');

    // Simple hash (for demo - would use proper crypto in production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Validate certificate number format
   */
  private isValidCertificateNumber(number: string): boolean {
    // Format: LM-YYYYMMDD-XXXXXX
    const pattern = /^LM-\d{8}-[A-Z0-9]{6}$/;
    return pattern.test(number);
  }

  /**
   * Base64 encode
   */
  private base64Encode(str: string): string {
    // Simple implementation for React Native
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';

    for (let i = 0; i < str.length; i += 3) {
      const byte1 = str.charCodeAt(i);
      const byte2 = str.charCodeAt(i + 1);
      const byte3 = str.charCodeAt(i + 2);

      const enc1 = byte1 >> 2;
      const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
      const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
      const enc4 = byte3 & 63;

      if (isNaN(byte2)) {
        output += chars.charAt(enc1) + chars.charAt(enc2) + '==';
      } else if (isNaN(byte3)) {
        output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + '=';
      } else {
        output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
      }
    }

    return output;
  }

  /**
   * Base64 decode
   */
  private base64Decode(str: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';

    str = str.replace(/[^A-Za-z0-9+/=]/g, '');

    for (let i = 0; i < str.length; i += 4) {
      const enc1 = chars.indexOf(str.charAt(i));
      const enc2 = chars.indexOf(str.charAt(i + 1));
      const enc3 = chars.indexOf(str.charAt(i + 2));
      const enc4 = chars.indexOf(str.charAt(i + 3));

      const byte1 = (enc1 << 2) | (enc2 >> 4);
      const byte2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const byte3 = ((enc3 & 3) << 6) | enc4;

      output += String.fromCharCode(byte1);
      if (enc3 !== 64) output += String.fromCharCode(byte2);
      if (enc4 !== 64) output += String.fromCharCode(byte3);
    }

    return output;
  }
}

// ============================================================================
// Export
// ============================================================================

export const qrService = new QrService();
export default qrService;
