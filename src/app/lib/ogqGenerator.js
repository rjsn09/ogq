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
exports.regenerateCanonical = exports.getCanonical = exports.approveCanonical = exports.regenerateOGQImages = exports.generateOGQImages = exports.VARIANT_NAMES = void 0;
exports.createCanonical = createCanonical;
exports.generateOGQImagesFromCanonical = generateOGQImagesFromCanonical;
var canonicalFlow_1 = require("./canonicalFlow");
var generate_set_1 = require("../../api/generate-set");
var generate_set_2 = require("../../api/generate-set");
Object.defineProperty(exports, "VARIANT_NAMES", { enumerable: true, get: function () { return generate_set_2.VARIANT_NAMES; } });
Object.defineProperty(exports, "generateOGQImages", { enumerable: true, get: function () { return generate_set_2.generateOGQImages; } });
Object.defineProperty(exports, "regenerateOGQImages", { enumerable: true, get: function () { return generate_set_2.regenerateOGQImages; } });
var canonicalFlow_2 = require("./canonicalFlow");
Object.defineProperty(exports, "approveCanonical", { enumerable: true, get: function () { return canonicalFlow_2.approveCanonical; } });
Object.defineProperty(exports, "getCanonical", { enumerable: true, get: function () { return canonicalFlow_2.getCanonical; } });
Object.defineProperty(exports, "regenerateCanonical", { enumerable: true, get: function () { return canonicalFlow_2.regenerateCanonical; } });
function createCanonical(imageDataUrl_1, characterBase_1) {
    return __awaiter(this, arguments, void 0, function (imageDataUrl, characterBase, options) {
        var response, _a;
        var _b;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, fetch(imageDataUrl, { signal: options.signal })];
                case 1:
                    response = _c.sent();
                    if (!response.ok)
                        throw new Error('참조 이미지를 읽지 못했습니다.');
                    _a = canonicalFlow_1.createCanonical;
                    _b = {};
                    return [4 /*yield*/, response.blob()];
                case 2: return [2 /*return*/, _a.apply(void 0, [(_b.image = _c.sent(), _b.characterBase = characterBase, _b), __assign(__assign({}, options), { onProgress: options.onStatus })])];
            }
        });
    });
}
function generateOGQImagesFromCanonical(canonicalId, onProgress, indices, variantAssignments, previousImages, options) {
    if (options === void 0) { options = {}; }
    return (0, generate_set_1.generateOGQImages)('', onProgress, undefined, indices, variantAssignments, previousImages, __assign(__assign({ candidateCount: 2, numInferenceSteps: 30 }, options), { canonicalId: canonicalId }));
}
