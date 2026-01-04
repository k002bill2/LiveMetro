"use strict";
/**
 * LiveMetro Cloud Functions
 * Email notification service using SendGrid
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testEmailConfiguration = exports.sendEmailNotification = void 0;
const functions = __importStar(require("firebase-functions"));
const emailService_1 = require("./services/emailService");
const userService_1 = require("./services/userService");
const types_1 = require("./types");
/**
 * Callable function to send email notifications
 *
 * Usage from client:
 * const sendEmail = httpsCallable(functions, 'sendEmailNotification');
 * await sendEmail({ type: 'DELAY_ALERT', data: { ... } });
 */
exports.sendEmailNotification = functions
    .region('asia-northeast3') // Seoul region
    .https.onCall(async (data, context) => {
    // 1. Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = context.auth.uid;
    // 2. Validate request data
    if (!data || !data.type) {
        throw new functions.https.HttpsError('invalid-argument', '알림 타입이 필요합니다.');
    }
    // Validate notification type
    if (!Object.values(types_1.NotificationType).includes(data.type)) {
        throw new functions.https.HttpsError('invalid-argument', '유효하지 않은 알림 타입입니다.');
    }
    // 3. Check if email notifications are enabled for this user
    const isEnabled = await (0, userService_1.isEmailNotificationEnabled)(uid);
    if (!isEnabled) {
        return {
            success: false,
            error: '이메일 알림이 비활성화되어 있습니다.',
        };
    }
    // 4. Get user data
    const user = await (0, userService_1.getUserById)(uid);
    if (!user || !user.email) {
        return {
            success: false,
            error: '사용자 이메일을 찾을 수 없습니다.',
        };
    }
    // 5. Send email
    const result = await emailService_1.emailService.sendNotification(user.email, data.type, data.data || {});
    // 6. Log the result
    if (result.success) {
        console.log(`Email sent successfully to ${user.email} (type: ${data.type}, messageId: ${result.messageId})`);
    }
    else {
        console.error(`Email send failed for ${user.email} (type: ${data.type}, error: ${result.error})`);
    }
    return result;
});
/**
 * Test function to verify SendGrid configuration
 * Only callable by authenticated users
 */
exports.testEmailConfiguration = functions
    .region('asia-northeast3')
    .https.onCall(async (_data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
        const config = functions.config();
        const hasApiKey = !!((_a = config.sendgrid) === null || _a === void 0 ? void 0 : _a.apikey);
        const hasSender = !!((_b = config.sendgrid) === null || _b === void 0 ? void 0 : _b.sender);
        if (!hasApiKey) {
            return {
                configured: false,
                error: 'SendGrid API 키가 설정되지 않았습니다.',
            };
        }
        if (!hasSender) {
            return {
                configured: false,
                error: '발신자 이메일이 설정되지 않았습니다.',
            };
        }
        return { configured: true };
    }
    catch (error) {
        return {
            configured: false,
            error: error instanceof Error ? error.message : '설정 확인 실패',
        };
    }
});
//# sourceMappingURL=index.js.map