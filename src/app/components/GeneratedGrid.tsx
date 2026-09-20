import { useState, useCallback, useMemo } from "react";
import { Download, ZoomIn, X, CheckSquare, Square, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import JSZip from "jszip";
import { VARIANT_CATALOG, DEFAULT_VARIANTS, Variant, Prompts } from "../utils/imageGenerator";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";

interface GeneratedGridProps {
  images?: (string | null)[];
  slotVariants?: Variant[];
  slotPrompts?: Prompts[];
  onPromptChange?: (slotIndex: number, prompt: string) => void;
  onVariantChange?: (slotIndex: number, variantId: string) => void;
  isGenerating?: boolean;
  progress?: number;
  generatingIndices?: Set<number>;
  title?: string;
  onGenerate?: (indices?: number[]) => void;
  isReady?: boolean;
}

export default function GeneratedGrid({
  images: rawImages,
  slotVariants: rawSlotVariants,
  slotPrompts,
  onPromptChange,
  onVariantChange = () => {},
  isGenerating = false,
  progress = 0,
  generatingIndices,
  title = "",
  onGenerate,
  isReady,
}: GeneratedGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [promptSlot, setPromptSlot] = useState<number | null>(null);
  const [promptDraft, setPromptDraft] = useState("");

  const openPrompt = (index: number) => {
    setPromptDraft(slotPrompts?.[index]?.prompt ?? "");
    setPromptSlot(index);
  };

  const images = useMemo(
    () => Array.from({ length: 24 }, (_, i) => rawImages?.[i] ?? null),
    [rawImages]
  );
  const slotVariants = useMemo(
    () =>
      Array.from(
        { length: 24 },
        (_, i) => rawSlotVariants?.[i] ?? VARIANT_CATALOG[i] ?? DEFAULT_VARIANTS[i]
      ),
    [rawSlotVariants]
  );

  const filledCount = useMemo(() => images.filter(Boolean).length, [images]);
  const isAllSelected = selectedIds.size === 24 && 24 > 0;
  const selectedFilledCount = useMemo(
    () => [...selectedIds].filter((i) => !!images[i]).length,
    [selectedIds, images]
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(Array.from({ length: 24 }, (_, i) => i)));
  }, [isAllSelected]);

  const downloadImage = useCallback(
    (dataUrl: string, idx: number) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title || "ogq_sticker"}_${String(idx + 1).padStart(2, "0")}.png`;
      a.click();
    },
    [title]
  );

  const downloadAsZip = useCallback(
    async (targets: number[]) => {
      setIsZipping(true);
      try {
        const zip = new JSZip();

        targets.forEach((idx) => {
          const dataUrl = images[idx] as string;
          const base64 = dataUrl.split(",")[1];
          const filename = `${title || "ogq_sticker"}_${String(idx + 1).padStart(2, "0")}.png`;
          zip.file(filename, base64, { base64: true });
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title || "ogq_sticker"}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } finally {
        setIsZipping(false);
      }
    },
    [images, title]
  );

  const downloadSelected = useCallback(() => {
    const targets =
      selectedFilledCount > 0
        ? [...selectedIds].filter((i) => !!images[i])
        : images.map((img, i) => (img ? i : -1)).filter((i) => i >= 0);

    if (targets.length === 0) return;

    if (targets.length === 1) {
      downloadImage(images[targets[0]] as string, targets[0]);
    } else {
      downloadAsZip(targets);
    }
  }, [selectedIds, selectedFilledCount, images, downloadImage, downloadAsZip]);

  const handleGenerateClick = useCallback(() => {
    if (!onGenerate) return;
    if (selectedIds.size > 0) {
      onGenerate([...selectedIds].map((i) => i + 1).sort((a, b) => a - b));
      setSelectedIds(new Set());
    } else {
      onGenerate(undefined);
    }
  }, [onGenerate, selectedIds]);

  const hasImages = filledCount > 0;

  const generateLabel = useMemo(() => {
    if (isGenerating) return `생성 중...`;
    if (selectedIds.size > 0) {
      const willRegenerate = selectedFilledCount === selectedIds.size;
      const willCreate = selectedFilledCount === 0;
      if (willRegenerate) return `선택 ${selectedIds.size}장 재생성하기`;
      if (willCreate) return `선택 ${selectedIds.size}장 생성하기`;
      return `선택 ${selectedIds.size}장 생성/재생성하기`;
    }
    return hasImages ? "빈 칸 전체 생성하기" : "24장 이미지 생성하기";
  }, [isGenerating, selectedIds, selectedFilledCount, hasImages]);

  const downloadButtonLabel = useMemo(() => {
    if (isZipping) return "압축 중...";
    if (selectedFilledCount > 0) return `${selectedFilledCount}장 다운로드`;
    return "전체 다운로드";
  }, [isZipping, selectedFilledCount]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-foreground" style={{ fontWeight: 600 }}>
            미리보기
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs" style={{ fontWeight: 700 }}>
            {filledCount}/24
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={selectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs hover:bg-muted transition-colors"
            style={{ fontWeight: 500 }}
          >
            {isAllSelected ? <CheckSquare size={13} className="text-primary" /> : <Square size={13} />}
            {isAllSelected ? "전체 해제" : "전체 선택"}
          </button>
          {hasImages && (
            <button
              onClick={downloadSelected}
              disabled={isZipping}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs hover:brightness-105 transition-all shadow-sm shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              {isZipping ? (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download size={13} />
              )}
              {downloadButtonLabel}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isGenerating && (
        <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-foreground text-sm" style={{ fontWeight: 500 }}>
                이미지 생성 중...
              </p>
            </div>
            <span className="text-primary text-sm" style={{ fontWeight: 700 }}>
              {progress}/24
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(progress / 24) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
            {Array.from({ length: 24 }).map((_, i) => {
              const img = images[i];
              const isSelected = selectedIds.has(i);
              const isSlotGenerating = isGenerating && (generatingIndices ? generatingIndices.has(i) : !img);
              const variant = slotVariants[i] ?? VARIANT_CATALOG[i];

              if (!img) {
                return (
                  <div
                    key={i}
                    className={`relative rounded-xl bg-muted flex flex-col items-center justify-center gap-1.5 p-1.5 transition-all duration-150 ${
                      isSelected
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
                        : "border-2 border-dashed border-border hover:ring-2 hover:ring-primary/40 hover:ring-offset-1 hover:ring-offset-card"
                    } ${isSlotGenerating ? "" : "cursor-pointer"}`}
                    style={{ aspectRatio: "1/1" }}
                    onClick={() => !isSlotGenerating && toggleSelect(i)}
                  >
                    {isSlotGenerating ? (
                      <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-muted-foreground text-[10px] opacity-60" style={{ fontWeight: 500 }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <select
                          value={variant.id}
                          disabled={isGenerating}
                          onChange={(e) => onVariantChange(i, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[90%] max-w-[84px] text-[10px] bg-card border border-primary/25 rounded-full px-2.5 py-1 text-foreground truncate text-center hover:border-primary focus:border-primary focus:outline-none transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          {VARIANT_CATALOG.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isGenerating}
                          onClick={(event) => { event.stopPropagation(); openPrompt(i); }}
                          className="text-[10px] text-primary hover:underline disabled:opacity-50"
                        >
                          {slotPrompts?.[i]?.prompt ? "프롬프트 수정" : "프롬프트 작성"}
                        </button>

                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className={`relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-150 ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
                      : "hover:ring-2 hover:ring-primary/40 hover:ring-offset-1 hover:ring-offset-card"
                  }`}
                  style={{ aspectRatio: "1/1" }}
                  onClick={() => toggleSelect(i)}
                >
                  <img src={img} alt={variant?.name} className="w-full h-full object-cover" />

                  {isSlotGenerating && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIdx(i);
                      }}
                      className="w-7 h-7 rounded-full bg-white/90 text-foreground flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                    >
                      <ZoomIn size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage(img, i);
                      }}
                      className="w-7 h-7 rounded-full bg-white/90 text-foreground flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                    >
                      <Download size={13} />
                    </button>
                    {onGenerate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerate([i + 1]);
                        }}
                        title="이 칸만 재생성"
                        className="w-7 h-7 rounded-full bg-white/90 text-foreground flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                      >
                        <RotateCw size={13} />
                      </button>
                    )}
                  </div>

                  {/* Variant label / selector (bottom) */}
                  <div
                    className="absolute bottom-1 inset-x-1 flex flex-col items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={variant.id}
                      disabled={isGenerating}
                      onChange={(e) => onVariantChange(i, e.target.value)}
                      className="w-[90%] text-[10px] bg-white/90 text-foreground border border-primary/25 rounded-full px-2.5 py-0.5 outline-none truncate text-center hover:border-primary focus:border-primary transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      {VARIANT_CATALOG.map((v) => (
                        <option key={v.id} value={v.id} className="text-foreground">
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => openPrompt(i)}
                      className="rounded-full bg-card px-2 py-0.5 text-[10px] text-primary hover:underline disabled:opacity-50"
                    >
                      {slotPrompts?.[i]?.prompt ? "프롬프트 수정" : "프롬프트 작성"}
                    </button>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              {selectedIds.size > 0 ? (
                <>
                  <strong className="text-foreground">{selectedIds.size}장</strong> 선택됨
                  {selectedFilledCount > 0 && selectedFilledCount < selectedIds.size && " (일부는 재생성, 일부는 신규 생성)"}
                </>
              ) : (
                "칸을 클릭해 선택하거나, 드롭다운에서 만들 이모티콘을 고르세요"
              )}
            </p>
            <span className="text-muted-foreground text-xs">360 × 360px • PNG</span>
          </div>
        </div>
      </div>

      {/* Generate button below grid */}
      {onGenerate && (
        <button
          onClick={handleGenerateClick}
          disabled={!isReady || isGenerating}
          className={`w-full py-3.5 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2.5 ${
            isReady && !isGenerating
              ? "bg-primary text-primary-foreground hover:brightness-105 active:scale-[0.99] shadow-md shadow-primary/25"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
          style={{ fontWeight: 700, letterSpacing: "0.01em" }}
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              생성 중...
            </>
          ) : (
            generateLabel
          )}
        </button>
      )}

      <Dialog open={promptSlot !== null} onOpenChange={(open) => { if (!open) setPromptSlot(null); }}>
        <DialogContent>
          <DialogTitle>
            {promptSlot !== null ? `${promptSlot + 1}. ${slotVariants[promptSlot]?.name}` : ""} 프롬프트
          </DialogTitle>
          <DialogDescription>
            이 칸에 원하는 표정이나 동작을 적어 주세요. 비워 두면 기본 테마로 생성됩니다. 테마를 바꾸면 프롬프트가 초기화됩니다.
          </DialogDescription>
          <label htmlFor="slot-prompt" className="text-sm text-foreground">추가 요청</label>
          <textarea
            id="slot-prompt"
            value={promptDraft}
            onChange={(event) => setPromptDraft(event.target.value)}
            disabled={isGenerating}
            rows={5}
            placeholder="예: 두 손을 흔들며 활짝 웃는 모습"
            className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPromptSlot(null)} className="rounded-xl border border-border px-4 py-2 text-sm">취소</button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => {
                if (promptSlot === null) return;
                onPromptChange?.(promptSlot, promptDraft.trim());
                setPromptSlot(null);
              }}
              className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >저장</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxIdx !== null && images[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={() => setLightboxIdx(null)}>
          <div className="relative bg-card rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>
                  {String(lightboxIdx + 1).padStart(2, "0")}. {slotVariants[lightboxIdx]?.name}
                </p>
                <p className="text-muted-foreground text-xs">360 × 360px</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadImage(images[lightboxIdx] as string, lightboxIdx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs hover:brightness-105 transition-all"
                  style={{ fontWeight: 600 }}
                >
                  <Download size={12} />
                  다운로드
                </button>
                <button onClick={() => setLightboxIdx(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 bg-[#f0f0f0]">
              <img src={images[lightboxIdx] as string} alt="" className="w-full rounded-xl" />
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <button
                onClick={() => setLightboxIdx(Math.max(0, (lightboxIdx as number) - 1))}
                disabled={lightboxIdx === 0}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
                이전
              </button>
              <span className="text-muted-foreground text-xs">
                {(lightboxIdx as number) + 1} / 24
              </span>
              <button
                onClick={() => setLightboxIdx(Math.min(23, (lightboxIdx as number) + 1))}
                disabled={lightboxIdx >= 23}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                다음
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
