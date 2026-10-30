/**
 * Email Service - SendGrid Integration
 * Handles email sending for notifications
 */

import * as sgMail from '@sendgrid/mail';
import { defineString } from 'firebase-functions/params';
import {
  NotificationType,
  EmailNotificationData,
  EmailContent,
} from '../types';
import { sanitizeEmailData, SafeEmailFields } from './emailTemplateData';

// functions.config() was removed in firebase-functions v7. SendGrid settings are
// read from functions/.env via params (same pattern as KAKAO_APP_ID). Defaults
// are '' so a missing value never blocks `firebase deploy --non-interactive`;
// initialize() reports "not configured" instead.
export const sendgridApiKey = defineString('SENDGRID_API_KEY', { default: '' });
export const sendgridSender = defineString('SENDGRID_SENDER', { default: '' });

class EmailService {
  private initialized = false;
  private senderEmail = '';

  /**
   * Initialize SendGrid with API key from params (functions/.env)
   */
  initialize(): boolean {
    if (this.initialized) return true;

    try {
      const apiKey = sendgridApiKey.value();
      this.senderEmail = sendgridSender.value() || 'noreply@livemetro.app';

      if (!apiKey) {
        console.error('SendGrid API key not configured. Set SENDGRID_API_KEY in functions/.env');
        return false;
      }

      sgMail.setApiKey(apiKey);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize SendGrid:', error);
      return false;
    }
  }

  /**
   * Send email notification
   */
  async sendNotification(
    toEmail: string,
    type: NotificationType,
    data: EmailNotificationData
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.initialize()) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const content = this.buildEmailContent(type, data);

      const msg = {
        to: toEmail,
        from: {
          email: this.senderEmail,
          name: 'LiveMetro',
        },
        subject: content.subject,
        html: content.html,
      };

      const [response] = await sgMail.send(msg);

      return {
        success: true,
        messageId: response.headers['x-message-id'] as string,
      };
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Build email content based on notification type.
   * `data` is untyped at runtime (callable payload), so it is sanitized
   * (HTML-escaped / coerced) before reaching any template.
   */
  buildEmailContent(type: NotificationType, data: unknown): EmailContent {
    const fields = sanitizeEmailData(data);
    switch (type) {
      case NotificationType.DELAY_ALERT:
        return this.buildDelayAlertEmail(fields);
      case NotificationType.EMERGENCY_ALERT:
        return this.buildEmergencyAlertEmail(fields);
      case NotificationType.SERVICE_UPDATE:
        return this.buildServiceUpdateEmail(fields);
      default:
        return this.buildServiceUpdateEmail(fields);
    }
  }

  /**
   * Build delay alert email
   */
  private buildDelayAlertEmail(data: SafeEmailFields): EmailContent {
    const subject = `[LiveMetro] ${data.subjectLineName ?? '지하철'} 지연 알림`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: #2563eb; color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 24px; }
          .info-box { background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; }
          .info-row { margin: 8px 0; }
          .label { color: #6b7280; font-size: 14px; }
          .value { color: #111827; font-size: 16px; font-weight: 600; }
          .footer { padding: 16px 24px; background: #f9fafb; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚇 열차 지연 알림</h1>
          </div>
          <div class="content">
            <p>아래 노선에서 열차 지연이 발생했습니다.</p>
            <div class="info-box">
              <div class="info-row">
                <span class="label">노선</span>
                <p class="value">${data.lineName ?? '-'}</p>
              </div>
              <div class="info-row">
                <span class="label">역</span>
                <p class="value">${data.stationName ?? '-'}</p>
              </div>
              <div class="info-row">
                <span class="label">지연 시간</span>
                <p class="value">${data.delayMinutes}분</p>
              </div>
              ${data.reason !== null ? `
              <div class="info-row">
                <span class="label">지연 사유</span>
                <p class="value">${data.reason}</p>
              </div>
              ` : ''}
            </div>
          </div>
          <div class="footer">
            이 알림은 LiveMetro 앱 설정에서 비활성화할 수 있습니다.
          </div>
        </div>
      </body>
      </html>
    `;

    return { to: '', subject, html };
  }

  /**
   * Build emergency alert email
   */
  private buildEmergencyAlertEmail(data: SafeEmailFields): EmailContent {
    const subject = '[긴급] LiveMetro 서비스 알림';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: #dc2626; color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 24px; }
          .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
          .affected-lines { margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 8px; }
          .footer { padding: 16px 24px; background: #f9fafb; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 긴급 알림</h1>
          </div>
          <div class="content">
            <div class="alert-box">
              <p style="margin: 0; font-size: 16px; color: #991b1b;">${data.message ?? '서비스에 문제가 발생했습니다.'}</p>
            </div>
            ${data.affectedLines.length > 0 ? `
            <div class="affected-lines">
              <strong>영향 노선:</strong> ${data.affectedLines.join(', ')}
            </div>
            ` : ''}
          </div>
          <div class="footer">
            발송 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          </div>
        </div>
      </body>
      </html>
    `;

    return { to: '', subject, html };
  }

  /**
   * Build service update email
   */
  private buildServiceUpdateEmail(data: SafeEmailFields): EmailContent {
    const subject = '[LiveMetro] 서비스 안내';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: #2563eb; color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 24px; }
          .message-box { background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0; }
          .footer { padding: 16px 24px; background: #f9fafb; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📢 서비스 안내</h1>
          </div>
          <div class="content">
            <div class="message-box">
              <p style="margin: 0; font-size: 16px;">${data.message ?? 'LiveMetro에서 알려드립니다.'}</p>
            </div>
          </div>
          <div class="footer">
            이 알림은 LiveMetro 앱 설정에서 비활성화할 수 있습니다.
          </div>
        </div>
      </body>
      </html>
    `;

    return { to: '', subject, html };
  }
}

// Export singleton instance
export const emailService = new EmailService();
