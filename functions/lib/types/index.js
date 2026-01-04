"use strict";
/**
 * Type definitions for LiveMetro Cloud Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationType = void 0;
// Email notification types (matching frontend NotificationType)
var NotificationType;
(function (NotificationType) {
    NotificationType["DELAY_ALERT"] = "DELAY_ALERT";
    NotificationType["EMERGENCY_ALERT"] = "EMERGENCY_ALERT";
    NotificationType["SERVICE_UPDATE"] = "SERVICE_UPDATE";
    NotificationType["ARRIVAL_REMINDER"] = "ARRIVAL_REMINDER";
    NotificationType["COMMUTE_REMINDER"] = "COMMUTE_REMINDER";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
//# sourceMappingURL=index.js.map