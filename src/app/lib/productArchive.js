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
exports.MAX_ARCHIVE_BYTES = void 0;
exports.parseProductArchive = parseProductArchive;
exports.encodeProductArchive = encodeProductArchive;
exports.productStoragePath = productStoragePath;
exports.assertProductPath = assertProductPath;
var imagePattern = /^data:image\/(?:png|jpeg|jpg|webp|gif|avif|bmp);base64,[A-Za-z0-9+/=\r\n]+$/;
var categories = new Set(['감정', '인사', '리액션', '동작']);
exports.MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
/** Never restore URLs or arbitrary objects from an untrusted archive. */
function parseProductArchive(value) {
    if (!value || typeof value !== 'object')
        throw new Error('저장한 상품 형식이 올바르지 않습니다.');
    var data = value;
    var text = function (key, limit) {
        var result = data[key];
        if (typeof result !== 'string' || result.length > limit)
            throw new Error('저장한 상품 정보가 올바르지 않습니다.');
        return result;
    };
    var title = text('title', 200).trim();
    if (data.version !== 1 || !title)
        throw new Error('저장한 상품 버전이나 상품명이 올바르지 않습니다.');
    if (!Array.isArray(data.images) || data.images.length !== 24 || data.images.some(function (image) { return typeof image !== 'string' || (image && !imagePattern.test(image)); })) {
        throw new Error('저장한 상품의 이미지 구성이 올바르지 않습니다.');
    }
    if (!Array.isArray(data.tags) || data.tags.length > 30 || data.tags.some(function (tag) { return typeof tag !== 'string' || tag.length > 200; }))
        throw new Error('저장한 태그가 올바르지 않습니다.');
    var optionalImage = function (key) {
        var image = data[key];
        if (image === null)
            return null;
        if (typeof image !== 'string' || !imagePattern.test(image))
            throw new Error('저장한 기준 이미지가 올바르지 않습니다.');
        return image;
    };
    if (!Array.isArray(data.slotVariants) || data.slotVariants.length !== 24 || data.slotVariants.some(function (item) { return !item || typeof item.id !== 'string' || typeof item.name !== 'string' || !categories.has(item.category); })) {
        throw new Error('저장한 슬롯 정보가 올바르지 않습니다.');
    }
    if (!Array.isArray(data.slotPrompts) || data.slotPrompts.length !== 24 || data.slotPrompts.some(function (item) { return !item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.prompt !== 'string' || item.prompt.length > 10000; })) {
        throw new Error('저장한 프롬프트가 올바르지 않습니다.');
    }
    return {
        version: 1,
        title: title,
        tags: __spreadArray([], data.tags, true), description: text('description', 10000), category: text('category', 200),
        uploadedImage: optionalImage('uploadedImage'), canonicalImage: optionalImage('canonicalImage'),
        images: __spreadArray([], data.images, true),
        slotVariants: data.slotVariants.map(function (_a) {
            var id = _a.id, name = _a.name, category = _a.category;
            return ({ id: id, name: name, category: category });
        }),
        slotPrompts: data.slotPrompts.map(function (_a) {
            var id = _a.id, name = _a.name, prompt = _a.prompt;
            return ({ id: id, name: name, prompt: prompt });
        }),
    };
}
function encodeProductArchive(draft) {
    var archive = parseProductArchive(__assign(__assign({}, draft), { version: 1 }));
    var blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
    if (blob.size > exports.MAX_ARCHIVE_BYTES)
        throw new Error('상품의 이미지 용량이 너무 큽니다. 기준 이미지를 줄여 주세요.');
    return blob;
}
function productStoragePath(uid, id, revision) {
    if ([uid, id, revision].some(function (part) { return !part || /[/.]/.test(part); }))
        throw new Error('상품 저장 경로가 올바르지 않습니다.');
    return "users/".concat(uid, "/products/").concat(id, "/").concat(revision, ".json");
}
function assertProductPath(uid, summary) {
    var prefix = "users/".concat(uid, "/products/").concat(summary.id, "/");
    if (!summary.storagePath.startsWith(prefix) || !/^[a-zA-Z0-9_-]+\.json$/.test(summary.storagePath.slice(prefix.length))) {
        throw new Error('이 계정의 상품 저장 경로가 아닙니다.');
    }
}
