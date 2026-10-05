"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordVisit = recordVisit;
exports.monitorGeneration = monitorGeneration;
var firestore_1 = require("firebase/firestore");
var config_1 = require("../firebase/config");
var dashboardMetrics_1 = require("./dashboardMetrics");
var sessionId;
function getSessionId() {
    var _a;
    if (sessionId)
        return sessionId;
    try {
        sessionId = (_a = sessionStorage.getItem("monitoringSessionId")) !== null && _a !== void 0 ? _a : crypto.randomUUID();
        sessionStorage.setItem("monitoringSessionId", sessionId);
    }
    catch (_b) {
        sessionId = crypto.randomUUID();
    }
    return sessionId;
}
function record(uid_1, type_1) {
    return __awaiter(this, arguments, void 0, function (uid, type, options) {
        var session_1, day_1, detailsRef_1, eventRef_1, error_1;
        var _this = this;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    session_1 = getSessionId();
                    day_1 = (0, dashboardMetrics_1.koreaDay)(Date.now());
                    detailsRef_1 = (0, firestore_1.doc)(config_1.db, "user_details", uid);
                    eventRef_1 = type === "visit"
                        ? (0, firestore_1.doc)(config_1.db, "events", "visit_".concat(uid, "_").concat(session_1, "_").concat(day_1))
                        : (0, firestore_1.doc)((0, firestore_1.collection)(config_1.db, "events"));
                    return [4 /*yield*/, (0, firestore_1.runTransaction)(config_1.db, function (transaction) { return __awaiter(_this, void 0, void 0, function () {
                            var details, _a, existing, update, _i, _b, field;
                            var _c, _d, _e;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0: return [4 /*yield*/, transaction.get(detailsRef_1)];
                                    case 1:
                                        details = _f.sent();
                                        _a = type === "visit";
                                        if (!_a) return [3 /*break*/, 3];
                                        return [4 /*yield*/, transaction.get(eventRef_1)];
                                    case 2:
                                        _a = (_f.sent()).exists();
                                        _f.label = 3;
                                    case 3:
                                        if (_a)
                                            return [2 /*return*/];
                                        existing = (_c = details.data()) !== null && _c !== void 0 ? _c : {};
                                        update = {};
                                        for (_i = 0, _b = ["visitCount", "generationStartCount", "generationCompleteCount", "generationFailCount", "regenerateCount", "totalGenerationTimes"]; _i < _b.length; _i++) {
                                            field = _b[_i];
                                            if (existing[field] == null)
                                                update[field] = 0;
                                        }
                                        if (type === "visit") {
                                            update.visitCount = (0, firestore_1.increment)(1);
                                            update.lastVisitAt = (0, firestore_1.serverTimestamp)();
                                            if (!existing.firstVisitAt)
                                                update.firstVisitAt = (0, firestore_1.serverTimestamp)();
                                        }
                                        else if (type === "generation_start") {
                                            update.generationStartCount = (0, firestore_1.increment)(1);
                                            update.lastGenerationAt = (0, firestore_1.serverTimestamp)();
                                            if (!existing.firstGenerationAt)
                                                update.firstGenerationAt = (0, firestore_1.serverTimestamp)();
                                            if (options.regenerate)
                                                update.regenerateCount = (0, firestore_1.increment)(1);
                                        }
                                        else {
                                            if (type === "generation_complete")
                                                update.generationCompleteCount = (0, firestore_1.increment)(1);
                                            if (type === "generation_fail")
                                                update.generationFailCount = (0, firestore_1.increment)(1);
                                            update.totalGenerationTimes = (0, firestore_1.increment)((_d = options.durationMs) !== null && _d !== void 0 ? _d : 0);
                                        }
                                        transaction.set(detailsRef_1, update, { merge: true });
                                        transaction.set(eventRef_1, { uid: uid, sessionId: session_1, type: type, createdAt: (0, firestore_1.serverTimestamp)() });
                                        if (type === "visit" && ((_e = existing.firstVisitAt) === null || _e === void 0 ? void 0 : _e.toMillis) && (0, dashboardMetrics_1.koreaDay)(existing.firstVisitAt.toMillis()) < day_1) {
                                            transaction.set((0, firestore_1.doc)(config_1.db, "events", "return_".concat(uid, "_").concat(session_1, "_").concat(day_1)), {
                                                uid: uid,
                                                sessionId: session_1, type: "return_visit", createdAt: (0, firestore_1.serverTimestamp)(),
                                            });
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    // Monitoring must not prevent login or image generation.
                    console.error("모니터링 기록 실패:", error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function recordVisit(uid) {
    return record(uid, "visit");
}
/** Counts each canonical/sticker API request; totalGenerationTimes is elapsed milliseconds. */
function monitorGeneration(uid, regenerate, signal, generate) {
    return __awaiter(this, void 0, void 0, function () {
        var startedAt, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, record(uid, "generation_start", { regenerate: regenerate })];
                case 1:
                    _a.sent();
                    startedAt = performance.now();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 7]);
                    if (signal.aborted)
                        throw new DOMException("Generation cancelled", "AbortError");
                    return [4 /*yield*/, generate()];
                case 3:
                    result = _a.sent();
                    return [4 /*yield*/, record(uid, signal.aborted ? "generation_cancel" : "generation_complete", { durationMs: Math.round(performance.now() - startedAt) })];
                case 4:
                    _a.sent();
                    return [2 /*return*/, result];
                case 5:
                    error_2 = _a.sent();
                    return [4 /*yield*/, record(uid, signal.aborted || (error_2 instanceof Error && error_2.name === "GenerationCancelledError") ? "generation_cancel" : "generation_fail", { durationMs: Math.round(performance.now() - startedAt) })];
                case 6:
                    _a.sent();
                    throw error_2;
                case 7: return [2 /*return*/];
            }
        });
    });
}
