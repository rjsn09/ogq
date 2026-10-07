import React, { useState, useCallback, useEffect, useRef } from "react";
import InputPanel from "./components/InputPanel";
import GeneratedGrid from "./components/GeneratedGrid";
import CanonicalConfirmPanel from "./components/CanonicalConfirmPanel";
import { StepBadge } from "./Header";
import { useGenerationTask } from "./hooks/useGenerationTask";
import { 
  ensureApprovedReference, 
  referenceMatches, 
  referenceStorage, 
  type ApprovedReference 
} from "./lib/approvedReference";
import { GenerationCancelledError } from "../api/sse";
import { monitorGeneration } from "./lib/monitoring";
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

type PendingGeneration = {
  indices: number[];
  variantAssignments: Record<number, string>;
  userPrompts: Record<number, string>;
  isPartial: boolean;
};

interface EditorViewProps {
  user: any;
  hasAgreedTerms: boolean;
  onRequestLogin: () => void;
  onRequestTerms: () => void;
  onBackToHome: () => void;
  productLibrary: any;
  autoSave: boolean;
  initialDescription?: string;
  initialTitle?: string;
}

export default function EditorView({
  user,
  hasAgreedTerms,
  onRequestLogin,
  onRequestTerms,
  onBackToHome,
  productLibrary,
  autoSave,
  initialDescription = "",
  initialTitle = "",
}: EditorViewProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState("캐릭터");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [generatingIndices, setGeneratingIndices] = useState<Set<number>>(new Set());

  const [slotVariants, setSlotVariants] = useState<Variant[]>(
    Array.from({ length: 24 }, (_, i) => VARIANT_CATALOG[i] ?? DEFAULT_VARIANTS[i])
  );
  const [slotPrompts, setSlotPrompts] = useState<Prompts[]>(
    Array.from({ length: 24 }, (_, i) => VARIANT_PROMPTS[i] ?? DEFAULT_PROMPTS[i])
  );

  const [canonicalId, setCanonicalId] = useState<string | null>(null);
  const [approvedCanonicalId, setApprovedCanonicalId] = useState<string | null>(null);

  const [canonicalPanelOpen, setCanonicalPanelOpen] = useState(false);
  const [canonicalStatus, setCanonicalStatus] = useState<CanonicalStatusValue>("generating");
  const [canonicalImage, setCanonicalImage] = useState<string | null>(null);
  const [canonicalError, setCanonicalError] = useState<string | null>(null);
  const [canonicalBusy, setCanonicalBusy] = useState(false);

  useEffect(() => {
    const selected = productLibrary.selected;
    if (!selected?.data) return;

    const data = selected.data;

    setTitle(data.title ?? "");
    setTags(data.tags ?? []);
    setDescription(data.description ?? "");
    setCategory(data.category ?? "캐릭터");
    setUploadedImage(data.uploadedImage ?? null);
    setCanonicalImage(data.canonicalImage ?? null);
    setGeneratedImages(data.images ?? []);

    if (data.slotVariants) {
      setSlotVariants(data.slotVariants);
    }

    if (data.slotPrompts) {
      setSlotPrompts(data.slotPrompts);
    }

    productLibrary.markLoaded(selected.summary);
  }, [productLibrary.selected]);

  const generationTask = useGenerationTask();
  const generationController = useRef<AbortController | null>(null);
  useEffect(() => () => generationController.current?.abort(), []);

  const pendingGenerationRef = useRef<PendingGeneration | null>(null);
  const approvedReference = useRef<ApprovedReference | null>(null);
  const referenceProfile = useRef<{ canonicalProfile?: string; originalProfile?: string; prompt?: string }>({});
  const [referenceReady, setReferenceReady] = useState(false);
  const referenceVersion = useRef(0);
  const previousReferenceInputs = useRef({ source: uploadedImage, description });

  const currentDraft = useCallback((): ProductDraft => ({
    title, tags, description, category, uploadedImage, canonicalImage,
    images: Array.from({ length: 24 }, (_, index) => generatedImages[index] ?? ''),
    slotVariants, slotPrompts,
  }), [title, tags, description, category, uploadedImage, canonicalImage, generatedImages, slotVariants, slotPrompts]);

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
    if ((previous.source !== uploadedImage || previous.description.trim() !== description.trim()) && !referenceMatches(approvedReference.current, uploadedImage, description)) {
      invalidateCanonical();
    }
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

  const handleVariantChange = useCallback((slotIndex: number, variantId: string) => {
    const variant = VARIANT_CATALOG.find((v) => v.id === variantId);
    if (!variant) return;

    setSlotVariants((prev) => {
      const next = [...prev];
      next[slotIndex] = variant;
      return next;
    });
    setSlotPrompts((prev) =>
      prev.map((item, index) =>
        index === slotIndex ? { id: variant.id, name: variant.name, prompt: "" } : item
      )
    );
  }, []);

  const handlePromptChange = useCallback((slotIndex: number, prompt: string) => {
    setSlotPrompts((prev) =>
      prev.map((item, index) => (index === slotIndex ? { ...item, prompt } : item))
    );
  }, []);

  const runStickerGeneration = useCallback(
    async (approvedId: string, request: PendingGeneration) => {
      setIsGenerating(true);
      setProgress(0);
      const task = generationTask.begin(request.indices.length);
      const draft = currentDraft();
      setGeneratingIndices(new Set(request.indices.map(index => index - 1)));

      if (!request.isPartial) setGeneratedImages([]);

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
        alert(`생성 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsGenerating(false);
        setGeneratingIndices(new Set());
      }
    },
    [generatedImages, user, generationTask.begin, currentDraft, autoSave, productLibrary.save, uploadedImage, description]
  );

  const handleGenerate = useCallback(
    async (indices?: number[]) => {
      if (!referenceReady || productLibrary.saving || isGenerating || canonicalBusy || (canonicalPanelOpen && canonicalStatus === "generating")) return;
      if (!user) { onRequestLogin(); return; }
      if (!hasAgreedTerms) { onRequestTerms(); return; }
      if (!uploadedImage) { alert("1단계: 기준 캐릭터 이미지를 먼저 업로드해 주세요!"); return; }
      if (!title.trim()) { alert("2단계: 이모티콘 제목을 입력해 주세요!"); return; }

      const isPartial = !!indices && indices.length > 0;
      const targetIndices = indices && indices.length > 0 ? indices : Array.from({ length: 24 }, (_, i) => i + 1);

      const variantAssignments: Record<number, string> = targetIndices.reduce((acc, idx1based) => {
        acc[idx1based] = slotVariants[idx1based - 1]?.name ?? DEFAULT_VARIANTS[idx1based - 1]?.name ?? `이모티콘 ${idx1based}`;
        return acc;
      }, {} as Record<number, string>);

      const request: PendingGeneration = {
        indices: targetIndices,
        variantAssignments,
        userPrompts: Object.fromEntries(
          targetIndices.map((index) => [index, slotPrompts[index - 1]?.prompt.trim() ?? ""])
        ),
        isPartial,
      };

      if (approvedCanonicalId) {
        await runStickerGeneration(approvedCanonicalId, request);
        return;
      }

      pendingGenerationRef.current = request;
      setCanonicalPanelOpen(true);

      if (canonicalId && canonicalStatus === "ready") return;

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
        setCanonicalError(err instanceof Error ? err.message : "Canonical 생성 요청에 실패했습니다.");
      } finally {
        setCanonicalBusy(false);
      }
    },
    [user, hasAgreedTerms, uploadedImage, title, description, slotVariants, slotPrompts, approvedCanonicalId, canonicalId, canonicalStatus, runStickerGeneration, generationTask.begin, isGenerating, canonicalBusy, canonicalPanelOpen, productLibrary.saving, referenceReady, onRequestLogin, onRequestTerms]
  );

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
      if (pending) await runStickerGeneration(canonicalId, pending);
    } catch (err) {
      setCanonicalError(err instanceof Error ? err.message : "Canonical 승인에 실패했습니다.");
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
        setCanonicalError(err instanceof Error ? err.message : "Canonical 재생성 요청에 실패했습니다.");
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

  const isReady = !!uploadedImage && !!title.trim();
  const uiBusy = !referenceReady || productLibrary.saving || isGenerating || canonicalBusy || (canonicalPanelOpen && canonicalStatus === "generating");

  return (
    <>
      <div className="max-w-[1400px] mx-auto px-6 pt-4">
        <button
          onClick={onBackToHome}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors cursor-pointer"
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
          <StepBadge step={4} label="24장 생성" done={generatedImages.filter(Boolean).length === 24} />
          <span className="text-border text-sm mx-0.5">→</span>
          <StepBadge step={5} label="다운로드" done={generatedImages.filter(Boolean).length === 24} />
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-6 py-5">
        <div className="grid gap-6" style={{ gridTemplateColumns: "420px 1fr" }}>
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
    </>
  );
}
