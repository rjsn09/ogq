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
exports.createCanonical = createCanonical;
exports.getCanonical = getCanonical;
exports.approveCanonical = approveCanonical;
exports.regenerateCanonical = regenerateCanonical;
exports.generateStickerSet = generateStickerSet;
exports.getStickerJob = getStickerJob;
var sse_1 = require("../../api/sse");
function canonicalStream(path, options) {
    return __awaiter(this, void 0, void 0, function () {
        var image, prompt, canonicalProfile, originalProfile, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, sse_1.streamOGQ)(path, __assign(__assign({}, options), { onImage: function (data) {
                            if (typeof data.image !== 'string' || !data.image.startsWith('data:image/'))
                                throw new Error('잘못된 캐릭터 이미지입니다.');
                            image = data.image;
                            prompt = typeof data.canonical_prompt === 'string' ? data.canonical_prompt : undefined;
                            canonicalProfile = typeof data.canonical_profile === 'string' ? data.canonical_profile : undefined;
                            originalProfile = typeof data.original_profile === 'string' ? data.original_profile : undefined;
                        } }))];
                case 1:
                    result = _a.sent();
                    if (!image || typeof result.canonical_id !== 'string')
                        throw new Error('캐릭터 결과가 누락되었습니다.');
                    return [2 /*return*/, { canonical_id: result.canonical_id, status: 'ready', approved: false, image: image, canonical_prompt: prompt, canonical_profile: canonicalProfile, original_profile: originalProfile }];
            }
        });
    });
}
function createCanonical(params_1) {
    return __awaiter(this, arguments, void 0, function (params, options) {
        var form;
        var _a, _b, _c;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            form = new FormData();
            if (params.image)
                form.append('image', params.image, 'ref.png');
            form.append('character_base', (_a = params.characterBase) !== null && _a !== void 0 ? _a : '');
            form.append('ip_scale', String((_b = params.ipScale) !== null && _b !== void 0 ? _b : 0.60));
            form.append('num_inference_steps', String((_c = params.steps) !== null && _c !== void 0 ? _c : 30));
            form.append('transport', 'sse');
            return [2 /*return*/, canonicalStream('/api/canonical', __assign(__assign({}, options), { form: form }))];
        });
    });
}
function getCanonical(canonicalId, options) {
    if (options === void 0) { options = {}; }
    return canonicalStream("/api/canonical/".concat(encodeURIComponent(canonicalId), "/events"), options);
}
function approveCanonical(canonicalId) {
    return __awaiter(this, void 0, void 0, function () {
        var response, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fetch((0, sse_1.apiUrl)("/api/canonical/".concat(encodeURIComponent(canonicalId), "/approve")), {
                        method: 'POST', headers: { 'ngrok-skip-browser-warning': 'true' },
                    })];
                case 1:
                    response = _b.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    _a = Error.bind;
                    return [4 /*yield*/, (0, sse_1.responseError)(response)];
                case 2: throw new (_a.apply(Error, [void 0, _b.sent()]))();
                case 3: return [2 /*return*/];
            }
        });
    });
}
function regenerateCanonical(canonicalId, editRequest, options) {
    if (editRequest === void 0) { editRequest = ''; }
    if (options === void 0) { options = {}; }
    var form = new FormData();
    form.append('edit_request', editRequest);
    form.append('transport', 'sse');
    return canonicalStream("/api/canonical/".concat(encodeURIComponent(canonicalId), "/regenerate"), __assign(__assign({}, options), { form: form }));
}
function generateStickerSet(params_1) {
    return __awaiter(this, arguments, void 0, function (params, options) {
        var form, result;
        var _a, _b, _c, _d;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    form = new FormData();
                    form.append('indices', JSON.stringify(params.indices));
                    form.append('variant_names', JSON.stringify(params.variantNames));
                    form.append('candidate_count', String((_a = params.candidateCount) !== null && _a !== void 0 ? _a : 2));
                    form.append('img2img_strength', String((_b = params.img2imgStrength) !== null && _b !== void 0 ? _b : 0.68));
                    form.append('controlnet_scale', String((_c = params.controlnetScale) !== null && _c !== void 0 ? _c : 0.90));
                    form.append('num_inference_steps', String((_d = params.steps) !== null && _d !== void 0 ? _d : 30));
                    form.append('transport', 'sse');
                    return [4 /*yield*/, (0, sse_1.streamOGQ)("/api/canonical/".concat(encodeURIComponent(params.canonicalId), "/generate-set"), __assign(__assign({}, options), { form: form }))];
                case 1:
                    result = _e.sent();
                    if (typeof result.job_id !== 'string')
                        throw new Error('작업 ID가 누락되었습니다.');
                    return [2 /*return*/, result.job_id];
            }
        });
    });
}
function getStickerJob(jobId_1) {
    return __awaiter(this, arguments, void 0, function (jobId, since, options) {
        var images, result;
        var _this = this;
        if (since === void 0) { since = 0; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    images = [];
                    return [4 /*yield*/, (0, sse_1.streamOGQ)("/api/canonical/generate-set/".concat(encodeURIComponent(jobId), "/events"), __assign(__assign({}, options), { after: since, onImage: function (data) { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        images.push(data);
                                        return [4 /*yield*/, ((_a = options.onImage) === null || _a === void 0 ? void 0 : _a.call(options, data))];
                                    case 1:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            }); }); } }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, { status: 'done', completed: Number(result.completed), total: Number(result.total), images: images }];
            }
        });
    });
}
