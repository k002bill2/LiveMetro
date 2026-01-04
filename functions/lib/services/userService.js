"use strict";
/**
 * User Service - Firestore Integration
 * Handles user data retrieval for email notifications
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
exports.getUserById = getUserById;
exports.isEmailNotificationEnabled = isEmailNotificationEnabled;
exports.getUserEmailIfEnabled = getUserEmailIfEnabled;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Get user data by UID
 */
async function getUserById(uid) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            console.log(`User not found: ${uid}`);
            return null;
        }
        const data = userDoc.data();
        if (!data) {
            return null;
        }
        return {
            id: userDoc.id,
            email: data.email || '',
            displayName: data.displayName || '',
            isAnonymous: data.isAnonymous || false,
            preferences: {
                notificationSettings: {
                    enabled: (_c = (_b = (_a = data.preferences) === null || _a === void 0 ? void 0 : _a.notificationSettings) === null || _b === void 0 ? void 0 : _b.enabled) !== null && _c !== void 0 ? _c : true,
                    emailNotifications: (_f = (_e = (_d = data.preferences) === null || _d === void 0 ? void 0 : _d.notificationSettings) === null || _e === void 0 ? void 0 : _e.emailNotifications) !== null && _f !== void 0 ? _f : false,
                    pushNotifications: (_j = (_h = (_g = data.preferences) === null || _g === void 0 ? void 0 : _g.notificationSettings) === null || _h === void 0 ? void 0 : _h.pushNotifications) !== null && _j !== void 0 ? _j : true,
                    alertTypes: {
                        delays: (_o = (_m = (_l = (_k = data.preferences) === null || _k === void 0 ? void 0 : _k.notificationSettings) === null || _l === void 0 ? void 0 : _l.alertTypes) === null || _m === void 0 ? void 0 : _m.delays) !== null && _o !== void 0 ? _o : true,
                        suspensions: (_s = (_r = (_q = (_p = data.preferences) === null || _p === void 0 ? void 0 : _p.notificationSettings) === null || _q === void 0 ? void 0 : _q.alertTypes) === null || _r === void 0 ? void 0 : _r.suspensions) !== null && _s !== void 0 ? _s : true,
                        congestion: (_w = (_v = (_u = (_t = data.preferences) === null || _t === void 0 ? void 0 : _t.notificationSettings) === null || _u === void 0 ? void 0 : _u.alertTypes) === null || _v === void 0 ? void 0 : _v.congestion) !== null && _w !== void 0 ? _w : false,
                        alternativeRoutes: (_0 = (_z = (_y = (_x = data.preferences) === null || _x === void 0 ? void 0 : _x.notificationSettings) === null || _y === void 0 ? void 0 : _y.alertTypes) === null || _z === void 0 ? void 0 : _z.alternativeRoutes) !== null && _0 !== void 0 ? _0 : false,
                        serviceUpdates: (_4 = (_3 = (_2 = (_1 = data.preferences) === null || _1 === void 0 ? void 0 : _1.notificationSettings) === null || _2 === void 0 ? void 0 : _2.alertTypes) === null || _3 === void 0 ? void 0 : _3.serviceUpdates) !== null && _4 !== void 0 ? _4 : true,
                    },
                },
            },
        };
    }
    catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}
/**
 * Check if user has email notifications enabled
 */
async function isEmailNotificationEnabled(uid) {
    const user = await getUserById(uid);
    if (!user)
        return false;
    return (user.preferences.notificationSettings.enabled &&
        user.preferences.notificationSettings.emailNotifications &&
        !!user.email &&
        !user.isAnonymous);
}
/**
 * Get user email if notifications are enabled
 */
async function getUserEmailIfEnabled(uid) {
    const user = await getUserById(uid);
    if (!user)
        return null;
    const isEnabled = user.preferences.notificationSettings.enabled &&
        user.preferences.notificationSettings.emailNotifications &&
        !!user.email &&
        !user.isAnonymous;
    return isEnabled ? user.email : null;
}
//# sourceMappingURL=userService.js.map