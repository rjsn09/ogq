import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase/config";
import Login from "./Login";
import { monitorGeneration, recordVisit } from "./lib/monitoring";
import TermsConsentModal from "./TermsConsentModal";
import Home from "./Home";
import InputPanel from "./components/InputPanel";
import GeneratedGrid from "./components/GeneratedGrid";
import CanonicalConfirmPanel from "./components/CanonicalConfirmPanel";
import { useGenerationTask } from "./hooks/useGenerationTask";
import { ensureApprovedReference, referenceMatches, referenceStorage, type ApprovedReference } from './lib/approvedReference';
import { GenerationCancelledError } from "../api/sse";
import ProfileMenu from "./components/ProfileMenu";
import ProductLibraryDialog from "./components/ProductLibraryDialog";
import ProductSettingsDialog from "./components/ProductSettingsDialog";
import { useProductLibrary } from "./hooks/useProductLibrary";
import type { ProductDraft } from "./lib/productArchive";
import {
  approveCanonical,
  createCanonical,
  generateOGQImagesFromCanonical,
  regenerateCanonical,
  type CanonicalStatusValue,
} from "./lib/ogqGenerator";
import {
  VARIANT_CATALOG,
  DEFAULT_VARIANTS,
  VARIANT_PROMPTS,
  DEFAULT_PROMPTS,
  Variant,
  Prompts,
} from "./utils/imageGenerator";

const AdminDashboard = lazy(() => import("./components/AdminDashboard"));

function Header({
  userEmail,
  onLoginClick,
  onLogoClick,
  isAdmin,
  onDashboardClick,
  profileMenu,
}: {
  userEmail?: string | null;
  onLoginClick: () => void;
  onLogoClick: () => void;
  isAdmin: boolean;
  onDashboardClick: () => void;
  profileMenu?: React.ReactNode;
}) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={onLogoClick}
        >
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm shadow-primary/30">
            <img
              src="/ogqIcon.png"
              className="w-full h-full object-cover"
              alt="OGQ"
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-foreground"
              style={{ fontWeight: 700, fontSize: "1rem" }}
            >
              이모티콘 생성기
            </span>
            <span className="text-muted-foreground text-xs hidden sm:inline">
              네이버 OGQ 마켓 · 24장 자동 생성
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userEmail ? (
            <>
              <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                {userEmail}
              </span>
              <span
                className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs"
                style={{ fontWeight: 600 }}
              >
                Beta
              </span>
              {isAdmin && (
                <button onClick={onDashboardClick} className="px-3 py-1.5 rounded-xl border border-primary/40 text-xs text-primary hover:bg-muted transition-colors">
                  대시보드
                </button>
              )}
              {profileMenu}
            </>
          ) : (
            <button
              onClick={onLoginClick}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity font-mono"
              style={{ fontWeight: 600 }}
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function StepBadge({
  step,
  label,
  done,
}: {
  step: number;
  label: string;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ${
        done
          ? "bg-secondary border-primary/30 text-secondary-foreground"
          : "bg-card border-border text-muted-foreground"
      }`}
      style={{ fontWeight: 500 }}
    >
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center ${
          done
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
        style={{ fontWeight: 700, fontSize: "10px" }}
      >
        {done ? "✓" : step}
      </span>
      {label}
    </div>
  );
}

type PendingGeneration = {
  indices: number[];
  variantAssignments: Record<number, string>;
  userPrompts: Record<number, string>;
  isPartial: boolean;
};

export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "editor" | "dashboard">("home");

  const [user, setUser] = useState<any>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [hasAgreedTerms, setHasAgreedTerms] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeProfile?.();
      setUser(currentUser);
      setIsAdmin(false);
      setHasAgreedTerms(false);
      setCurrentView((view) => view === "dashboard" ? "home" : view);
      if (!currentUser) return;
      setIsLoginModalOpen(false);
      void recordVisit(currentUser.uid);
      unsubscribeProfile = onSnapshot(doc(db, "users", currentUser.uid), (snapshot) => {
        const profile = snapshot.data();
        const admin = profile?.isAdmin === true;
        setIsAdmin(admin);
        setHasAgreedTerms(profile?.termsAgreed === true);
        if (!admin) setCurrentView((view) => view === "dashboard" ? "home" : view);
      }, (error) => {
        console.error("Firestore 사용자 정보 확인 실패:", error);
        setIsAdmin(false);
        setHasAgreedTerms(false);
        setCurrentView((view) => view === "dashboard" ? "home" : view);
      });
    });
    return () => { unsubscribe(); unsubscribeProfile?.(); };
  }, []);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("캐릭터");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [generatingIndices, setGeneratingIndices] = useState<Set<number>>(new Set());

  const [slotVariants, setSlotVariants] = useState<Variant[]>(
    Array.from(
      { length: 24 },
      (_, i) => VARIANT_CATALOG[i] ?? DEFAULT_VARIANTS[i]
    )
  );
  const [slotPrompts, setSlotPrompts] = useState<Prompts[]>(
    Array.from(
      { length: 24 },
      (_, i) => VARIANT_PROMPTS[i] ?? DEFAULT_PROMPTS[i]
    )
  );

  const [canonicalId, setCanonicalId] = useState<string | null>(null);
  const [approvedCanonicalId, setApprovedCanonicalId] =
    useState<string | null>(null);

  const [canonicalPanelOpen, setCanonicalPanelOpen] = useState(false);
  const [canonicalStatus, setCanonicalStatus] =
    useState<CanonicalStatusValue>("generating");
  const [canonicalImage, setCanonicalImage] = useState<string | null>(null);
  const [canonicalError, setCanonicalError] = useState<string | null>(null);
  const [canonicalBusy, setCanonicalBusy] = useState(false);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const productLibrary = useProductLibrary(user?.uid, libraryOpen);
  useEffect(() => {
    setLibraryOpen(false);
    setSettingsOpen(false);
    try { setAutoSave(localStorage.getItem(`ogq:autoSave:${user?.uid ?? ''}`) !== 'false'); }
    catch { setAutoSave(true); }
  }, [user?.uid]);
  const changeAutoSave = (enabled: boolean) => {
    setAutoSave(enabled);
    try { localStorage.setItem(`ogq:autoSave:${user?.uid ?? ''}`, String(enabled)); }
    catch { /* The preference still works for this session. */ }
  };
  const currentDraft = useCallback((): ProductDraft => ({
    title, tags, description, category, uploadedImage, canonicalImage,
    images: Array.from({ length: 24 }, (_, index) => generatedImages[index] ?? ''),
    slotVariants, slotPrompts,
  }), [title, tags, description, category, uploadedImage, canonicalImage, generatedImages, slotVariants, slotPrompts]);

  const generationTask = useGenerationTask();
  const generationController = useRef<AbortController | null>(null);
  useEffect(() => () => generationController.current?.abort(), []);

  const pendingGenerationRef = useRef<PendingGeneration | null>(null);
  const approvedReference = useRef<ApprovedReference | null>(null);
  const referenceProfile = useRef<{ canonicalProfile?: string; originalProfile?: string; prompt?: string }>({});
  const [referenceReady, setReferenceReady] = useState(false);
  const referenceVersion = useRef(0);
  const previousReferenceInputs = useRef({ source: uploadedImage, description });

  const invalidateCanonical = useCallback(() => {
    referenceVersion.current++;
    approvedReference.current = null;
    referenceProfile.current = {};
    if (user?.uid) void referenceStorage(user.uid, 'delete').catch(() => {});
    generationController.current?.abort();
    setCanonicalBusy(false);
    setCanonicalId(null);
    setApprovedCanonicalId(null);
    setCanonicalImage(null);
    setCanonicalError(null);
    setCanonicalPanelOpen(false);
    pendingGenerationRef.current = null;
  }, [user?.uid]);

  useEffect(() => {
    const previous = previousReferenceInputs.current;
    previousReferenceInputs.current = { source: uploadedImage, description };
    if ((previous.source !== uploadedImage || previous.description.trim() !== description.trim()) && !referenceMatches(approvedReference.current, uploadedImage, description)) invalidateCanonical();
  }, [description, uploadedImage, invalidateCanonical]);

  useEffect(() => {
    const version = ++referenceVersion.current;
    approvedReference.current = null;
    setCanonicalId(null);
    setApprovedCanonicalId(null);
    setCanonicalImage(null);
    setReferenceReady(false);
    if (!user?.uid) { setReferenceReady(true); return; }
    let active = true;
    void referenceStorage(user.uid, 'read').then(reference => {
      if (!active || version !== referenceVersion.current || !reference?.image || !reference.source || typeof reference.description !== 'string') return;
      approvedReference.current = reference;
      referenceProfile.current = reference;
      setUploadedImage(reference.source);
      setDescription(reference.description);
      setCanonicalImage(reference.image);
      setCanonicalId(reference.id);
      setApprovedCanonicalId(reference.id || 'cached-reference');
      setCanonicalStatus('approved');
    }).catch(() => {}).finally(() => { if (active) setReferenceReady(true); });
    return () => { active = false; generationController.current?.abort(); };
  }, [user?.uid]);

  const handleVariantChange = useCallback(
    (slotIndex: number, variantId: string) => {
      const variant = VARIANT_CATALOG.find((v) => v.id === variantId);
      if (!variant) return;

      setSlotVariants((prev) => {
        const next = [...prev];
        next[slotIndex] = variant;
        return next;
      });
      setSlotPrompts((prev) =>
        prev.map((item, index) =>
          index === slotIndex
            ? { id: variant.id, name: variant.name, prompt: "" }
            : item
        )
      );
    },
    []
  );

  const handlePromptChange = useCallback((slotIndex: number, prompt: string) => {
    setSlotPrompts((prev) =>
      prev.map((item, index) =>
        index === slotIndex ? { ...item, prompt } : item
      )
    );
  }, []);

  const runStickerGeneration = useCallback(
    async (approvedId: string, request: PendingGeneration) => {
      setIsGenerating(true);
      setProgress(0);
      const task = generationTask.begin(request.indices.length);
      const draft = currentDraft();
      setGeneratingIndices(new Set(request.indices.map(index => index - 1)));

      if (!request.isPartial) {
        setGeneratedImages([]);
      }

      const controller = new AbortController();
      generationController.current = controller;
      try {
        if (referenceMatches(approvedReference.current, uploadedImage, description)) {
          const reference = approvedReference.current!;
          approvedId = await ensureApprovedReference(reference, controller.signal);
          if (controller.signal.aborted) return;
          reference.id = approvedId;
          setCanonicalId(approvedId);
          setApprovedCanonicalId(approvedId);
          if (user?.uid) void referenceStorage(user.uid, 'write', reference).catch(() => {});
        }
        const results = await monitorGeneration(user.uid, request.indices.some((index) => !!generatedImages[index - 1]), controller.signal, () => generateOGQImagesFromCanonical(
          approvedId,
          (count, images) => {
            setProgress(count);
            setGeneratedImages(images);
            setGeneratingIndices(new Set(request.indices.slice(count).map(index => index - 1)));
          },
          request.indices,
          request.variantAssignments,
          request.isPartial ? generatedImages : undefined,
          { signal: controller.signal, userPrompts: request.userPrompts, ...task }
        ));
        if (autoSave && !controller.signal.aborted) {
          await productLibrary.save({ ...draft, images: results });
        }
      } catch (err) {
        if (controller.signal.aborted || err instanceof GenerationCancelledError) return;
        console.error("이모티콘 생성 실패:", err);
        alert(
          `생성 중 오류가 발생했습니다: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      } finally {
        setIsGenerating(false);
        setGeneratingIndices(new Set());
      }
    },
    [generatedImages, user, generationTask.begin, currentDraft, autoSave, productLibrary.save, uploadedImage, description]
  );

  // 생성 버튼 클릭 핸들러
  const handleGenerate = useCallback(
    async (indices?: number[]) => {
      if (!referenceReady || productLibrary.saving || isGenerating || canonicalBusy || (canonicalPanelOpen && canonicalStatus === "generating")) return;
      if (!user) {
        setIsLoginModalOpen(true);
        return;
      }

      if (!hasAgreedTerms) {
        setIsTermsModalOpen(true);
        return;
      }

      if (!uploadedImage) {
        alert("1단계: 기준 캐릭터 이미지를 먼저 업로드해 주세요!");
        return;
      }

      if (!title.trim()) {
        alert("2단계: 이모티콘 제목을 입력해 주세요!");
        return;
      }

      const isPartial = !!indices && indices.length > 0;

      const targetIndices =
        indices && indices.length > 0
          ? indices
          : Array.from({ length: 24 }, (_, i) => i + 1);

      const variantAssignments: Record<number, string> =
        targetIndices.reduce((acc, idx1based) => {
          acc[idx1based] =
            slotVariants[idx1based - 1]?.name ??
            DEFAULT_VARIANTS[idx1based - 1]?.name ??
            `이모티콘 ${idx1based}`;
          return acc;
        }, {} as Record<number, string>);

      const request: PendingGeneration = {
        indices: targetIndices,
        variantAssignments,
        userPrompts: Object.fromEntries(
          targetIndices.map((index) => [
            index,
            slotPrompts[index - 1]?.prompt.trim() ?? "",
          ])
        ),
        isPartial,
      };

      if (approvedCanonicalId) {
        await runStickerGeneration(approvedCanonicalId, request);
        return;
      }

      pendingGenerationRef.current = request;
      setCanonicalPanelOpen(true);

      if (canonicalId && canonicalStatus === "ready") {
        return;
      }

      setCanonicalStatus("generating");
      setCanonicalImage(null);
      setCanonicalError(null);
      setCanonicalBusy(true);
      setProgress(0);
      const task = generationTask.begin(1);

      const controller = new AbortController();
      generationController.current?.abort();
      generationController.current = controller;
      try {
        const result = await monitorGeneration(user.uid, false, controller.signal, () => createCanonical(
          uploadedImage,
          description || undefined,
          { signal: controller.signal, ...task }
        ));

        if (controller.signal.aborted) return;
        setCanonicalId(result.canonical_id);
        setCanonicalImage(result.image ?? null);
        referenceProfile.current = { canonicalProfile: result.canonical_profile, originalProfile: result.original_profile, prompt: result.canonical_prompt ?? undefined };
        setCanonicalStatus(result.status);
      } catch (err) {
        if (generationController.current?.signal.aborted) return;
        if (err instanceof GenerationCancelledError) { setCanonicalStatus("cancelled"); return; }
        setCanonicalStatus("error");
        setCanonicalError(
          err instanceof Error
            ? err.message
            : "Canonical 생성 요청에 실패했습니다."
        );
      } finally {
        setCanonicalBusy(false);
      }
    },
    [
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
    ]
  );

  const handleTermsConfirm = async (allowAiTraining: boolean) => {
    if (!user?.uid) return;

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          termsAgreed: true,
          termsVersion: "1.0",
          agreedAt: serverTimestamp(),
          allowAiTraining: allowAiTraining,
          userEmail: user.email || "",
        },
        { merge: true }
      );

      setHasAgreedTerms(true);
      setIsTermsModalOpen(false);
      handleGenerate();
    } catch (err) {
      console.error("약관 동의 DB 저장 실패:", err);
      alert("약관 동의 정보를 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const handleApproveCanonical = useCallback(async () => {
    if (!canonicalId || canonicalStatus !== "ready") return;

    setCanonicalBusy(true);
    setCanonicalError(null);

    try {
      await approveCanonical(canonicalId);
      if (canonicalImage && uploadedImage && user?.uid) {
        const reference = { source: uploadedImage, description: description.trim(), image: canonicalImage, id: canonicalId, ...referenceProfile.current };
        approvedReference.current = reference;
        void referenceStorage(user.uid, 'write', reference).catch(() => {});
      }

      setApprovedCanonicalId(canonicalId);
      setCanonicalStatus("approved");
      setCanonicalPanelOpen(false);

      const pending = pendingGenerationRef.current;
      pendingGenerationRef.current = null;

      if (pending) {
        await runStickerGeneration(canonicalId, pending);
      }
    } catch (err) {
      setCanonicalError(
        err instanceof Error
          ? err.message
          : "Canonical 승인에 실패했습니다."
      );
    } finally {
      setCanonicalBusy(false);
    }
  }, [canonicalId, canonicalStatus, runStickerGeneration, canonicalImage, uploadedImage, description, user?.uid]);

  const handleRegenerateCanonical = useCallback(
    async (editRequest: string) => {
      if (!canonicalId || !user?.uid) return;

      setCanonicalBusy(true);
      setCanonicalError(null);

      try {
        approvedReference.current = null;
        setApprovedCanonicalId(null);
        void referenceStorage(user.uid, 'delete').catch(() => {});
        setCanonicalStatus("generating");
        setCanonicalImage(null);
        setProgress(0);
        const task = generationTask.begin(1);
        const controller = new AbortController();
        generationController.current = controller;
        const result = await monitorGeneration(user.uid, true, controller.signal, () => regenerateCanonical(canonicalId, editRequest, {
          signal: controller.signal, onStart: task.onStart, onProgress: task.onStatus,
        }));
        if (controller.signal.aborted) return;
        setCanonicalImage(result.image ?? null);
        referenceProfile.current = { canonicalProfile: result.canonical_profile, originalProfile: result.original_profile, prompt: result.canonical_prompt ?? undefined };
        setCanonicalStatus(result.status);
      } catch (err) {
        if (generationController.current?.signal.aborted) return;
        if (err instanceof GenerationCancelledError) { setCanonicalStatus("cancelled"); return; }
        setCanonicalStatus("error");
        setCanonicalError(
          err instanceof Error
            ? err.message
            : "Canonical 재생성 요청에 실패했습니다."
        );
      } finally {
        setCanonicalBusy(false);
      }
    },
    [canonicalId, user, generationTask.begin]
  );

  const handleCancelGeneration = async () => {
    const controller = generationController.current;
    if (await generationTask.cancel()) {
      controller?.abort();
      if (canonicalPanelOpen && canonicalStatus === "generating") {
        setCanonicalStatus("cancelled");
        pendingGenerationRef.current = null;
      }
    }
  };

  const handleCloseCanonicalPanel = useCallback(() => {
    if (canonicalStatus === "generating" || canonicalBusy) return;

    setCanonicalPanelOpen(false);
    pendingGenerationRef.current = null;
  }, [canonicalBusy, canonicalStatus]);

  // 🌟 Home에서 검색어나 캐릭터를 선택했을 때 에디터로 넘어가는 핸들러
  const handleStartFromHome = (presetText?: string) => {
    if (presetText) {
      setDescription(presetText);
      setTitle(presetText.slice(0, 15)); // 제목 자동 기입 보조
    }
    setCurrentView("editor");
  };

  const handleLoadProduct = () => {
    const selected = productLibrary.selected;
    if (!selected || isGenerating || canonicalBusy || productLibrary.saving) return;
    invalidateCanonical();
    const data = selected.data;
    setUploadedImage(data.uploadedImage);
    setTitle(data.title);
    setTags(data.tags);
    setDescription(data.description);
    setCategory(data.category);
    setGeneratedImages(data.images);
    setSlotVariants(data.slotVariants);
    setSlotPrompts(data.slotPrompts);
    if (data.uploadedImage && data.canonicalImage && data.images.some(Boolean)) {
      const reference = { source: data.uploadedImage, description: data.description.trim(), image: data.canonicalImage, id: null };
      approvedReference.current = reference;
      setCanonicalImage(reference.image);
      setApprovedCanonicalId('cached-reference');
      setCanonicalStatus('approved');
      if (user?.uid) void referenceStorage(user.uid, 'write', reference).catch(() => {});
    }
    setProgress(0);
    setGeneratingIndices(new Set());
    productLibrary.markLoaded(selected.summary);
    setLibraryOpen(false);
    setCurrentView("editor");
  };

  const isReady = !!uploadedImage && !!title.trim();
  const uiBusy =
    !referenceReady ||
    productLibrary.saving ||
    isGenerating ||
    canonicalBusy ||
    (canonicalPanelOpen && canonicalStatus === "generating");

  return (
    <div className="min-h-screen bg-background">
      <Header
        userEmail={user ? user.email ?? "내 계정" : null}
        isAdmin={isAdmin}
        onDashboardClick={() => { if (isAdmin) setCurrentView("dashboard"); }}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoClick={() => setCurrentView("home")}
        profileMenu={user && <ProfileMenu email={user.email ?? "내 계정"} busy={uiBusy} saving={productLibrary.saving} canSave={!!title.trim() && (!!uploadedImage || generatedImages.some(Boolean))}
          onSave={() => void productLibrary.save(currentDraft())} onOpenLibrary={() => setLibraryOpen(true)} onSettings={() => setSettingsOpen(true)} onLogout={() => void signOut(auth)} />}
      />

      {(productLibrary.saving || productLibrary.notice || productLibrary.error) && (
        <div className="mx-auto max-w-[1400px] px-6 pt-4">
          <div role={productLibrary.error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${productLibrary.error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-foreground"}`}>
            {productLibrary.saving ? `상품을 계정에 저장하고 있습니다… ${productLibrary.saveProgress}%` : productLibrary.error ?? productLibrary.notice}
          </div>
        </div>
      )}

      {/* 🌟 1. 접속 시 Home 화면이 먼저 뜸 */}
      {currentView === "dashboard" && isAdmin && user ? (
        <Suspense fallback={<p className="p-8" role="status">대시보드 불러오는 중…</p>}>
          <AdminDashboard uid={user.uid} onBack={() => setCurrentView("home")} />
        </Suspense>
      ) : currentView === "home" || currentView === "dashboard" ? (
        <Home onStart={handleStartFromHome} />
      ) : (
        /* 🌟 2. '만들기' 누른 후 에디터 화면 */
        <>
          <div className="max-w-[1400px] mx-auto px-6 pt-4">
            <button
              onClick={() => setCurrentView("home")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
            >
              ← 메인 소개 화면으로 돌아가기
            </button>
          </div>

          <div className="max-w-[1400px] mx-auto px-6 pt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StepBadge step={1} label="이미지 업로드" done={!!uploadedImage} />
              <span className="text-border text-sm mx-0.5">→</span>

              <StepBadge step={2} label="정보 입력" done={!!title.trim()} />
              <span className="text-border text-sm mx-0.5">→</span>

              <StepBadge step={3} label="캐릭터 확인" done={!!approvedCanonicalId} />
              <span className="text-border text-sm mx-0.5">→</span>

              <StepBadge
                step={4}
                label="24장 생성"
                done={generatedImages.filter(Boolean).length === 24}
              />
              <span className="text-border text-sm mx-0.5">→</span>

              <StepBadge
                step={5}
                label="다운로드"
                done={generatedImages.filter(Boolean).length === 24}
              />
            </div>
          </div>

          <main className="max-w-[1400px] mx-auto px-6 py-5">
            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: "420px 1fr" }}
            >
              <InputPanel
                uploadedImage={uploadedImage}
                setUploadedImage={(value) => {
                  setUploadedImage(value);
                  if (value !== uploadedImage) invalidateCanonical();
                  if (!value) {
                    setGeneratedImages([]);
                    setProgress(0);
                  }
                }}
                title={title}
                setTitle={setTitle}
                tags={tags}
                setTags={setTags}
                description={description}
                setDescription={setDescription}
                category={category}
                setCategory={setCategory}
                onGenerate={handleGenerate}
                isGenerating={uiBusy}
                isReady={isReady}
              />

              <GeneratedGrid
                images={generatedImages}
                slotVariants={slotVariants}
                slotPrompts={slotPrompts}
                onPromptChange={handlePromptChange}
                onVariantChange={handleVariantChange}
                isGenerating={uiBusy}
                progress={progress}
                showProgress={!productLibrary.saving && (isGenerating || canonicalBusy)}
                generatingIndices={generatingIndices}
                progressTotal={generationTask.total}
                elapsedSeconds={generationTask.elapsed}
                remainingSeconds={generationTask.remaining}
                canCancel={generationTask.registered}
                cancelling={generationTask.cancelling}
                cancelled={generationTask.cancelled}
                cancelError={generationTask.cancelError}
                onCancel={() => void handleCancelGeneration()}
                title={title}
                onGenerate={handleGenerate}
                isReady={isReady}
              />
            </div>
          </main>
        </>
      )}

      <ProductLibraryDialog open={libraryOpen && !!user} onOpenChange={setLibraryOpen} products={productLibrary.products} selected={productLibrary.selected} selectedId={productLibrary.selectedId}
        loading={productLibrary.loading} previewLoading={productLibrary.previewLoading} error={productLibrary.error} onSelect={summary => void productLibrary.select(summary)} onLoad={handleLoadProduct} />
      <ProductSettingsDialog open={settingsOpen && !!user} onOpenChange={setSettingsOpen} email={user?.email ?? "내 계정"} autoSave={autoSave} onAutoSaveChange={changeAutoSave} />

      {/* 모달 공통 관리 */}
      <CanonicalConfirmPanel
        open={canonicalPanelOpen}
        status={canonicalStatus}
        image={canonicalImage}
        error={canonicalError}
        busy={canonicalBusy}
        onApprove={handleApproveCanonical}
        onRegenerate={handleRegenerateCanonical}
        onClose={handleCloseCanonicalPanel}
        elapsedSeconds={generationTask.elapsed}
        remainingSeconds={generationTask.remaining}
        canCancel={generationTask.registered}
        cancelling={generationTask.cancelling}
        cancelError={generationTask.cancelError}
        onCancel={() => void handleCancelGeneration()}
      />

      {isLoginModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setIsLoginModalOpen(false)}
        >
          <div
            style={{ position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(false)}
              style={{
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
              }}
            >
              ✕
            </button>
            <Login
              onSuccess={() => {
                setIsLoginModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      <TermsConsentModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onConfirm={handleTermsConfirm}
      />
    </div>
  );
}
