/**
 * Certificate Services Module
 * PDF generation, QR codes, and certificate management
 */

// PDF Service
export {
  pdfService,
  type PdfGenerationResult,
  type PdfTemplateOptions,
} from './pdfService';

// QR Service
export {
  qrService,
  type QrCodeData,
  type QrValidationResult,
  type QrGenerationOptions,
} from './qrService';
