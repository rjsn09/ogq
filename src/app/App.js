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
exports.default = App;
var react_1 = require("react");
var auth_1 = require("firebase/auth");
var firestore_1 = require("firebase/firestore");
var config_1 = require("./firebase/config");
var Login_1 = require("./Login");
var monitoring_1 = require("./lib/monitoring");
var TermsConsentModal_1 = require("./TermsConsentModal");
var Home_1 = require("./Home");
var InputPanel_1 = require("./components/InputPanel");
var GeneratedGrid_1 = require("./components/GeneratedGrid");
var CanonicalConfirmPanel_1 = require("./components/CanonicalConfirmPanel");
var useGenerationTask_1 = require("./hooks/useGenerationTask");
var approvedReference_1 = require("./lib/approvedReference");
var sse_1 = require("../api/sse");
var ProfileMenu_1 = require("./components/ProfileMenu");
var ProductLibraryDialog_1 = require("./components/ProductLibraryDialog");
var ProductSettingsDialog_1 = require("./components/ProductSettingsDialog");
var useProductLibrary_1 = require("./hooks/useProductLibrary");
var ogqGenerator_1 = require("./lib/ogqGenerator");
var imageGenerator_1 = require("./utils/imageGenerator");
var AdminDashboard = (0, react_1.lazy)(function () { return Promise.resolve().then(function () { return require("./components/AdminDashboard"); }); });
function Header(_a) {
    var userEmail = _a.userEmail, onLoginClick = _a.onLoginClick, onLogoClick = _a.onLogoClick, isAdmin = _a.isAdmin, onDashboardClick = _a.onDashboardClick, profileMenu = _a.profileMenu;
    return (<header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onLogoClick}>
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm shadow-primary/30">
            <img src="/ogqIcon.png" className="w-full h-full object-cover" alt="OGQ"/>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground" style={{ fontWeight: 700, fontSize: "1rem" }}>
              이모티콘 생성기
            </span>
            <span className="text-muted-foreground text-xs hidden sm:inline">
              네이버 OGQ 마켓 · 24장 자동 생성
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userEmail ? (<>
              <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                {userEmail}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs" style={{ fontWeight: 600 }}>
                Beta
              </span>
              {isAdmin && (<button onClick={onDashboardClick} className="px-3 py-1.5 rounded-xl border border-primary/40 text-xs text-primary hover:bg-muted transition-colors">
                  대시보드
                </button>)}
              {profileMenu}
            </>) : (<button onClick={onLoginClick} className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity font-mono" style={{ fontWeight: 600 }}>
              로그인
            </button>)}
        </div>
      </div>
    </header>);
}
function StepBadge(_a) {
    var step = _a.step, label = _a.label, done = _a.done;
    return (<div className={"flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ".concat(done
            ? "bg-secondary border-primary/30 text-secondary-foreground"
            : "bg-card border-border text-muted-foreground")} style={{ fontWeight: 500 }}>
      <span className={"w-4 h-4 rounded-full flex items-center justify-center ".concat(done
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground")} style={{ fontWeight: 700, fontSize: "10px" }}>
        {done ? "✓" : step}
      </span>
      {label}
    </div>);
}
function App() {
    var _this = this;
    var _a, _b, _c, _d;
    var _e = (0, react_1.useState)("home"), currentView = _e[0], setCurrentView = _e[1];
    var _f = (0, react_1.useState)(null), user = _f[0], setUser = _f[1];
    var _g = (0, react_1.useState)(false), isLoginModalOpen = _g[0], setIsLoginModalOpen = _g[1];
    var _h = (0, react_1.useState)(false), isTermsModalOpen = _h[0], setIsTermsModalOpen = _h[1];
    var _j = (0, react_1.useState)(false), hasAgreedTerms = _j[0], setHasAgreedTerms = _j[1];
    var _k = (0, react_1.useState)(false), isAdmin = _k[0], setIsAdmin = _k[1];
    (0, react_1.useEffect)(function () {
        var unsubscribeProfile;
        var unsubscribe = (0, auth_1.onAuthStateChanged)(config_1.auth, function (currentUser) {
            unsubscribeProfile === null || unsubscribeProfile === void 0 ? void 0 : unsubscribeProfile();
            setUser(currentUser);
            setIsAdmin(false);
            setHasAgreedTerms(false);
            setCurrentView(function (view) { return view === "dashboard" ? "home" : view; });
            if (!currentUser)
                return;
            setIsLoginModalOpen(false);
            void (0, monitoring_1.recordVisit)(currentUser.uid);
            unsubscribeProfile = (0, firestore_1.onSnapshot)((0, firestore_1.doc)(config_1.db, "users", currentUser.uid), function (snapshot) {
                var profile = snapshot.data();
                var admin = (profile === null || profile === void 0 ? void 0 : profile.isAdmin) === true;
                setIsAdmin(admin);
                setHasAgreedTerms((profile === null || profile === void 0 ? void 0 : profile.termsAgreed) === true);
                if (!admin)
                    setCurrentView(function (view) { return view === "dashboard" ? "home" : view; });
            }, function (error) {
                console.error("Firestore 사용자 정보 확인 실패:", error);
                setIsAdmin(false);
                setHasAgreedTerms(false);
                setCurrentView(function (view) { return view === "dashboard" ? "home" : view; });
            });
        });
        return function () { unsubscribe(); unsubscribeProfile === null || unsubscribeProfile === void 0 ? void 0 : unsubscribeProfile(); };
    }, []);
    var _l = (0, react_1.useState)(null), uploadedImage = _l[0], setUploadedImage = _l[1];
    var _m = (0, react_1.useState)(""), title = _m[0], setTitle = _m[1];
    var _o = (0, react_1.useState)([]), tags = _o[0], setTags = _o[1];
    var _p = (0, react_1.useState)(""), description = _p[0], setDescription = _p[1];
    var _q = (0, react_1.useState)("캐릭터"), category = _q[0], setCategory = _q[1];
    var _r = (0, react_1.useState)(false), isGenerating = _r[0], setIsGenerating = _r[1];
    var _s = (0, react_1.useState)([]), generatedImages = _s[0], setGeneratedImages = _s[1];
    var _t = (0, react_1.useState)(0), progress = _t[0], setProgress = _t[1];
    var _u = (0, react_1.useState)(new Set()), generatingIndices = _u[0], setGeneratingIndices = _u[1];
    var _v = (0, react_1.useState)(Array.from({ length: 24 }, function (_, i) { var _a; return (_a = imageGenerator_1.VARIANT_CATALOG[i]) !== null && _a !== void 0 ? _a : imageGenerator_1.DEFAULT_VARIANTS[i]; })), slotVariants = _v[0], setSlotVariants = _v[1];
    var _w = (0, react_1.useState)(Array.from({ length: 24 }, function (_, i) { var _a; return (_a = imageGenerator_1.VARIANT_PROMPTS[i]) !== null && _a !== void 0 ? _a : imageGenerator_1.DEFAULT_PROMPTS[i]; })), slotPrompts = _w[0], setSlotPrompts = _w[1];
    var _x = (0, react_1.useState)(null), canonicalId = _x[0], setCanonicalId = _x[1];
    var _y = (0, react_1.useState)(null), approvedCanonicalId = _y[0], setApprovedCanonicalId = _y[1];
    var _z = (0, react_1.useState)(false), canonicalPanelOpen = _z[0], setCanonicalPanelOpen = _z[1];
    var _0 = (0, react_1.useState)("generating"), canonicalStatus = _0[0], setCanonicalStatus = _0[1];
    var _1 = (0, react_1.useState)(null), canonicalImage = _1[0], setCanonicalImage = _1[1];
    var _2 = (0, react_1.useState)(null), canonicalError = _2[0], setCanonicalError = _2[1];
    var _3 = (0, react_1.useState)(false), canonicalBusy = _3[0], setCanonicalBusy = _3[1];
    var _4 = (0, react_1.useState)(false), libraryOpen = _4[0], setLibraryOpen = _4[1];
    var _5 = (0, react_1.useState)(false), settingsOpen = _5[0], setSettingsOpen = _5[1];
    var _6 = (0, react_1.useState)(true), autoSave = _6[0], setAutoSave = _6[1];
    var productLibrary = (0, useProductLibrary_1.useProductLibrary)(user === null || user === void 0 ? void 0 : user.uid, libraryOpen);
    (0, react_1.useEffect)(function () {
        var _a;
        setLibraryOpen(false);
        setSettingsOpen(false);
        try {
            setAutoSave(localStorage.getItem("ogq:autoSave:".concat((_a = user === null || user === void 0 ? void 0 : user.uid) !== null && _a !== void 0 ? _a : '')) !== 'false');
        }
        catch (_b) {
            setAutoSave(true);
        }
    }, [user === null || user === void 0 ? void 0 : user.uid]);
    var changeAutoSave = function (enabled) {
        var _a;
        setAutoSave(enabled);
        try {
            localStorage.setItem("ogq:autoSave:".concat((_a = user === null || user === void 0 ? void 0 : user.uid) !== null && _a !== void 0 ? _a : ''), String(enabled));
        }
        catch ( /* The preference still works for this session. */_b) { /* The preference still works for this session. */ }
    };
    var currentDraft = (0, react_1.useCallback)(function () { return ({
        title: title,
        tags: tags,
        description: description,
        category: category,
        uploadedImage: uploadedImage,
        canonicalImage: canonicalImage,
        images: Array.from({ length: 24 }, function (_, index) { var _a; return (_a = generatedImages[index]) !== null && _a !== void 0 ? _a : ''; }),
        slotVariants: slotVariants,
        slotPrompts: slotPrompts,
    }); }, [title, tags, description, category, uploadedImage, canonicalImage, generatedImages, slotVariants, slotPrompts]);
    var generationTask = (0, useGenerationTask_1.useGenerationTask)();
    var generationController = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () { return function () { var _a; return (_a = generationController.current) === null || _a === void 0 ? void 0 : _a.abort(); }; }, []);
    var pendingGenerationRef = (0, react_1.useRef)(null);
    var approvedReference = (0, react_1.useRef)(null);
    var referenceProfile = (0, react_1.useRef)({});
    var _7 = (0, react_1.useState)(false), referenceReady = _7[0], setReferenceReady = _7[1];
    var referenceVersion = (0, react_1.useRef)(0);
    var previousReferenceInputs = (0, react_1.useRef)({ source: uploadedImage, description: description });
    var invalidateCanonical = (0, react_1.useCallback)(function () {
        var _a;
        referenceVersion.current++;
        approvedReference.current = null;
        referenceProfile.current = {};
        if (user === null || user === void 0 ? void 0 : user.uid)
            void (0, approvedReference_1.referenceStorage)(user.uid, 'delete').catch(function () { });
        (_a = generationController.current) === null || _a === void 0 ? void 0 : _a.abort();
        setCanonicalBusy(false);
        setCanonicalId(null);
        setApprovedCanonicalId(null);
        setCanonicalImage(null);
        setCanonicalError(null);
        setCanonicalPanelOpen(false);
        pendingGenerationRef.current = null;
    }, [user === null || user === void 0 ? void 0 : user.uid]);
    (0, react_1.useEffect)(function () {
        var previous = previousReferenceInputs.current;
        previousReferenceInputs.current = { source: uploadedImage, description: description };
        if ((previous.source !== uploadedImage || previous.description.trim() !== description.trim()) && !(0, approvedReference_1.referenceMatches)(approvedReference.current, uploadedImage, description))
            invalidateCanonical();
    }, [description, uploadedImage, invalidateCanonical]);
    (0, react_1.useEffect)(function () {
        var version = ++referenceVersion.current;
        approvedReference.current = null;
        setCanonicalId(null);
        setApprovedCanonicalId(null);
        setCanonicalImage(null);
        setReferenceReady(false);
        if (!(user === null || user === void 0 ? void 0 : user.uid)) {
            setReferenceReady(true);
            return;
        }
        var active = true;
        void (0, approvedReference_1.referenceStorage)(user.uid, 'read').then(function (reference) {
            if (!active || version !== referenceVersion.current || !(reference === null || reference === void 0 ? void 0 : reference.image) || !reference.source || typeof reference.description !== 'string')
                return;
            approvedReference.current = reference;
            referenceProfile.current = reference;
            setUploadedImage(reference.source);
            setDescription(reference.description);
            setCanonicalImage(reference.image);
            setCanonicalId(reference.id);
            setApprovedCanonicalId(reference.id || 'cached-reference');
            setCanonicalStatus('approved');
        }).catch(function () { }).finally(function () { if (active)
            setReferenceReady(true); });
        return function () { var _a; active = false; (_a = generationController.current) === null || _a === void 0 ? void 0 : _a.abort(); };
    }, [user === null || user === void 0 ? void 0 : user.uid]);
    var handleVariantChange = (0, react_1.useCallback)(function (slotIndex, variantId) {
        var variant = imageGenerator_1.VARIANT_CATALOG.find(function (v) { return v.id === variantId; });
        if (!variant)
            return;
        setSlotVariants(function (prev) {
            var next = __spreadArray([], prev, true);
            next[slotIndex] = variant;
            return next;
        });
        setSlotPrompts(function (prev) {
            return prev.map(function (item, index) {
                return index === slotIndex
                    ? { id: variant.id, name: variant.name, prompt: "" }
                    : item;
            });
        });
    }, []);
    var handlePromptChange = (0, react_1.useCallback)(function (slotIndex, prompt) {
        setSlotPrompts(function (prev) {
            return prev.map(function (item, index) {
                return index === slotIndex ? __assign(__assign({}, item), { prompt: prompt }) : item;
            });
        });
    }, []);
    var runStickerGeneration = (0, react_1.useCallback)(function (approvedId, request) { return __awaiter(_this, void 0, void 0, function () {
        var task, draft, controller, reference, results, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsGenerating(true);
                    setProgress(0);
                    task = generationTask.begin(request.indices.length);
                    draft = currentDraft();
                    setGeneratingIndices(new Set(request.indices.map(function (index) { return index - 1; })));
                    if (!request.isPartial) {
                        setGeneratedImages([]);
                    }
                    controller = new AbortController();
                    generationController.current = controller;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, 8, 9]);
                    if (!(0, approvedReference_1.referenceMatches)(approvedReference.current, uploadedImage, description)) return [3 /*break*/, 3];
                    reference = approvedReference.current;
                    return [4 /*yield*/, (0, approvedReference_1.ensureApprovedReference)(reference, controller.signal)];
                case 2:
                    approvedId = _a.sent();
                    if (controller.signal.aborted)
                        return [2 /*return*/];
                    reference.id = approvedId;
                    setCanonicalId(approvedId);
                    setApprovedCanonicalId(approvedId);
                    if (user === null || user === void 0 ? void 0 : user.uid)
                        void (0, approvedReference_1.referenceStorage)(user.uid, 'write', reference).catch(function () { });
                    _a.label = 3;
                case 3: return [4 /*yield*/, (0, monitoring_1.monitorGeneration)(user.uid, request.indices.some(function (index) { return !!generatedImages[index - 1]; }), controller.signal, function () { return (0, ogqGenerator_1.generateOGQImagesFromCanonical)(approvedId, function (count, images) {
                        setProgress(count);
                        setGeneratedImages(images);
                        setGeneratingIndices(new Set(request.indices.slice(count).map(function (index) { return index - 1; })));
                    }, request.indices, request.variantAssignments, request.isPartial ? generatedImages : undefined, __assign({ signal: controller.signal, userPrompts: request.userPrompts }, task)); })];
                case 4:
                    results = _a.sent();
                    if (!(autoSave && !controller.signal.aborted)) return [3 /*break*/, 6];
                    return [4 /*yield*/, productLibrary.save(__assign(__assign({}, draft), { images: results }))];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [3 /*break*/, 9];
                case 7:
                    err_1 = _a.sent();
                    if (controller.signal.aborted || err_1 instanceof sse_1.GenerationCancelledError)
                        return [2 /*return*/];
                    console.error("이모티콘 생성 실패:", err_1);
                    alert("\uC0DD\uC131 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4: ".concat(err_1 instanceof Error ? err_1.message : String(err_1)));
                    return [3 /*break*/, 9];
                case 8:
                    setIsGenerating(false);
                    setGeneratingIndices(new Set());
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    }); }, [generatedImages, user, generationTask.begin, currentDraft, autoSave, productLibrary.save, uploadedImage, description]);
    // 생성 버튼 클릭 핸들러
    var handleGenerate = (0, react_1.useCallback)(function (indices) { return __awaiter(_this, void 0, void 0, function () {
        var isPartial, targetIndices, variantAssignments, request, task, controller, result, err_2;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!referenceReady || productLibrary.saving || isGenerating || canonicalBusy || (canonicalPanelOpen && canonicalStatus === "generating"))
                        return [2 /*return*/];
                    if (!user) {
                        setIsLoginModalOpen(true);
                        return [2 /*return*/];
                    }
                    if (!hasAgreedTerms) {
                        setIsTermsModalOpen(true);
                        return [2 /*return*/];
                    }
                    if (!uploadedImage) {
                        alert("1단계: 기준 캐릭터 이미지를 먼저 업로드해 주세요!");
                        return [2 /*return*/];
                    }
                    if (!title.trim()) {
                        alert("2단계: 이모티콘 제목을 입력해 주세요!");
                        return [2 /*return*/];
                    }
                    isPartial = !!indices && indices.length > 0;
                    targetIndices = indices && indices.length > 0
                        ? indices
                        : Array.from({ length: 24 }, function (_, i) { return i + 1; });
                    variantAssignments = targetIndices.reduce(function (acc, idx1based) {
                        var _a, _b, _c, _d;
                        acc[idx1based] =
                            (_d = (_b = (_a = slotVariants[idx1based - 1]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : (_c = imageGenerator_1.DEFAULT_VARIANTS[idx1based - 1]) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : "\uC774\uBAA8\uD2F0\uCF58 ".concat(idx1based);
                        return acc;
                    }, {});
                    request = {
                        indices: targetIndices,
                        variantAssignments: variantAssignments,
                        userPrompts: Object.fromEntries(targetIndices.map(function (index) {
                            var _a, _b;
                            return [
                                index,
                                (_b = (_a = slotPrompts[index - 1]) === null || _a === void 0 ? void 0 : _a.prompt.trim()) !== null && _b !== void 0 ? _b : "",
                            ];
                        })),
                        isPartial: isPartial,
                    };
                    if (!approvedCanonicalId) return [3 /*break*/, 2];
                    return [4 /*yield*/, runStickerGeneration(approvedCanonicalId, request)];
                case 1:
                    _e.sent();
                    return [2 /*return*/];
                case 2:
                    pendingGenerationRef.current = request;
                    setCanonicalPanelOpen(true);
                    if (canonicalId && canonicalStatus === "ready") {
                        return [2 /*return*/];
                    }
                    setCanonicalStatus("generating");
                    setCanonicalImage(null);
                    setCanonicalError(null);
                    setCanonicalBusy(true);
                    setProgress(0);
                    task = generationTask.begin(1);
                    controller = new AbortController();
                    (_a = generationController.current) === null || _a === void 0 ? void 0 : _a.abort();
                    generationController.current = controller;
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 5, 6, 7]);
                    return [4 /*yield*/, (0, monitoring_1.monitorGeneration)(user.uid, false, controller.signal, function () { return (0, ogqGenerator_1.createCanonical)(uploadedImage, description || undefined, __assign({ signal: controller.signal }, task)); })];
                case 4:
                    result = _e.sent();
                    if (controller.signal.aborted)
                        return [2 /*return*/];
                    setCanonicalId(result.canonical_id);
                    setCanonicalImage((_b = result.image) !== null && _b !== void 0 ? _b : null);
                    referenceProfile.current = { canonicalProfile: result.canonical_profile, originalProfile: result.original_profile, prompt: (_c = result.canonical_prompt) !== null && _c !== void 0 ? _c : undefined };
                    setCanonicalStatus(result.status);
                    return [3 /*break*/, 7];
                case 5:
                    err_2 = _e.sent();
                    if ((_d = generationController.current) === null || _d === void 0 ? void 0 : _d.signal.aborted)
                        return [2 /*return*/];
                    if (err_2 instanceof sse_1.GenerationCancelledError) {
                        setCanonicalStatus("cancelled");
                        return [2 /*return*/];
                    }
                    setCanonicalStatus("error");
                    setCanonicalError(err_2 instanceof Error
                        ? err_2.message
                        : "Canonical 생성 요청에 실패했습니다.");
                    return [3 /*break*/, 7];
                case 6:
                    setCanonicalBusy(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); }, [
        user,
        hasAgreedTerms,
        uploadedImage,
        title,
        description,
        slotVariants,
        slotPrompts,
        approvedCanonicalId,
        canonicalId,
        canonicalStatus,
        runStickerGeneration,
        generationTask.begin,
        isGenerating,
        canonicalBusy,
        canonicalPanelOpen,
        productLibrary.saving,
        referenceReady,
    ]);
    var handleTermsConfirm = function (allowAiTraining) { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(user === null || user === void 0 ? void 0 : user.uid))
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, firestore_1.setDoc)((0, firestore_1.doc)(config_1.db, "users", user.uid), {
                            termsAgreed: true,
                            termsVersion: "1.0",
                            agreedAt: (0, firestore_1.serverTimestamp)(),
                            allowAiTraining: allowAiTraining,
                            userEmail: user.email || "",
                        }, { merge: true })];
                case 2:
                    _a.sent();
                    setHasAgreedTerms(true);
                    setIsTermsModalOpen(false);
                    handleGenerate();
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _a.sent();
                    console.error("약관 동의 DB 저장 실패:", err_3);
                    alert("약관 동의 정보를 저장하지 못했습니다. 다시 시도해 주세요.");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleApproveCanonical = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var reference, pending, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!canonicalId || canonicalStatus !== "ready")
                        return [2 /*return*/];
                    setCanonicalBusy(true);
                    setCanonicalError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, (0, ogqGenerator_1.approveCanonical)(canonicalId)];
                case 2:
                    _a.sent();
                    if (canonicalImage && uploadedImage && (user === null || user === void 0 ? void 0 : user.uid)) {
                        reference = __assign({ source: uploadedImage, description: description.trim(), image: canonicalImage, id: canonicalId }, referenceProfile.current);
                        approvedReference.current = reference;
                        void (0, approvedReference_1.referenceStorage)(user.uid, 'write', reference).catch(function () { });
                    }
                    setApprovedCanonicalId(canonicalId);
                    setCanonicalStatus("approved");
                    setCanonicalPanelOpen(false);
                    pending = pendingGenerationRef.current;
                    pendingGenerationRef.current = null;
                    if (!pending) return [3 /*break*/, 4];
                    return [4 /*yield*/, runStickerGeneration(canonicalId, pending)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [3 /*break*/, 7];
                case 5:
                    err_4 = _a.sent();
                    setCanonicalError(err_4 instanceof Error
                        ? err_4.message
                        : "Canonical 승인에 실패했습니다.");
                    return [3 /*break*/, 7];
                case 6:
                    setCanonicalBusy(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); }, [canonicalId, canonicalStatus, runStickerGeneration, canonicalImage, uploadedImage, description, user === null || user === void 0 ? void 0 : user.uid]);
    var handleRegenerateCanonical = (0, react_1.useCallback)(function (editRequest) { return __awaiter(_this, void 0, void 0, function () {
        var task_1, controller_1, result, err_5;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!canonicalId || !(user === null || user === void 0 ? void 0 : user.uid))
                        return [2 /*return*/];
                    setCanonicalBusy(true);
                    setCanonicalError(null);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    approvedReference.current = null;
                    setApprovedCanonicalId(null);
                    void (0, approvedReference_1.referenceStorage)(user.uid, 'delete').catch(function () { });
                    setCanonicalStatus("generating");
                    setCanonicalImage(null);
                    setProgress(0);
                    task_1 = generationTask.begin(1);
                    controller_1 = new AbortController();
                    generationController.current = controller_1;
                    return [4 /*yield*/, (0, monitoring_1.monitorGeneration)(user.uid, true, controller_1.signal, function () { return (0, ogqGenerator_1.regenerateCanonical)(canonicalId, editRequest, {
                            signal: controller_1.signal, onStart: task_1.onStart, onProgress: task_1.onStatus,
                        }); })];
                case 2:
                    result = _d.sent();
                    if (controller_1.signal.aborted)
                        return [2 /*return*/];
                    setCanonicalImage((_a = result.image) !== null && _a !== void 0 ? _a : null);
                    referenceProfile.current = { canonicalProfile: result.canonical_profile, originalProfile: result.original_profile, prompt: (_b = result.canonical_prompt) !== null && _b !== void 0 ? _b : undefined };
                    setCanonicalStatus(result.status);
                    return [3 /*break*/, 5];
                case 3:
                    err_5 = _d.sent();
                    if ((_c = generationController.current) === null || _c === void 0 ? void 0 : _c.signal.aborted)
                        return [2 /*return*/];
                    if (err_5 instanceof sse_1.GenerationCancelledError) {
                        setCanonicalStatus("cancelled");
                        return [2 /*return*/];
                    }
                    setCanonicalStatus("error");
                    setCanonicalError(err_5 instanceof Error
                        ? err_5.message
                        : "Canonical 재생성 요청에 실패했습니다.");
                    return [3 /*break*/, 5];
                case 4:
                    setCanonicalBusy(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [canonicalId, user, generationTask.begin]);
    var handleCancelGeneration = function () { return __awaiter(_this, void 0, void 0, function () {
        var controller;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    controller = generationController.current;
                    return [4 /*yield*/, generationTask.cancel()];
                case 1:
                    if (_a.sent()) {
                        controller === null || controller === void 0 ? void 0 : controller.abort();
                        if (canonicalPanelOpen && canonicalStatus === "generating") {
                            setCanonicalStatus("cancelled");
                            pendingGenerationRef.current = null;
                        }
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var handleCloseCanonicalPanel = (0, react_1.useCallback)(function () {
        if (canonicalStatus === "generating" || canonicalBusy)
            return;
        setCanonicalPanelOpen(false);
        pendingGenerationRef.current = null;
    }, [canonicalBusy, canonicalStatus]);
    // 🌟 Home에서 검색어나 캐릭터를 선택했을 때 에디터로 넘어가는 핸들러
    var handleStartFromHome = function (presetText) {
        if (presetText) {
            setDescription(presetText);
            setTitle(presetText.slice(0, 15)); // 제목 자동 기입 보조
        }
        setCurrentView("editor");
    };
    var handleLoadProduct = function () {
        var selected = productLibrary.selected;
        if (!selected || isGenerating || canonicalBusy || productLibrary.saving)
            return;
        invalidateCanonical();
        var data = selected.data;
        setUploadedImage(data.uploadedImage);
        setTitle(data.title);
        setTags(data.tags);
        setDescription(data.description);
        setCategory(data.category);
        setGeneratedImages(data.images);
        setSlotVariants(data.slotVariants);
        setSlotPrompts(data.slotPrompts);
        if (data.uploadedImage && data.canonicalImage && data.images.some(Boolean)) {
            var reference = { source: data.uploadedImage, description: data.description.trim(), image: data.canonicalImage, id: null };
            approvedReference.current = reference;
            setCanonicalImage(reference.image);
            setApprovedCanonicalId('cached-reference');
            setCanonicalStatus('approved');
            if (user === null || user === void 0 ? void 0 : user.uid)
                void (0, approvedReference_1.referenceStorage)(user.uid, 'write', reference).catch(function () { });
        }
        setProgress(0);
        setGeneratingIndices(new Set());
        productLibrary.markLoaded(selected.summary);
        setLibraryOpen(false);
        setCurrentView("editor");
    };
    var isReady = !!uploadedImage && !!title.trim();
    var uiBusy = !referenceReady ||
        productLibrary.saving ||
        isGenerating ||
        canonicalBusy ||
        (canonicalPanelOpen && canonicalStatus === "generating");
    return (<div className="min-h-screen bg-background">
      <Header userEmail={user ? (_a = user.email) !== null && _a !== void 0 ? _a : "내 계정" : null} isAdmin={isAdmin} onDashboardClick={function () { if (isAdmin)
        setCurrentView("dashboard"); }} onLoginClick={function () { return setIsLoginModalOpen(true); }} onLogoClick={function () { return setCurrentView("home"); }} profileMenu={user && <ProfileMenu_1.default email={(_b = user.email) !== null && _b !== void 0 ? _b : "내 계정"} busy={uiBusy} saving={productLibrary.saving} canSave={!!title.trim() && (!!uploadedImage || generatedImages.some(Boolean))} onSave={function () { return void productLibrary.save(currentDraft()); }} onOpenLibrary={function () { return setLibraryOpen(true); }} onSettings={function () { return setSettingsOpen(true); }} onLogout={function () { return void (0, auth_1.signOut)(config_1.auth); }}/>}/>

      {(productLibrary.saving || productLibrary.notice || productLibrary.error) && (<div className="mx-auto max-w-[1400px] px-6 pt-4">
          <div role={productLibrary.error ? "alert" : "status"} className={"rounded-xl border px-4 py-3 text-sm ".concat(productLibrary.error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-foreground")}>
            {productLibrary.saving ? "\uC0C1\uD488\uC744 \uACC4\uC815\uC5D0 \uC800\uC7A5\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4\u2026 ".concat(productLibrary.saveProgress, "%") : (_c = productLibrary.error) !== null && _c !== void 0 ? _c : productLibrary.notice}
          </div>
        </div>)}

      {/* 🌟 1. 접속 시 Home 화면이 먼저 뜸 */}
      {currentView === "dashboard" && isAdmin && user ? (<react_1.Suspense fallback={<p className="p-8" role="status">대시보드 불러오는 중…</p>}>
          <AdminDashboard uid={user.uid} onBack={function () { return setCurrentView("home"); }}/>
        </react_1.Suspense>) : currentView === "home" || currentView === "dashboard" ? (<Home_1.default onStart={handleStartFromHome}/>) : (
        /* 🌟 2. '만들기' 누른 후 에디터 화면 */
        <>
          <div className="max-w-[1400px] mx-auto px-6 pt-4">
            <button onClick={function () { return setCurrentView("home"); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors">
              ← 메인 소개 화면으로 돌아가기
            </button>
          </div>

          <div className="max-w-[1400px] mx-auto px-6 pt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StepBadge step={1} label="이미지 업로드" done={!!uploadedImage}/>
              <span className="text-border text-sm mx-0.5">→</span>

              <StepBadge step={2} label="정보 입력" done={!!title.trim()}/>
              <span className="text-border text-sm mx-0.5">→</span>

              <StepBadge step={3} label="캐릭터 확인" done={!!approvedCanonicalId}/>
              <span className="text-border text-sm mx-0.5">→</span>

              <StepBadge step={4} label="24장 생성" done={generatedImages.filter(Boolean).length === 24}/>
              <span className="text-border text-sm mx-0.5">→</span>

              <StepBadge step={5} label="다운로드" done={generatedImages.filter(Boolean).length === 24}/>
            </div>
          </div>

          <main className="max-w-[1400px] mx-auto px-6 py-5">
            <div className="grid gap-6" style={{ gridTemplateColumns: "420px 1fr" }}>
              <InputPanel_1.default uploadedImage={uploadedImage} setUploadedImage={function (value) {
                setUploadedImage(value);
                if (value !== uploadedImage)
                    invalidateCanonical();
                if (!value) {
                    setGeneratedImages([]);
                    setProgress(0);
                }
            }} title={title} setTitle={setTitle} tags={tags} setTags={setTags} description={description} setDescription={setDescription} category={category} setCategory={setCategory} onGenerate={handleGenerate} isGenerating={uiBusy} isReady={isReady}/>

              <GeneratedGrid_1.default images={generatedImages} slotVariants={slotVariants} slotPrompts={slotPrompts} onPromptChange={handlePromptChange} onVariantChange={handleVariantChange} isGenerating={uiBusy} progress={progress} showProgress={!productLibrary.saving && (isGenerating || canonicalBusy)} generatingIndices={generatingIndices} progressTotal={generationTask.total} elapsedSeconds={generationTask.elapsed} remainingSeconds={generationTask.remaining} canCancel={generationTask.registered} cancelling={generationTask.cancelling} cancelled={generationTask.cancelled} cancelError={generationTask.cancelError} onCancel={function () { return void handleCancelGeneration(); }} title={title} onGenerate={handleGenerate} isReady={isReady}/>
            </div>
          </main>
        </>)}

      <ProductLibraryDialog_1.default open={libraryOpen && !!user} onOpenChange={setLibraryOpen} products={productLibrary.products} selected={productLibrary.selected} selectedId={productLibrary.selectedId} loading={productLibrary.loading} previewLoading={productLibrary.previewLoading} error={productLibrary.error} onSelect={function (summary) { return void productLibrary.select(summary); }} onLoad={handleLoadProduct}/>
      <ProductSettingsDialog_1.default open={settingsOpen && !!user} onOpenChange={setSettingsOpen} email={(_d = user === null || user === void 0 ? void 0 : user.email) !== null && _d !== void 0 ? _d : "내 계정"} autoSave={autoSave} onAutoSaveChange={changeAutoSave}/>

      {/* 모달 공통 관리 */}
      <CanonicalConfirmPanel_1.default open={canonicalPanelOpen} status={canonicalStatus} image={canonicalImage} error={canonicalError} busy={canonicalBusy} onApprove={handleApproveCanonical} onRegenerate={handleRegenerateCanonical} onClose={handleCloseCanonicalPanel} elapsedSeconds={generationTask.elapsed} remainingSeconds={generationTask.remaining} canCancel={generationTask.registered} cancelling={generationTask.cancelling} cancelError={generationTask.cancelError} onCancel={function () { return void handleCancelGeneration(); }}/>

      {isLoginModalOpen && (<div style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
            }} onClick={function () { return setIsLoginModalOpen(false); }}>
          <div style={{ position: "relative" }} onClick={function (e) { return e.stopPropagation(); }}>
            <button type="button" onClick={function () { return setIsLoginModalOpen(false); }} style={{
                position: "absolute",
                top: 14,
                right: 14,
                zIndex: 10,
                background: "transparent",
                border: "none",
                fontSize: "16px",
                color: "#71717a",
                cursor: "pointer",
                padding: "4px 8px",
            }}>
              ✕
            </button>
            <Login_1.default onSuccess={function () {
                setIsLoginModalOpen(false);
            }}/>
          </div>
        </div>)}

      <TermsConsentModal_1.default isOpen={isTermsModalOpen} onClose={function () { return setIsTermsModalOpen(false); }} onConfirm={handleTermsConfirm}/>
    </div>);
}
