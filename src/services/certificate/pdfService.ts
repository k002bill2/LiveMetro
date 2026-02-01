/**
 * PDF Generation Service for Delay Certificates
 * Generates and shares PDF certificates using expo-print
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { DelayCertificate, DelayReason } from '@/models/delayCertificate';

// ============================================================================
// Types
// ============================================================================

/**
 * PDF generation result
 */
export interface PdfGenerationResult {
  readonly success: boolean;
  readonly filePath?: string;
  readonly error?: string;
}

/**
 * PDF template options
 */
export interface PdfTemplateOptions {
  readonly includeQrCode: boolean;
  readonly logoUrl?: string;
  readonly watermark?: string;
  readonly language: 'ko' | 'en';
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: PdfTemplateOptions = {
  includeQrCode: true,
  language: 'ko',
};

const LINE_COLORS: Record<string, string> = {
  '1': '#0052A4',
  '2': '#00A84D',
  '3': '#EF7C1C',
  '4': '#00A5DE',
  '5': '#996CAC',
  '6': '#CD7C2F',
  '7': '#747F00',
  '8': '#EA545D',
  '9': '#BDB092',
};

const REASON_LABELS_KO: Record<DelayReason, string> = {
  [DelayReason.SIGNAL_FAILURE]: '신호 장애',
  [DelayReason.MECHANICAL_FAILURE]: '차량 고장',
  [DelayReason.PASSENGER_INCIDENT]: '승객 관련 사고',
  [DelayReason.DOOR_ISSUE]: '출입문 장애',
  [DelayReason.CONGESTION]: '혼잡',
  [DelayReason.WEATHER]: '기상 악화',
  [DelayReason.OTHER]: '기타',
};

// ============================================================================
// Service
// ============================================================================

class PdfService {
  /**
   * Generate PDF for a delay certificate
   */
  async generateCertificatePdf(
    certificate: DelayCertificate,
    options: Partial<PdfTemplateOptions> = {}
  ): Promise<PdfGenerationResult> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    try {
      const html = this.generateHtml(certificate, mergedOptions);
      const { uri } = await Print.printToFileAsync({ html });

      // Rename file with meaningful name
      const fileName = `delay_certificate_${certificate.certificateNumber}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.moveAsync({
        from: uri,
        to: newPath,
      });

      return {
        success: true,
        filePath: newPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * Generate and share PDF
   */
  async generateAndSharePdf(
    certificate: DelayCertificate,
    options: Partial<PdfTemplateOptions> = {}
  ): Promise<boolean> {
    const result = await this.generateCertificatePdf(certificate, options);

    if (!result.success || !result.filePath) {
      return false;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log('Sharing is not available on this device');
        return false;
      }

      await Sharing.shareAsync(result.filePath, {
        mimeType: 'application/pdf',
        dialogTitle: '지연 증명서 공유',
        UTI: 'com.adobe.pdf',
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Print PDF directly
   */
  async printCertificate(
    certificate: DelayCertificate,
    options: Partial<PdfTemplateOptions> = {}
  ): Promise<boolean> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    try {
      const html = this.generateHtml(certificate, mergedOptions);
      await Print.printAsync({ html });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if sharing is available
   */
  async isSharingAvailable(): Promise<boolean> {
    return Sharing.isAvailableAsync();
  }

  /**
   * Generate HTML for the certificate
   */
  private generateHtml(
    certificate: DelayCertificate,
    options: PdfTemplateOptions
  ): string {
    const lineColor = LINE_COLORS[certificate.lineId] || '#333333';
    const reasonLabel = REASON_LABELS_KO[certificate.reason];
    const dateStr = this.formatDate(certificate.date);
    const createdAtStr = this.formatDate(certificate.createdAt);

    const qrCodeSection = options.includeQrCode
      ? this.generateQrCodeSection(certificate.certificateNumber)
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>지하철 지연 증명서</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif;
      background: #ffffff;
      color: #333;
      padding: 40px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      border: 3px solid ${lineColor};
      border-radius: 12px;
      overflow: hidden;
    }
    .header {
      background: ${lineColor};
      color: white;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 32px;
    }
    .certificate-number {
      text-align: center;
      margin-bottom: 24px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .certificate-number .label {
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    .certificate-number .value {
      font-size: 18px;
      font-weight: bold;
      font-family: monospace;
      color: ${lineColor};
    }
    .info-section {
      margin-bottom: 24px;
    }
    .info-section h2 {
      font-size: 14px;
      color: ${lineColor};
      border-bottom: 2px solid ${lineColor};
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-row .label {
      color: #666;
      font-size: 14px;
    }
    .info-row .value {
      font-weight: 500;
      font-size: 14px;
    }
    .delay-highlight {
      background: #fff3e0;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      text-align: center;
    }
    .delay-highlight .minutes {
      font-size: 48px;
      font-weight: bold;
      color: ${lineColor};
    }
    .delay-highlight .unit {
      font-size: 18px;
      color: #666;
    }
    .qr-section {
      text-align: center;
      padding: 20px;
      border-top: 1px dashed #ddd;
      margin-top: 24px;
    }
    .qr-section img {
      width: 120px;
      height: 120px;
    }
    .qr-section .hint {
      font-size: 11px;
      color: #999;
      margin-top: 8px;
    }
    .footer {
      text-align: center;
      padding: 16px;
      background: #f9f9f9;
      font-size: 11px;
      color: #999;
    }
    .warning {
      font-size: 12px;
      color: #f44336;
      text-align: center;
      margin-top: 16px;
      padding: 12px;
      border: 1px solid #ffcdd2;
      border-radius: 8px;
      background: #fff8f8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>지하철 지연 증명서</h1>
      <div class="subtitle">Seoul Metro Delay Certificate</div>
    </div>

    <div class="content">
      <div class="certificate-number">
        <div class="label">증명서 번호</div>
        <div class="value">${certificate.certificateNumber}</div>
      </div>

      <div class="delay-highlight">
        <div class="minutes">${certificate.delayMinutes}</div>
        <div class="unit">분 지연</div>
      </div>

      <div class="info-section">
        <h2>지연 정보</h2>
        <div class="info-row">
          <span class="label">일자</span>
          <span class="value">${dateStr}</span>
        </div>
        <div class="info-row">
          <span class="label">노선</span>
          <span class="value">${certificate.lineId}호선</span>
        </div>
        <div class="info-row">
          <span class="label">역명</span>
          <span class="value">${certificate.stationName}역</span>
        </div>
        <div class="info-row">
          <span class="label">예정 시간</span>
          <span class="value">${certificate.scheduledTime}</span>
        </div>
        <div class="info-row">
          <span class="label">실제 시간</span>
          <span class="value">${certificate.actualTime}</span>
        </div>
        <div class="info-row">
          <span class="label">지연 사유</span>
          <span class="value">${reasonLabel}</span>
        </div>
      </div>

      <div class="info-section">
        <h2>발급 정보</h2>
        <div class="info-row">
          <span class="label">발급일</span>
          <span class="value">${createdAtStr}</span>
        </div>
        <div class="info-row">
          <span class="label">발급 앱</span>
          <span class="value">LiveMetro</span>
        </div>
        <div class="info-row">
          <span class="label">검증 상태</span>
          <span class="value">${certificate.verified ? '검증됨' : '미검증'}</span>
        </div>
      </div>

      ${qrCodeSection}

      <div class="warning">
        ※ 본 증명서는 참고용이며, 공식 지연증명서는 또타지하철 앱에서 발급받으실 수 있습니다.
      </div>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} LiveMetro | 서울교통공사 지연 정보 기반
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate QR code section HTML
   */
  private generateQrCodeSection(certificateNumber: string): string {
    // QR code API endpoint (using a free QR code service)
    const qrData = encodeURIComponent(`LIVEMETRO:CERT:${certificateNumber}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;

    return `
      <div class="qr-section">
        <img src="${qrUrl}" alt="QR Code">
        <div class="hint">QR 코드를 스캔하여 증명서를 검증하세요</div>
      </div>
    `;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const pdfService = new PdfService();
export default pdfService;
