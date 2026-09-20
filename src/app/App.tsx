import React, { useState, useCallback, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase/config";
import Login from "./Login";
import TermsConsentModal from "./TermsConsentModal";
import InputPanel from "./components/InputPanel";
import GeneratedGrid from "./components/GeneratedGrid";
import CanonicalConfirmPanel from "./components/CanonicalConfirmPanel";
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

function Header({
  userEmail,
  onLoginClick,
}: {
  userEmail?: string | null;
  onLoginClick: () => void;
}) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
              <button
                onClick={() => signOut(auth)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs text-red-400 hover:bg-muted transition-colors font-mono"
                style={{ fontWeight: 500 }}
              >
                로그아웃
              </button>
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
  const [user, setUser] = useState<any>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [hasAgreedTerms, setHasAgreedTerms] = useState(false);

  // Firestore DB에서 사용자 약관 동의 이력 조회
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsLoginModalOpen(false);

        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists() && docSnap.data()?.termsAgreed === true) {
            setHasAgreedTerms(true);
          } else {
            setHasAgreedTerms(false);
          }
        } catch (err) {
          console.error("Firestore 약관 동의 확인 실패:", err);
          setHasAgreedTerms(false);
        }
      } else {
        setHasAgreedTerms(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("캐릭터");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

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

  const generationController = useRef<AbortController | null>(null);
  useEffect(() => () => generationController.current?.abort(), []);

  const pendingGenerationRef = useRef<PendingGeneration | null>(null);

  const invalidateCanonical = useCallback(() => {
    generationController.current?.abort();
    setCanonicalBusy(false);
    setCanonicalId(null);
    setApprovedCanonicalId(null);
    setCanonicalImage(null);
    setCanonicalError(null);
    setCanonicalPanelOpen(false);
    pendingGenerationRef.current = null;
  }, []);

  useEffect(() => {
    invalidateCanonical();
  }, [description, invalidateCanonical]);

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

      if (!request.isPartial) {
        setGeneratedImages([]);
      }

      const controller = new AbortController();
      generationController.current = controller;
      try {
        await generateOGQImagesFromCanonical(
          approvedId,
          (count, images) => {
            setProgress(count);
            setGeneratedImages(images);
          },
          request.indices,
          request.variantAssignments,
          request.isPartial ? generatedImages : undefined,
          { signal: controller.signal, userPrompts: request.userPrompts }
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("이모티콘 생성 실패:", err);
        alert(
          `생성 중 오류가 발생했습니다: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [generatedImages]
  );

  // 생성 버튼 클릭 핸들러
  const handleGenerate = useCallback(
    async (indices?: number[]) => {
      // 1. 비로그인 시 로그인 팝업
      if (!user) {
        setIsLoginModalOpen(true);
        return;
      }

      // 2. Firestore DB 미동의 상태일 때 약관 동의 팝업
      if (!hasAgreedTerms) {
        setIsTermsModalOpen(true);
        return;
      }

      // 3. 필수 입력값 체크
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

      const controller = new AbortController();
      generationController.current?.abort();
      generationController.current = controller;
      try {
        const result = await createCanonical(
          uploadedImage,
          description || undefined,
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;
        setCanonicalId(result.canonical_id);
        setCanonicalImage(result.image ?? null);
        setCanonicalStatus(result.status);
      } catch (err) {
        if (generationController.current?.signal.aborted) return;
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
    ]
  );

  // Firestore DB에 영구 저장하는 동의 핸들러
  const handleTermsConfirm = async (allowAiTraining: boolean) => {
    if (!user?.uid) return;

    try {
      // 👈 Firestore DB의 users 컬렉션에 사용자 ID 문서로 영구 저장
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

      // 동의 완료 즉시 이모티콘 생성 진행
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
  }, [canonicalId, canonicalStatus, runStickerGeneration]);

  const handleRegenerateCanonical = useCallback(
    async (editRequest: string) => {
      if (!canonicalId) return;

      setCanonicalBusy(true);
      setCanonicalError(null);

      try {
        setCanonicalStatus("generating");
        setCanonicalImage(null);
        const controller = new AbortController();
        generationController.current = controller;
        const result = await regenerateCanonical(canonicalId, editRequest, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setCanonicalImage(result.image ?? null);
        setCanonicalStatus(result.status);
      } catch (err) {
        if (generationController.current?.signal.aborted) return;
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
    [canonicalId]
  );

  const handleCloseCanonicalPanel = useCallback(() => {
    if (canonicalStatus === "generating" || canonicalBusy) return;

    setCanonicalPanelOpen(false);
    pendingGenerationRef.current = null;
  }, [canonicalBusy, canonicalStatus]);

  const isReady = !!uploadedImage && !!title.trim();
  const uiBusy =
    isGenerating ||
    canonicalBusy ||
    (canonicalPanelOpen && canonicalStatus === "generating");

  return (
    <div className="min-h-screen bg-background">
      <Header
        userEmail={user?.email}
        onLoginClick={() => setIsLoginModalOpen(true)}
      />

      {/* 진행 단계 인디케이터 */}
      <div className="max-w-[1400px] mx-auto px-6 pt-5">
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

          <StepBadge step={5} label="다운로드" done={false} />
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
              invalidateCanonical();
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
            title={title}
            onGenerate={handleGenerate}
            isReady={isReady}
          />
        </div>
      </main>

      <CanonicalConfirmPanel
        open={canonicalPanelOpen}
        status={canonicalStatus}
        image={canonicalImage}
        error={canonicalError}
        busy={canonicalBusy}
        onApprove={handleApproveCanonical}
        onRegenerate={handleRegenerateCanonical}
        onClose={handleCloseCanonicalPanel}
      />

      {/* 1. 로그인 모달 */}
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

      {/* 2. 이용약관 및 개인정보 처리방침 동의 모달 */}
      <TermsConsentModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onConfirm={handleTermsConfirm}
      />
    </div>
  );
}
