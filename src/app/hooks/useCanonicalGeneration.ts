import { useCallback, useEffect, useRef, useState } from "react";
import {
  approveCanonical,
  createCanonical,
  generateStickerSet,
  getCanonical,
  regenerateCanonical,
  type CanonicalStatusValue,
} from "../lib/canonicalFlow";

export type PendingStickerRequest = {
  indices: number[];
  variantNames: Record<number, string>;
  candidateCount?: number;
  img2imgStrength?: number;
  controlnetScale?: number;
  steps?: number;
};

type UseCanonicalGenerationOptions = {
  image?: File | null;
  characterBase?: string;
  ipScale?: number;
  canonicalSteps?: number;
  onStickerJobStarted: (jobId: string) => void;
};

export function useCanonicalGeneration({
  image,
  characterBase = "",
  ipScale = 0.6,
  canonicalSteps = 30,
  onStickerJobStarted,
}: UseCanonicalGenerationOptions) {
  const [canonicalId, setCanonicalId] = useState<string | null>(null);
  const [approvedCanonicalId, setApprovedCanonicalId] =
    useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] =
    useState<CanonicalStatusValue>("generating");
  const [canonicalImage, setCanonicalImage] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pendingRequest = useRef<PendingStickerRequest | null>(null);
  const inputVersion = useRef(0);

  // If the user's source character changes, the previous approval must not
  // silently remain valid.
  useEffect(() => {
    inputVersion.current += 1;
    setCanonicalId(null);
    setApprovedCanonicalId(null);
    setCanonicalImage(null);
    setPanelOpen(false);
    setError(null);
    pendingRequest.current = null;
  }, [image, characterBase]);

  useEffect(() => {
    if (!canonicalId || !panelOpen) return;
    if (status !== "generating") return;

    let cancelled = false;

    const poll = async () => {
      try {
        const result = await getCanonical(canonicalId);
        if (cancelled) return;

        setStatus(result.status);
        setCanonicalImage(result.image ?? null);
        setError(result.error ?? null);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(
          e instanceof Error ? e.message : "상태 확인에 실패했습니다.",
        );
      }
    };

    void poll();
    const timer = window.setInterval(poll, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [canonicalId, panelOpen, status]);

  const startStickerJob = useCallback(
    async (
      id: string,
      request: PendingStickerRequest,
    ) => {
      setBusy(true);
      try {
        const jobId = await generateStickerSet({
          canonicalId: id,
          ...request,
        });
        onStickerJobStarted(jobId);
      } finally {
        setBusy(false);
      }
    },
    [onStickerJobStarted],
  );

  const requestGeneration = useCallback(
    async (request: PendingStickerRequest) => {
      setError(null);

      if (approvedCanonicalId) {
        await startStickerJob(approvedCanonicalId, request);
        return;
      }

      pendingRequest.current = request;

      setPanelOpen(true);
      setStatus("generating");
      setCanonicalImage(null);

      const versionAtStart = inputVersion.current;

      try {
        const id = await createCanonical({
          image,
          characterBase,
          ipScale,
          steps: canonicalSteps,
        });

        // Ignore a result if the user changed the source input while the
        // request was being created.
        if (versionAtStart !== inputVersion.current) return;

        setCanonicalId(id);
      } catch (e) {
        setStatus("error");
        setError(
          e instanceof Error
            ? e.message
            : "Canonical 생성 요청에 실패했습니다.",
        );
      }
    },
    [
      approvedCanonicalId,
      canonicalSteps,
      characterBase,
      image,
      ipScale,
      startStickerJob,
    ],
  );

  const approve = useCallback(async () => {
    if (!canonicalId || status !== "ready") return;

    setBusy(true);
    setError(null);

    try {
      await approveCanonical(canonicalId);
      setApprovedCanonicalId(canonicalId);
      setStatus("approved");
      setPanelOpen(false);

      const request = pendingRequest.current;
      pendingRequest.current = null;

      if (request) {
        await startStickerJob(canonicalId, request);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "승인에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }, [canonicalId, startStickerJob, status]);

  const regenerate = useCallback(
    async (editRequest: string) => {
      if (!canonicalId) return;

      setBusy(true);
      setError(null);

      try {
        await regenerateCanonical(canonicalId, editRequest);
        setStatus("generating");
        setCanonicalImage(null);
      } catch (e) {
        setStatus("error");
        setError(
          e instanceof Error
            ? e.message
            : "Canonical 재생성 요청에 실패했습니다.",
        );
      } finally {
        setBusy(false);
      }
    },
    [canonicalId],
  );

  const closePanel = useCallback(() => {
    if (status === "generating" || busy) return;
    setPanelOpen(false);
    pendingRequest.current = null;
  }, [busy, status]);

  return {
    canonicalId,
    approvedCanonicalId,
    requestGeneration,
    panelProps: {
      open: panelOpen,
      status,
      image: canonicalImage,
      error,
      busy,
      onApprove: approve,
      onRegenerate: regenerate,
      onClose: closePanel,
    },
  };
}
