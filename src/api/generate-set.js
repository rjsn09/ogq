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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VARIANT_NAMES = void 0;
exports.generateOGQImages = generateOGQImages;
exports.regenerateOGQImages = regenerateOGQImages;
var imageGenerator_1 = require("../app/utils/imageGenerator");
var sse_1 = require("./sse");
exports.VARIANT_NAMES = imageGenerator_1.DEFAULT_VARIANTS.map(function (v) { return v.name; });
// Existing callers may keep the original six arguments.
function generateOGQImages(imageDataUrl_1, onProgress_1, characterBase_1, indices_1, variantAssignments_1, previousImages_1) {
    return __awaiter(this, arguments, void 0, function (imageDataUrl, onProgress, characterBase, indices, variantAssignments, previousImages, options) {
        var targetIndices, candidateCount, steps, targetSet, received, results, names, _i, targetIndices_1, index, formData, reference, _a, _b, _c, path;
        var _d, _e, _f, _g, _h, _j, _k;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    targetIndices = (indices === null || indices === void 0 ? void 0 : indices.length) ? indices : imageGenerator_1.VARIANT_CATALOG.slice(0, 24).map(function (_, i) { return i + 1; });
                    if (!targetIndices.length || targetIndices.length > 24 || targetIndices.some(function (i) { return !Number.isInteger(i) || i < 1 || i > 24; }) || new Set(targetIndices).size !== targetIndices.length) {
                        throw new Error('생성 슬롯은 1~24 범위의 중복 없는 번호여야 합니다.');
                    }
                    candidateCount = (_d = options.candidateCount) !== null && _d !== void 0 ? _d : 1;
                    steps = (_e = options.numInferenceSteps) !== null && _e !== void 0 ? _e : 0;
                    if (!Number.isInteger(candidateCount) || candidateCount < 1 || candidateCount > 4)
                        throw new Error('후보 수는 1~4여야 합니다.');
                    if (!Number.isInteger(steps) || steps < 0 || steps > 50)
                        throw new Error('스텝 수는 0~50이어야 합니다.');
                    targetSet = new Set(targetIndices);
                    received = new Set();
                    results = Array.from({ length: 24 }, function (_, i) { var _a; return (_a = previousImages === null || previousImages === void 0 ? void 0 : previousImages[i]) !== null && _a !== void 0 ? _a : ''; });
                    names = {};
                    for (_i = 0, targetIndices_1 = targetIndices; _i < targetIndices_1.length; _i++) {
                        index = targetIndices_1[_i];
                        names[index] = (_h = (_f = variantAssignments === null || variantAssignments === void 0 ? void 0 : variantAssignments[index]) !== null && _f !== void 0 ? _f : (_g = imageGenerator_1.DEFAULT_VARIANTS[index - 1]) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : "\uC774\uBAA8\uD2F0\uCF58 ".concat(index);
                    }
                    formData = new FormData();
                    if (!!options.canonicalId) return [3 /*break*/, 4];
                    if (!imageDataUrl) return [3 /*break*/, 3];
                    return [4 /*yield*/, fetch(imageDataUrl, { signal: options.signal })];
                case 1:
                    reference = _l.sent();
                    if (!reference.ok)
                        throw new Error('참조 이미지를 읽을 수 없습니다.');
                    _b = (_a = formData).append;
                    _c = ['image'];
                    return [4 /*yield*/, reference.blob()];
                case 2:
                    _b.apply(_a, _c.concat([_l.sent(), 'ref.png']));
                    _l.label = 3;
                case 3:
                    if (characterBase === null || characterBase === void 0 ? void 0 : characterBase.trim())
                        formData.append('character_base', characterBase.trim());
                    if (!imageDataUrl && !(characterBase === null || characterBase === void 0 ? void 0 : characterBase.trim()))
                        throw new Error('참조 이미지 또는 캐릭터 설명이 필요합니다.');
                    _l.label = 4;
                case 4:
                    formData.append('indices', JSON.stringify(targetIndices));
                    formData.append('variant_names', JSON.stringify(names));
                    formData.append('variant_prompts', JSON.stringify(Object.fromEntries(targetIndices.map(function (index) { var _a, _b, _c; return [index, (_c = (_b = (_a = options.userPrompts) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '']; }))));
                    formData.append('candidate_count', String(candidateCount));
                    formData.append('num_inference_steps', String(steps));
                    formData.append('img2img_strength', String((_j = options.img2imgStrength) !== null && _j !== void 0 ? _j : 0.68));
                    formData.append('controlnet_scale', String((_k = options.controlnetScale) !== null && _k !== void 0 ? _k : 0.90));
                    formData.append('transport', 'sse');
                    path = options.canonicalId ? "/api/canonical/".concat(encodeURIComponent(options.canonicalId), "/generate-set") : '/api/generate-set';
                    return [4 /*yield*/, (0, sse_1.streamOGQ)(path, {
                            form: formData, baseUrl: options.baseUrl, signal: options.signal,
                            maxReconnects: options.maxReconnects, onStart: options.onStart, onProgress: options.onStatus,
                            onImage: function (data) {
                                if (typeof data.index !== 'number' || !targetSet.has(data.index) || typeof data.image !== 'string' || !data.image.startsWith('data:image/'))
                                    throw new Error('잘못된 이미지 결과를 받았습니다.');
                                results[data.index - 1] = data.image;
                                received.add(data.index);
                                onProgress === null || onProgress === void 0 ? void 0 : onProgress(received.size, __spreadArray([], results, true));
                            },
                            onDone: function (data) {
                                if (received.size !== targetIndices.length || data.completed !== targetIndices.length)
                                    throw new Error('요청한 이미지 일부가 누락되었습니다.');
                            },
                        })];
                case 5:
                    _l.sent();
                    if (received.size !== targetIndices.length)
                        throw new Error('요청한 이미지 일부가 누락되었습니다.');
                    return [2 /*return*/, results];
            }
        });
    });
}
function regenerateOGQImages(imageDataUrl, slotIndices, variantAssignments, previousImages, onProgress, characterBase, options) {
    if (options === void 0) { options = {}; }
    if (!slotIndices.length)
        throw new Error('재생성할 슬롯을 선택해 주세요.');
    return generateOGQImages(imageDataUrl, onProgress, characterBase, slotIndices, variantAssignments, previousImages, options);
}
