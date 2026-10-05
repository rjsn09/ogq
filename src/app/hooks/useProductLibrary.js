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
exports.useProductLibrary = useProductLibrary;
var react_1 = require("react");
var productRepository_1 = require("../lib/productRepository");
function storageMessage(error) {
    var code = error === null || error === void 0 ? void 0 : error.code;
    if (code === 'resource-exhausted')
        return 'Firestore 무료 사용량 한도에 도달했습니다. 저장 공간과 사용량을 확인하거나 일일 한도가 초기화된 후 다시 시도해 주세요.';
    if (code === 'permission-denied' || code === 'storage/unauthorized')
        return '계정 저장소에 접근할 수 없습니다. 저장소 설정을 확인해 주세요.';
    if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found')
        return '계정 저장소가 아직 준비되지 않았습니다.';
    return error instanceof Error ? error.message : '상품을 저장하거나 불러오지 못했습니다. 다시 시도해 주세요.';
}
function useProductLibrary(uid, open) {
    var _this = this;
    var account = (0, react_1.useRef)(uid);
    account.current = uid;
    var currentProduct = (0, react_1.useRef)(null);
    var savingLock = (0, react_1.useRef)(false);
    var loadController = (0, react_1.useRef)(null);
    var _a = (0, react_1.useState)({ products: [] }), list = _a[0], setList = _a[1];
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(false), saving = _c[0], setSaving = _c[1];
    var _d = (0, react_1.useState)(0), saveProgress = _d[0], setSaveProgress = _d[1];
    var _e = (0, react_1.useState)(null), notice = _e[0], setNotice = _e[1];
    var _f = (0, react_1.useState)(null), error = _f[0], setError = _f[1];
    var _g = (0, react_1.useState)(null), selection = _g[0], setSelection = _g[1];
    var _h = (0, react_1.useState)(null), selectedId = _h[0], setSelectedId = _h[1];
    var _j = (0, react_1.useState)(false), previewLoading = _j[0], setPreviewLoading = _j[1];
    (0, react_1.useEffect)(function () {
        var _a;
        (_a = loadController.current) === null || _a === void 0 ? void 0 : _a.abort();
        setSelection(null);
        setSelectedId(null);
        setPreviewLoading(false);
        setError(null);
        setNotice(null);
        currentProduct.current = null;
    }, [uid]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (open)
            return;
        (_a = loadController.current) === null || _a === void 0 ? void 0 : _a.abort();
        setSelection(null);
        setSelectedId(null);
        setPreviewLoading(false);
    }, [open]);
    (0, react_1.useEffect)(function () {
        if (!uid || !open)
            return;
        setLoading(true);
        setError(null);
        return (0, productRepository_1.subscribeProducts)(uid, function (products) {
            if (account.current !== uid)
                return;
            setList({ uid: uid, products: products });
            setSelection(function (current) { return (current === null || current === void 0 ? void 0 : current.uid) === uid && !products.some(function (product) { return product.id === current.summary.id && product.storagePath === current.summary.storagePath; }) ? null : current; });
            setLoading(false);
        }, function (failure) {
            if (account.current !== uid)
                return;
            setError(storageMessage(failure));
            setLoading(false);
        });
    }, [uid, open]);
    (0, react_1.useEffect)(function () { return function () { var _a; return (_a = loadController.current) === null || _a === void 0 ? void 0 : _a.abort(); }; }, []);
    var save = (0, react_1.useCallback)(function (draft) { return __awaiter(_this, void 0, void 0, function () {
        var current, id, failure_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!uid || savingLock.current)
                        return [2 /*return*/, false];
                    savingLock.current = true;
                    setSaving(true);
                    setSaveProgress(0);
                    setNotice(null);
                    setError(null);
                    current = currentProduct.current;
                    id = (current === null || current === void 0 ? void 0 : current.uid) === uid && (current.loaded || current.title === draft.title.trim()) ? current.id : crypto.randomUUID();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, productRepository_1.saveProduct)(uid, id, draft, function (percent) { if (account.current === uid)
                            setSaveProgress(percent); })];
                case 2:
                    _a.sent();
                    if (account.current === uid) {
                        currentProduct.current = { uid: uid, id: id, title: draft.title.trim(), loaded: current === null || current === void 0 ? void 0 : current.loaded };
                        setNotice("\u201C".concat(draft.title.trim(), "\u201D \uC0C1\uD488\uC744 \uACC4\uC815\uC5D0 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4."));
                    }
                    return [2 /*return*/, true];
                case 3:
                    failure_1 = _a.sent();
                    if (account.current === uid)
                        setError(storageMessage(failure_1));
                    return [2 /*return*/, false];
                case 4:
                    savingLock.current = false;
                    setSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [uid]);
    var select = (0, react_1.useCallback)(function (summary) { return __awaiter(_this, void 0, void 0, function () {
        var controller, data, failure_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!uid)
                        return [2 /*return*/];
                    (_a = loadController.current) === null || _a === void 0 ? void 0 : _a.abort();
                    controller = new AbortController();
                    loadController.current = controller;
                    setSelectedId(summary.id);
                    setSelection(null);
                    setPreviewLoading(true);
                    setError(null);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, productRepository_1.loadProduct)(uid, summary, controller.signal)];
                case 2:
                    data = _b.sent();
                    if (account.current === uid && !controller.signal.aborted)
                        setSelection({ uid: uid, summary: summary, data: data });
                    return [3 /*break*/, 5];
                case 3:
                    failure_2 = _b.sent();
                    if (account.current === uid && !controller.signal.aborted)
                        setError(storageMessage(failure_2));
                    return [3 /*break*/, 5];
                case 4:
                    if (account.current === uid && !controller.signal.aborted)
                        setPreviewLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [uid]);
    var markLoaded = (0, react_1.useCallback)(function (summary) {
        if (uid)
            currentProduct.current = { uid: uid, id: summary.id, title: summary.title, loaded: true };
        setNotice('상품의 이미지와 편집 정보를 불러왔습니다.');
        setError(null);
    }, [uid]);
    return {
        products: list.uid === uid ? list.products : [],
        selected: (selection === null || selection === void 0 ? void 0 : selection.uid) === uid ? selection : null,
        selectedId: selectedId,
        loading: loading,
        previewLoading: previewLoading,
        saving: saving,
        saveProgress: saveProgress,
        notice: notice,
        error: error,
        save: save,
        select: select,
        markLoaded: markLoaded,
    };
}
