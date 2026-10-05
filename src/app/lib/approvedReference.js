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
exports.referenceMatches = referenceMatches;
exports.ensureApprovedReference = ensureApprovedReference;
exports.referenceStorage = referenceStorage;
var sse_ts_1 = require("../../api/sse.ts");
function referenceMatches(reference, source, description) {
    return !!reference && reference.source === source && reference.description === description.trim();
}
function ensureApprovedReference(reference, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var response_1, state_1, _a, form, _b, _c, _d, _e, _f, _g, response, _h, state;
        var _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    if (!reference.id) return [3 /*break*/, 5];
                    return [4 /*yield*/, fetch((0, sse_ts_1.apiUrl)("/api/canonical/".concat(encodeURIComponent(reference.id))), { signal: signal, headers: { 'ngrok-skip-browser-warning': 'true' } })];
                case 1:
                    response_1 = _m.sent();
                    if (!response_1.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response_1.json()];
                case 2:
                    state_1 = _m.sent();
                    if (state_1.approved)
                        return [2 /*return*/, reference.id];
                    return [3 /*break*/, 5];
                case 3:
                    if (!(response_1.status !== 404)) return [3 /*break*/, 5];
                    _a = Error.bind;
                    return [4 /*yield*/, (0, sse_ts_1.responseError)(response_1)];
                case 4: throw new (_a.apply(Error, [void 0, _m.sent()]))();
                case 5:
                    form = new FormData();
                    _c = (_b = form).append;
                    _d = ['image'];
                    return [4 /*yield*/, fetch(reference.image, { signal: signal })];
                case 6: return [4 /*yield*/, (_m.sent()).blob()];
                case 7:
                    _c.apply(_b, _d.concat([_m.sent(), 'canonical.png']));
                    _f = (_e = form).append;
                    _g = ['original_image'];
                    return [4 /*yield*/, fetch(reference.source, { signal: signal })];
                case 8: return [4 /*yield*/, (_m.sent()).blob()];
                case 9:
                    _f.apply(_e, _g.concat([_m.sent(), 'source.png']));
                    form.append('character_base', reference.description);
                    form.append('canonical_profile', (_j = reference.canonicalProfile) !== null && _j !== void 0 ? _j : '');
                    form.append('original_profile', (_k = reference.originalProfile) !== null && _k !== void 0 ? _k : '');
                    form.append('canonical_prompt', (_l = reference.prompt) !== null && _l !== void 0 ? _l : '');
                    return [4 /*yield*/, fetch((0, sse_ts_1.apiUrl)('/api/canonical/restore'), { method: 'POST', body: form, signal: signal, headers: { 'ngrok-skip-browser-warning': 'true' } })];
                case 10:
                    response = _m.sent();
                    if (!!response.ok) return [3 /*break*/, 12];
                    _h = Error.bind;
                    return [4 /*yield*/, (0, sse_ts_1.responseError)(response)];
                case 11: throw new (_h.apply(Error, [void 0, _m.sent()]))();
                case 12: return [4 /*yield*/, response.json()];
                case 13:
                    state = _m.sent();
                    if (typeof state.canonical_id !== 'string' || !state.approved)
                        throw new Error('기준 이미지 복구에 실패했습니다.');
                    return [2 /*return*/, state.canonical_id];
            }
        });
    });
}
function database() {
    return new Promise(function (resolve, reject) {
        var request = indexedDB.open('ogq-approved-reference', 1);
        request.onupgradeneeded = function () { return request.result.createObjectStore('references'); };
        request.onsuccess = function () { return resolve(request.result); };
        request.onerror = function () { return reject(request.error); };
    });
}
function referenceStorage(uid, action, value) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, database()];
                case 1:
                    db = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 4, 5]);
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var transaction = db.transaction('references', action === 'read' ? 'readonly' : 'readwrite');
                            var store = transaction.objectStore('references');
                            var request = action === 'read' ? store.get(uid) : action === 'write' ? store.put(value, uid) : store.delete(uid);
                            transaction.oncomplete = function () { var _a; return resolve(action === 'read' ? (_a = request.result) !== null && _a !== void 0 ? _a : null : null); };
                            transaction.onerror = function () { return reject(transaction.error); };
                            transaction.onabort = function () { return reject(transaction.error); };
                        })];
                case 3: return [2 /*return*/, _a.sent()];
                case 4:
                    db.close();
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
