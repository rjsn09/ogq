"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStorageConfig = validateStorageConfig;
exports.createStorageClient = createStorageClient;
function validateStorageConfig(config) {
    if (!config.url || !config.key)
        throw new Error('Supabase 저장소 연결이 필요합니다. VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 설정해 주세요.');
    var url = new URL(config.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
        throw new Error('Supabase URL 형식이 올바르지 않습니다.');
    if (!/^[a-zA-Z0-9_-]+$/.test(config.bucket))
        throw new Error('Supabase 버킷 이름이 올바르지 않습니다.');
    // Secret and service-role keys must never be deployed to the browser.
    if (config.key.startsWith('sb_secret_'))
        throw new Error('Supabase 공개 키를 사용해 주세요. 비밀 키는 브라우저에서 사용할 수 없습니다.');
    if (config.key.startsWith('ey')) {
        try {
            var payload = JSON.parse(atob(config.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.role === 'service_role')
                throw new Error('Supabase service_role 키는 브라우저에서 사용할 수 없습니다.');
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('service_role'))
                throw error;
        }
    }
    return __assign(__assign({}, config), { url: url.origin });
}
function createStorageClient(settings, token) {
    var _this = this;
    var config = validateStorageConfig(settings);
    var objectPath = function (path) {
        if (!path || path.split('/').some(function (part) { return !part || part === '.' || part === '..'; }))
            throw new Error('상품 파일 경로가 올바르지 않습니다.');
        return "".concat(encodeURIComponent(config.bucket), "/").concat(path.split('/').map(encodeURIComponent).join('/'));
    };
    function request(path, options) {
        return __awaiter(this, void 0, void 0, function () {
            var attempt, headers, _a, _b, _c, _d, response, data;
            var _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        attempt = 0;
                        _g.label = 1;
                    case 1:
                        if (!(attempt < 2)) return [3 /*break*/, 6];
                        (_e = options.signal) === null || _e === void 0 ? void 0 : _e.throwIfAborted();
                        headers = new Headers(options.headers);
                        headers.set('apikey', config.key);
                        _b = (_a = headers).set;
                        _c = ['Authorization'];
                        _d = "Bearer ".concat;
                        return [4 /*yield*/, token(attempt === 1)];
                    case 2:
                        _b.apply(_a, _c.concat([_d.apply("Bearer ", [_g.sent()])]));
                        return [4 /*yield*/, fetch("".concat(config.url, "/storage/v1/").concat(path), __assign(__assign({}, options), { headers: headers }))];
                    case 3:
                        response = _g.sent();
                        if (response.ok)
                            return [2 /*return*/, response];
                        if (response.status === 401 && attempt === 0)
                            return [3 /*break*/, 5];
                        if (response.status === 401 || response.status === 403)
                            throw new Error('Supabase 접근 권한을 확인해 주세요. Firebase 로그인 연동과 Storage 정책이 필요합니다.');
                        return [4 /*yield*/, response.json().catch(function () { return ({}); })];
                    case 4:
                        data = _g.sent();
                        if (response.status === 413)
                            throw new Error('저장소 파일 크기 제한을 초과했습니다.');
                        if (response.status === 507 || response.status === 429)
                            throw new Error('Supabase 저장 공간 또는 무료 사용량 한도에 도달했습니다.');
                        if (String((_f = data.message) !== null && _f !== void 0 ? _f : data.error).includes('Bucket not found'))
                            throw new Error('Supabase에 product-images 비공개 버킷을 만들어 주세요.');
                        throw new Error("\uC0C1\uD488 \uC800\uC7A5\uC18C \uC694\uCCAD\uC774 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. (HTTP ".concat(response.status, ")"));
                    case 5:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 6: throw new Error('로그인을 다시 확인해 주세요.');
                }
            });
        });
    }
    return {
        upload: function (path, blob) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, request("object/".concat(objectPath(path)), { method: 'POST', headers: { 'Content-Type': blob.type, 'x-upsert': 'false' }, body: blob })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        download: function (path, signal) { return __awaiter(_this, void 0, void 0, function () {
            var response, declaredSize;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, request("object/authenticated/".concat(objectPath(path)), { signal: signal })];
                    case 1:
                        response = _b.sent();
                        declaredSize = Number(response.headers.get('content-length'));
                        if (!(declaredSize > 64 * 1024 * 1024)) return [3 /*break*/, 3];
                        return [4 /*yield*/, ((_a = response.body) === null || _a === void 0 ? void 0 : _a.cancel())];
                    case 2:
                        _b.sent();
                        throw new Error('상품 파일 용량이 너무 큽니다.');
                    case 3: return [2 /*return*/, response.blob()];
                }
            });
        }); },
        remove: function (paths) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!paths.length)
                            return [2 /*return*/];
                        paths.forEach(objectPath);
                        return [4 /*yield*/, request("object/".concat(encodeURIComponent(config.bucket)), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    };
}
