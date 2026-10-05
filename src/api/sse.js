"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationCancelledError = exports.OGQStreamError = void 0;
exports.cancelGeneration = cancelGeneration;
exports.apiUrl = apiUrl;
exports.responseError = responseError;
exports.parseSSE = parseSSE;
exports.streamOGQ = streamOGQ;
var OGQStreamError = /** @class */ (function (_super) {
    __extends(OGQStreamError, _super);
    function OGQStreamError(message, retryable) {
        if (retryable === void 0) { retryable = false; }
        var _this = _super.call(this, message) || this;
        _this.retryable = retryable;
        _this.lastEventId = 0;
        _this.name = 'OGQStreamError';
        return _this;
    }
    return OGQStreamError;
}(Error));
exports.OGQStreamError = OGQStreamError;
var GenerationCancelledError = /** @class */ (function (_super) {
    __extends(GenerationCancelledError, _super);
    function GenerationCancelledError() {
        var _this = _super.call(this, '생성을 취소했습니다.') || this;
        _this.name = 'GenerationCancelledError';
        return _this;
    }
    return GenerationCancelledError;
}(Error));
exports.GenerationCancelledError = GenerationCancelledError;
function cancelGeneration(identity, baseUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var path, response, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    path = identity.job_id
                        ? "/api/canonical/generate-set/".concat(encodeURIComponent(identity.job_id), "/cancel")
                        : identity.canonical_id ? "/api/canonical/".concat(encodeURIComponent(identity.canonical_id), "/cancel") : undefined;
                    if (!path)
                        throw new Error('작업을 등록하고 있습니다. 잠시 후 다시 시도해 주세요.');
                    return [4 /*yield*/, fetch(apiUrl(path, baseUrl), {
                            method: 'POST', headers: { 'ngrok-skip-browser-warning': 'true' },
                        })];
                case 1:
                    response = _b.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    _a = Error.bind;
                    return [4 /*yield*/, responseError(response)];
                case 2: throw new (_a.apply(Error, [void 0, _b.sent()]))();
                case 3: return [2 /*return*/, response.json()];
            }
        });
    });
}
var env = import.meta.env;
var defaultBase = ((_a = env === null || env === void 0 ? void 0 : env.VITE_BACKEND_URL) === null || _a === void 0 ? void 0 : _a.trim()) || '';
function apiUrl(path, baseUrl) {
    if (baseUrl === void 0) { baseUrl = defaultBase; }
    if (!path.startsWith('/api/') || path.startsWith('//'))
        throw new OGQStreamError('잘못된 API 경로입니다.');
    return "".concat(baseUrl.replace(/\/+$/, '')).concat(path);
}
function responseError(response) {
    return __awaiter(this, void 0, void 0, function () {
        var text, data, detail;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, response.text()];
                case 1:
                    text = _b.sent();
                    try {
                        data = JSON.parse(text);
                        detail = (_a = data.error) !== null && _a !== void 0 ? _a : data.detail;
                        if (typeof detail === 'string')
                            return [2 /*return*/, detail];
                        if (Array.isArray(detail))
                            return [2 /*return*/, detail.map(function (item) { var _a; return (_a = item.msg) !== null && _a !== void 0 ? _a : JSON.stringify(item); }).join(', ')];
                    }
                    catch ( /* Non-JSON proxy errors use the HTTP status below. */_c) { /* Non-JSON proxy errors use the HTTP status below. */ }
                    return [2 /*return*/, "\uC11C\uBC84 \uC694\uCCAD \uC2E4\uD328 (HTTP ".concat(response.status, ")")];
            }
        });
    });
}
/** Handles UTF-8 and CR/LF split across arbitrary network chunk boundaries. */
function parseSSE(body) {
    return __asyncGenerator(this, arguments, function parseSSE_1() {
        function acceptLine(line) {
            if (!line) {
                var event_1;
                if (lines.length) {
                    var data = void 0;
                    try {
                        data = JSON.parse(lines.join('\n'));
                    }
                    catch (_a) {
                        throw new OGQStreamError('SSE 데이터가 올바른 JSON이 아닙니다.');
                    }
                    if (!data || typeof data !== 'object' || Array.isArray(data))
                        throw new OGQStreamError('잘못된 SSE 데이터입니다.');
                    event_1 = { type: type, id: id, data: data };
                }
                type = 'message';
                id = undefined;
                lines = [];
                return event_1;
            }
            if (line.startsWith(':'))
                return;
            var colon = line.indexOf(':');
            var field = colon < 0 ? line : line.slice(0, colon);
            var value = colon < 0 ? '' : line.slice(colon + 1);
            if (value.startsWith(' '))
                value = value.slice(1);
            if (field === 'event')
                type = value;
            if (field === 'id' && !value.includes('\0'))
                id = value;
            if (field === 'data')
                lines.push(value);
        }
        var reader, decoder, buffer, type, id, lines, _a, value, done, match, index, line, length_1, event_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    reader = body.getReader();
                    decoder = new TextDecoder();
                    buffer = '', type = 'message';
                    lines = [];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, , 10, 12]);
                    _b.label = 2;
                case 2:
                    if (!true) return [3 /*break*/, 9];
                    return [4 /*yield*/, __await(reader.read())];
                case 3:
                    _a = _b.sent(), value = _a.value, done = _a.done;
                    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
                    _b.label = 4;
                case 4:
                    if (!true) return [3 /*break*/, 8];
                    match = /[\r\n]/.exec(buffer);
                    if (!match)
                        return [3 /*break*/, 8];
                    index = match.index;
                    if (buffer[index] === '\r' && index === buffer.length - 1 && !done)
                        return [3 /*break*/, 8];
                    line = buffer.slice(0, index);
                    length_1 = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
                    buffer = buffer.slice(index + length_1);
                    event_2 = acceptLine(line);
                    if (!event_2) return [3 /*break*/, 7];
                    return [4 /*yield*/, __await(event_2)];
                case 5: return [4 /*yield*/, _b.sent()];
                case 6:
                    _b.sent();
                    _b.label = 7;
                case 7: return [3 /*break*/, 4];
                case 8:
                    if (done)
                        return [3 /*break*/, 9];
                    return [3 /*break*/, 2];
                case 9: return [3 /*break*/, 12];
                case 10: return [4 /*yield*/, __await(reader.cancel().catch(function () { }))];
                case 11:
                    _b.sent();
                    reader.releaseLock();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function pause(ms, signal) {
    return new Promise(function (resolve, reject) {
        signal === null || signal === void 0 ? void 0 : signal.throwIfAborted();
        var abort = function () { var _a; clearTimeout(timer); reject((_a = signal === null || signal === void 0 ? void 0 : signal.reason) !== null && _a !== void 0 ? _a : new DOMException('Aborted', 'AbortError')); };
        var timer = setTimeout(function () { signal === null || signal === void 0 ? void 0 : signal.removeEventListener('abort', abort); resolve(); }, ms);
        signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', abort, { once: true });
    });
}
function notify(callback, data) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (callback === null || callback === void 0 ? void 0 : callback(data))];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    throw new OGQStreamError(error_1 instanceof Error ? error_1.message : '화면 갱신에 실패했습니다.');
                case 3: return [2 /*return*/];
            }
        });
    });
}
/** POST once. Interrupted streams reconnect by GET to the SAME job only. */
function streamOGQ(path_1) {
    return __awaiter(this, arguments, void 0, function (path, options) {
        var identity, cursor, eventsPath, maxReconnects, attempt, starting, headers, response, _a, _b, _c, _d, event_3, eventId, e_1_1, error_2, failure;
        var _e, e_1, _f, _g;
        var _h, _j, _k, _l, _m, _o, _p;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    identity = {};
                    cursor = (_h = options.after) !== null && _h !== void 0 ? _h : 0;
                    eventsPath = options.form ? undefined : path;
                    maxReconnects = Math.max(0, (_j = options.maxReconnects) !== null && _j !== void 0 ? _j : 3);
                    attempt = 0;
                    _q.label = 1;
                case 1:
                    (_k = options.signal) === null || _k === void 0 ? void 0 : _k.throwIfAborted();
                    starting = attempt === 0 && options.form !== undefined;
                    _q.label = 2;
                case 2:
                    _q.trys.push([2, 27, , 29]);
                    headers = { Accept: 'text/event-stream', 'ngrok-skip-browser-warning': 'true' };
                    if (!starting && cursor > 0)
                        headers['Last-Event-ID'] = String(cursor);
                    return [4 /*yield*/, fetch(apiUrl(starting ? path : eventsPath !== null && eventsPath !== void 0 ? eventsPath : path, options.baseUrl), {
                            method: starting ? 'POST' : 'GET', body: starting ? options.form : undefined,
                            headers: headers,
                            cache: 'no-store', signal: options.signal,
                        })];
                case 3:
                    response = _q.sent();
                    if (!!response.ok) return [3 /*break*/, 5];
                    _a = OGQStreamError.bind;
                    return [4 /*yield*/, responseError(response)];
                case 4: throw new (_a.apply(OGQStreamError, [void 0, _q.sent(), !starting && response.status >= 500]))();
                case 5:
                    if (response.status === 204)
                        return [2 /*return*/, __assign(__assign({}, identity), { status: 'already_received' })];
                    if (!(!((_l = response.headers.get('content-type')) === null || _l === void 0 ? void 0 : _l.includes('text/event-stream')) || !response.body)) return [3 /*break*/, 7];
                    return [4 /*yield*/, ((_m = response.body) === null || _m === void 0 ? void 0 : _m.cancel())];
                case 6:
                    _q.sent();
                    throw new OGQStreamError('SSE 응답이 아닙니다. 백엔드 버전과 API 주소를 확인해 주세요.');
                case 7:
                    _q.trys.push([7, 20, 21, 26]);
                    _b = true, _c = (e_1 = void 0, __asyncValues(parseSSE(response.body)));
                    _q.label = 8;
                case 8: return [4 /*yield*/, _c.next()];
                case 9:
                    if (!(_d = _q.sent(), _e = _d.done, !_e)) return [3 /*break*/, 19];
                    _g = _d.value;
                    _b = false;
                    event_3 = _g;
                    if (!(event_3.type === 'start')) return [3 /*break*/, 11];
                    identity = __assign(__assign({}, identity), event_3.data);
                    if (typeof event_3.data.events_url === 'string')
                        eventsPath = event_3.data.events_url;
                    return [4 /*yield*/, notify(options.onStart, event_3.data)];
                case 10:
                    _q.sent();
                    return [3 /*break*/, 18];
                case 11:
                    if (!(event_3.type === 'image')) return [3 /*break*/, 13];
                    eventId = Number(event_3.id);
                    if (!Number.isSafeInteger(eventId) || eventId <= 0)
                        throw new OGQStreamError('잘못된 이미지 이벤트 ID입니다.');
                    if (eventId <= cursor)
                        return [3 /*break*/, 18];
                    if (eventId !== cursor + 1)
                        throw new OGQStreamError('이미지 이벤트 순서가 일치하지 않습니다.');
                    return [4 /*yield*/, notify(options.onImage, event_3.data)];
                case 12:
                    _q.sent();
                    cursor = eventId;
                    return [3 /*break*/, 18];
                case 13:
                    if (!(event_3.type === 'done')) return [3 /*break*/, 15];
                    return [4 /*yield*/, notify(options.onDone, event_3.data)];
                case 14:
                    _q.sent();
                    return [2 /*return*/, event_3.data];
                case 15:
                    if (!(event_3.type === 'progress')) return [3 /*break*/, 17];
                    return [4 /*yield*/, notify(options.onProgress, event_3.data)];
                case 16:
                    _q.sent();
                    return [3 /*break*/, 18];
                case 17:
                    if (event_3.type === 'cancelled') {
                        throw new GenerationCancelledError();
                    }
                    else if (event_3.type === 'error') {
                        throw new OGQStreamError(event_3.data.error || '이미지 생성에 실패했습니다.');
                    }
                    _q.label = 18;
                case 18:
                    _b = true;
                    return [3 /*break*/, 8];
                case 19: return [3 /*break*/, 26];
                case 20:
                    e_1_1 = _q.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 26];
                case 21:
                    _q.trys.push([21, , 24, 25]);
                    if (!(!_b && !_e && (_f = _c.return))) return [3 /*break*/, 23];
                    return [4 /*yield*/, _f.call(_c)];
                case 22:
                    _q.sent();
                    _q.label = 23;
                case 23: return [3 /*break*/, 25];
                case 24:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 25: return [7 /*endfinally*/];
                case 26: throw new OGQStreamError('완료 전에 연결이 끊겼습니다.', true);
                case 27:
                    error_2 = _q.sent();
                    if (error_2 instanceof GenerationCancelledError)
                        throw error_2;
                    (_o = options.signal) === null || _o === void 0 ? void 0 : _o.throwIfAborted();
                    failure = error_2 instanceof OGQStreamError ? error_2 : new OGQStreamError(error_2 instanceof Error ? error_2.message : '서버 연결 오류', true);
                    failure.jobId = identity.job_id;
                    failure.canonicalId = identity.canonical_id;
                    failure.eventsUrl = eventsPath;
                    failure.lastEventId = cursor;
                    if (!failure.retryable || !eventsPath || attempt >= maxReconnects)
                        throw failure;
                    return [4 /*yield*/, pause(((_p = options.reconnectDelayMs) !== null && _p !== void 0 ? _p : 1000) * Math.min(attempt + 1, 3), options.signal)];
                case 28:
                    _q.sent();
                    return [3 /*break*/, 29];
                case 29:
                    attempt++;
                    return [3 /*break*/, 1];
                case 30: return [2 /*return*/];
            }
        });
    });
}
