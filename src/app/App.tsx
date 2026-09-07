import React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import InputPanel from "./components/InputPanel";
import GeneratedGrid from "./components/GeneratedGrid";
import CanonicalConfirmPanel from "./components/CanonicalConfirmPanel";
import {
  approveCanonical,
  createCanonical,
  generateOGQImagesFromCanonical,
  getCanonical,
  regenerateCanonical,
  type CanonicalStatusValue,
} from "./lib/ogqGenerator";
import {
  VARIANT_CATALOG,
  DEFAULT_VARIANTS,
  Variant,
} from "./utils/imageGenerator";

function Header() {
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

        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs"
            style={{ fontWeight: 600 }}
          >
            Beta
          </span>

          <a
            href="https://ogqmarket.naver.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs"
            style={{ fontWeight: 500 }}
          >
            OGQ 마켓 바로가기 →
          </a>
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
  isPartial: boolean;
};

export default function App() {
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

  // ------------------------------------------------------------------
  // Canonical state
  // ------------------------------------------------------------------

  const [canonicalId, setCanonicalId] = useState<string | null>(null);
  const [approvedCanonicalId, setApprovedCanonicalId] =
    useState<string | null>(null);

  const [canonicalPanelOpen, setCanonicalPanelOpen] = useState(false);
  const [canonicalStatus, setCanonicalStatus] =
    useState<CanonicalStatusValue>("generating");
  const [canonicalImage, setCanonicalImage] = useState<string | null>(null);
  const [canonicalError, setCanonicalError] = useState<string | null>(null);
  const [canonicalBusy, setCanonicalBusy] = useState(false);

  // The generation request that should automatically continue
  // after the user approves the canonical.
  const pendingGenerationRef = useRef<PendingGeneration | null>(null);

  const invalidateCanonical = useCallback(() => {
    setCanonicalId(null);
    setApprovedCanonicalId(null);
    setCanonicalImage(null);
    setCanonicalError(null);
    setCanonicalPanelOpen(false);
    pendingGenerationRef.current = null;
  }, []);

  // If the user's character description changes, the old canonical should
  // no longer be considered approved.
  useEffect(() => {
    invalidateCanonical();
  }, [description, invalidateCanonical]);

  // Poll canonical generation while the confirmation panel is open.
  useEffect(() => {
    if (
      !canonicalId ||
      !canonicalPanelOpen ||
      canonicalStatus !== "generating"
    ) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const result = await getCanonical(canonicalId);
        if (cancelled) return;

        setCanonicalStatus(result.status);
        setCanonicalImage(result.image ?? null);
        setCanonicalError(result.error ?? null);
      } catch (err) {
        if (cancelled) return;

        setCanonicalStatus("error");
        setCanonicalError(
          err instanceof Error
            ? err.message
            : "Canonical 상태 확인에 실패했습니다."
        );
      }
    };

    void poll();

    const timer = window.setInterval(() => {
      void poll();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [canonicalId, canonicalPanelOpen, canonicalStatus]);

  const handleVariantChange = useCallback(
    (slotIndex: number, variantId: string) => {
      const variant = VARIANT_CATALOG.find((v) => v.id === variantId);
      if (!variant) return;

      setSlotVariants((prev) => {
        const next = [...prev];
        next[slotIndex] = variant;
        return next;
      });
    },
    []
  );

  // ------------------------------------------------------------------
  // Actual Stage-2 generation
  // ------------------------------------------------------------------

  const runStickerGeneration = useCallback(
    async (
      approvedId: string,
      request: PendingGeneration
    ) => {
      setIsGenerating(true);
      setProgress(0);

      if (!request.isPartial) {
        setGeneratedImages([]);
      }

      try {
        await generateOGQImagesFromCanonical(
          approvedId,
          (count, images) => {
            setProgress(count);
            setGeneratedImages(images);
          },
          request.indices,
          request.variantAssignments,
          request.isPartial ? generatedImages : undefined
        );
      } catch (err) {
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

  // ------------------------------------------------------------------
  // Generate button
  // ------------------------------------------------------------------

  const handleGenerate = useCallback(
    async (indices?: number[]) => {
      if (!uploadedImage || !title.trim()) return;

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
        isPartial,
      };

      // Already approved -> go straight to Stage 2.
      if (approvedCanonicalId) {
        await runStickerGeneration(approvedCanonicalId, request);
        return;
      }

      // Store this request so approval can continue it automatically.
      pendingGenerationRef.current = request;
      setCanonicalPanelOpen(true);

      // A canonical is already ready but the user closed the panel earlier.
      if (canonicalId && canonicalStatus === "ready") {
        return;
      }

      setCanonicalStatus("generating");
      setCanonicalImage(null);
      setCanonicalError(null);
      setCanonicalBusy(true);

      try {
        const newCanonicalId = await createCanonical(
          uploadedImage,
          description || undefined
        );

        setCanonicalId(newCanonicalId);
      } catch (err) {
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
      uploadedImage,
      title,
      description,
      slotVariants,
      approvedCanonicalId,
      canonicalId,
      canonicalStatus,
      runStickerGeneration,
    ]
  );

  // ------------------------------------------------------------------
  // Confirmation panel buttons
  // ------------------------------------------------------------------

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
        await regenerateCanonical(canonicalId, editRequest);
        setCanonicalStatus("generating");
        setCanonicalImage(null);
      } catch (err) {
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
  const uiBusy = isGenerating || canonicalBusy || (canonicalPanelOpen && canonicalStatus === "generating");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Step indicators */}
      <div className="max-w-[1400px] mx-auto px-6 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <StepBadge
            step={1}
            label="이미지 업로드"
            done={!!uploadedImage}
          />
          <span className="text-border text-sm mx-0.5">→</span>

          <StepBadge
            step={2}
            label="정보 입력"
            done={!!title.trim()}
          />
          <span className="text-border text-sm mx-0.5">→</span>

          <StepBadge
            step={3}
            label="캐릭터 확인"
            done={!!approvedCanonicalId}
          />
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

              // New source image = old canonical is no longer valid.
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
    </div>
  );
}
