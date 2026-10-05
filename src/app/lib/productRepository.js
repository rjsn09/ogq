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
exports.subscribeProducts = subscribeProducts;
exports.saveProduct = saveProduct;
exports.loadProduct = loadProduct;
var firestore_1 = require("firebase/firestore");
var config_1 = require("../firebase/config");
var productArchive_1 = require("./productArchive");
var productFiles_1 = require("./productFiles");
var supabaseStorage_1 = require("./supabaseStorage");
function storageClient(uid) {
    var _this = this;
    var _a, _b, _c, _d, _e;
    return (0, supabaseStorage_1.createStorageClient)({
        url: (_b = (_a = import.meta.env.VITE_SUPABASE_URL) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '',
        key: (_d = (_c = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '',
        bucket: ((_e = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET) === null || _e === void 0 ? void 0 : _e.trim()) || 'product-images',
    }, function (refresh) { return __awaiter(_this, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            user = config_1.auth.currentUser;
            if (!user || user.uid !== uid)
                throw new Error('상품을 저장한 계정으로 로그인해 주세요.');
            return [2 /*return*/, user.getIdToken(refresh)];
        });
    }); });
}
function subscribeProducts(uid, onProducts, onError) {
    return (0, firestore_1.onSnapshot)((0, firestore_1.query)((0, firestore_1.collection)(config_1.db, 'users', uid, 'products'), (0, firestore_1.orderBy)('updatedAt', 'desc')), function (snapshot) {
        onProducts(snapshot.docs.map(function (item) {
            var _a, _b, _c, _d;
            var data = item.data();
            return { id: item.id, title: data.title, imageCount: data.imageCount, coverImage: (_a = data.coverImage) !== null && _a !== void 0 ? _a : null,
                storagePath: data.storagePath, updatedAt: (_d = (_c = (_b = data.updatedAt) === null || _b === void 0 ? void 0 : _b.toMillis) === null || _c === void 0 ? void 0 : _c.call(_b)) !== null && _d !== void 0 ? _d : Date.now() };
        }));
    }, onError);
}
function thumbnail(image) {
    return __awaiter(this, void 0, void 0, function () {
        var source, canvas, context, scale, width, height, cover;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!image)
                        return [2 /*return*/, null];
                    source = new Image();
                    source.src = image;
                    return [4 /*yield*/, source.decode()];
                case 1:
                    _a.sent();
                    canvas = document.createElement('canvas');
                    canvas.width = canvas.height = 128;
                    context = canvas.getContext('2d');
                    if (!context)
                        return [2 /*return*/, null];
                    scale = Math.min(128 / source.naturalWidth, 128 / source.naturalHeight);
                    width = source.naturalWidth * scale, height = source.naturalHeight * scale;
                    context.drawImage(source, (128 - width) / 2, (128 - height) / 2, width, height);
                    cover = canvas.toDataURL('image/webp', 0.75);
                    return [2 /*return*/, cover.length < 60000 ? cover : null];
            }
        });
    });
}
function saveProduct(uid, id, draft, onProgress) {
    return __awaiter(this, void 0, void 0, function () {
        var storage, productRef, storagePath, _a, files, manifest, coverImage, previous, paths, _b;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    storage = storageClient(uid);
                    (0, productArchive_1.encodeProductArchive)(draft); // Validate schema and total original size before any upload.
                    productRef = (0, firestore_1.doc)(config_1.db, 'users', uid, 'products', id);
                    storagePath = (0, productArchive_1.productStoragePath)(uid, id, crypto.randomUUID());
                    _a = (0, productFiles_1.createProductFiles)(uid, id, storagePath, draft), files = _a.files, manifest = _a.manifest;
                    return [4 /*yield*/, thumbnail(draft.images.find(Boolean) || draft.uploadedImage || undefined)];
                case 1:
                    coverImage = _c.sent();
                    return [4 /*yield*/, (0, productFiles_1.commitProductFiles)(storage, files, function () { return (0, firestore_1.runTransaction)(config_1.db, function (transaction) { return __awaiter(_this, void 0, void 0, function () {
                            var old;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, transaction.get(productRef)];
                                    case 1:
                                        old = (_a.sent()).data();
                                        transaction.set(productRef, {
                                            title: draft.title.trim(), imageCount: draft.images.filter(Boolean).length,
                                            coverImage: coverImage,
                                            storagePath: storagePath,
                                            imagePaths: manifest.images, updatedAt: (0, firestore_1.serverTimestamp)(), version: 3, provider: 'supabase',
                                        });
                                        return [2 /*return*/, old];
                                }
                            });
                        }); }); }, onProgress)];
                case 2:
                    previous = _c.sent();
                    if (!((previous === null || previous === void 0 ? void 0 : previous.version) === 3 && previous.provider === 'supabase' && previous.storagePath)) return [3 /*break*/, 6];
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 5, , 6]);
                    paths = (0, productFiles_1.revisionPaths)(uid, id, previous.storagePath);
                    return [4 /*yield*/, storage.remove(__spreadArray(__spreadArray([], paths, true), [previous.storagePath], false))];
                case 4:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 5:
                    _b = _c.sent();
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function loadProduct(uid, summary, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var storage, manifest, archive, value, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    signal === null || signal === void 0 ? void 0 : signal.throwIfAborted();
                    (0, productArchive_1.assertProductPath)(uid, summary);
                    storage = storageClient(uid);
                    return [4 /*yield*/, (0, firestore_1.getDoc)((0, firestore_1.doc)(config_1.db, 'users', uid, 'products', summary.id))];
                case 1:
                    manifest = (_c.sent()).data();
                    signal === null || signal === void 0 ? void 0 : signal.throwIfAborted();
                    if (!manifest || manifest.version !== 3 || manifest.provider !== 'supabase') {
                        throw new Error('이 상품은 이전 저장 방식입니다. 기존 편집 화면에서 다시 저장해 주세요.');
                    }
                    (0, productArchive_1.assertProductPath)(uid, __assign(__assign({}, summary), { storagePath: manifest.storagePath }));
                    return [4 /*yield*/, storage.download(manifest.storagePath, signal)];
                case 2:
                    archive = _c.sent();
                    if (archive.size > 1024 * 1024)
                        throw new Error('상품 보관 파일이 올바르지 않습니다.');
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, archive.text()];
                case 3:
                    value = _b.apply(_a, [_c.sent()]);
                    return [2 /*return*/, (0, productFiles_1.restoreProductFiles)(uid, summary.id, manifest.storagePath, value, function (path) { return storage.download(path, signal); })];
            }
        });
    });
}
