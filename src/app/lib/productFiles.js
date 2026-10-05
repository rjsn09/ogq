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
exports.commitProductFiles = commitProductFiles;
exports.revisionPaths = revisionPaths;
exports.createProductFiles = createProductFiles;
exports.restoreProductFiles = restoreProductFiles;
var productArchive_ts_1 = require("./productArchive.ts");
function commitProductFiles(storage, files, publish, onProgress) {
    return __awaiter(this, void 0, void 0, function () {
        var total, uploaded, _i, files_1, file, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    total = files.reduce(function (sum, file) { return sum + file.blob.size; }, 0);
                    uploaded = 0;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 9]);
                    _i = 0, files_1 = files;
                    _a.label = 2;
                case 2:
                    if (!(_i < files_1.length)) return [3 /*break*/, 5];
                    file = files_1[_i];
                    return [4 /*yield*/, storage.upload(file.path, file.blob)];
                case 3:
                    _a.sent();
                    uploaded += file.blob.size;
                    onProgress(Math.round(uploaded / total * 95));
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [4 /*yield*/, publish()];
                case 6:
                    result = _a.sent();
                    onProgress(100);
                    return [2 /*return*/, result];
                case 7:
                    error_1 = _a.sent();
                    return [4 /*yield*/, storage.remove(files.map(function (file) { return file.path; })).catch(function () { })];
                case 8:
                    _a.sent();
                    throw error_1;
                case 9: return [2 /*return*/];
            }
        });
    });
}
var mimeTypes = {
    png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp',
};
function revisionPaths(uid, id, archivePath) {
    (0, productArchive_ts_1.assertProductPath)(uid, { id: id, storagePath: archivePath });
    var prefix = archivePath.slice(0, -5) + '/';
    var names = __spreadArray(['source', 'canonical'], Array.from({ length: 24 }, function (_, index) { return "slot-".concat(index + 1); }), true);
    return names.flatMap(function (name) { return Object.keys(mimeTypes).map(function (extension) { return "".concat(prefix).concat(name, ".").concat(extension); }); });
}
function createProductFiles(uid, id, archivePath, draft) {
    var archive = (0, productArchive_ts_1.parseProductArchive)(__assign(__assign({}, draft), { version: 1 }));
    revisionPaths(uid, id, archivePath);
    var prefix = archivePath.slice(0, -5) + '/';
    var files = [];
    var total = 0;
    var convert = function (data, name) {
        if (!data)
            return data;
        var _a = /^data:image\/([^;]+);base64,([\s\S]+)$/.exec(data), extension = _a[1], encoded = _a[2];
        var binary = atob(encoded);
        var blob = new Blob([Uint8Array.from(binary, function (character) { return character.charCodeAt(0); })], { type: mimeTypes[extension] });
        total += blob.size;
        if (total > productArchive_ts_1.MAX_ARCHIVE_BYTES || blob.size > 50 * 1024 * 1024)
            throw new Error('상품 이미지 용량이 너무 큽니다.');
        var path = "".concat(prefix).concat(name, ".").concat(extension);
        files.push({ path: path, blob: blob });
        return path;
    };
    var manifest = __assign(__assign({}, archive), { fileVersion: 1, uploadedImage: convert(archive.uploadedImage, 'source'), canonicalImage: convert(archive.canonicalImage, 'canonical'), images: archive.images.map(function (image, index) { var _a; return (_a = convert(image, "slot-".concat(index + 1))) !== null && _a !== void 0 ? _a : ''; }) });
    files.push({ path: archivePath, blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }) });
    return { manifest: manifest, files: files };
}
function restoreProductFiles(uid, id, archivePath, value, download) {
    return __awaiter(this, void 0, void 0, function () {
        var allowed, manifest, _i, _a, path, total, restore, images, index, _b, _c, _d, _e, _f;
        var _g;
        var _this = this;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    allowed = new Set(revisionPaths(uid, id, archivePath));
                    if (!value || typeof value !== 'object')
                        throw new Error('상품 보관 파일이 올바르지 않습니다.');
                    manifest = value;
                    if (manifest.fileVersion !== 1 || !Array.isArray(manifest.images) || manifest.images.length !== 24)
                        throw new Error('상품 보관 파일이 올바르지 않습니다.');
                    // Validate every reference before making any download request.
                    for (_i = 0, _a = __spreadArray([manifest.uploadedImage, manifest.canonicalImage], manifest.images, true); _i < _a.length; _i++) {
                        path = _a[_i];
                        if (path !== null && path !== '' && (typeof path !== 'string' || !allowed.has(path)))
                            throw new Error('다른 상품의 이미지 경로는 불러올 수 없습니다.');
                    }
                    total = 0;
                    restore = function (path) { return __awaiter(_this, void 0, void 0, function () {
                        var filePath, blob, bytes, _a, parts, offset, extension;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (path === null)
                                        return [2 /*return*/, null];
                                    if (path === '')
                                        return [2 /*return*/, ''];
                                    filePath = path;
                                    return [4 /*yield*/, download(filePath)];
                                case 1:
                                    blob = _b.sent();
                                    total += blob.size;
                                    if (total > productArchive_ts_1.MAX_ARCHIVE_BYTES)
                                        throw new Error('상품 이미지 용량이 너무 큽니다.');
                                    _a = Uint8Array.bind;
                                    return [4 /*yield*/, blob.arrayBuffer()];
                                case 2:
                                    bytes = new (_a.apply(Uint8Array, [void 0, _b.sent()]))();
                                    parts = [];
                                    for (offset = 0; offset < bytes.length; offset += 32768)
                                        parts.push(String.fromCharCode.apply(String, bytes.subarray(offset, offset + 32768)));
                                    extension = filePath.slice(filePath.lastIndexOf('.') + 1);
                                    return [2 /*return*/, "data:".concat(mimeTypes[extension], ";base64,").concat(btoa(parts.join('')))];
                            }
                        });
                    }); };
                    images = [];
                    index = 0;
                    _h.label = 1;
                case 1:
                    if (!(index < 24)) return [3 /*break*/, 4];
                    _c = (_b = images.push).apply;
                    _d = [images];
                    return [4 /*yield*/, Promise.all(manifest.images.slice(index, index + 4).map(function (path) { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, restore(path)];
                                case 1: return [2 /*return*/, (_a = _b.sent()) !== null && _a !== void 0 ? _a : ''];
                            }
                        }); }); }))];
                case 2:
                    _c.apply(_b, _d.concat([_h.sent()]));
                    _h.label = 3;
                case 3:
                    index += 4;
                    return [3 /*break*/, 1];
                case 4:
                    _e = productArchive_ts_1.parseProductArchive;
                    _f = [__assign({}, manifest)];
                    _g = { images: images };
                    return [4 /*yield*/, restore(manifest.uploadedImage)];
                case 5:
                    _g.uploadedImage = _h.sent();
                    return [4 /*yield*/, restore(manifest.canonicalImage)];
                case 6: return [2 /*return*/, _e.apply(void 0, [__assign.apply(void 0, _f.concat([(_g.canonicalImage = _h.sent(), _g)]))])];
            }
        });
    });
}
