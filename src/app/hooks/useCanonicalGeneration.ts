import { useCallback, useEffect, useRef, useState } from "react";
import {
  approveCanonical,
  createCanonical,
  generateStickerSet,
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
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  // If the user's source character changes, the previous approval must not
  // silently remain valid.
  useEffect(() => {
    inputVersion.current += 1;
    controllerRef.current?.abort();
    setBusy(false);
    setCanonicalId(null);
    setApprovedCanonicalId(null);
    setCanonicalImage(null);
    setPanelOpen(false);
    setError(null);
    pendingRequest.current = null;
  }, [image, characterBase]);

  const startStickerJob = useCallback(
    async (
      id: string,
      request: PendingStickerRequest,
    ) => {
      setBusy(true);
      const controller = new AbortController();
      controllerRef.current = controller;
      let started = false;
      try {
        await generateStickerSet({
          canonicalId: id,
          ...request,
        }, { signal: controller.signal, onStart: data => { if (!started && data.job_id) { started = true; onStickerJobStarted(data.job_id); } } });
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
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;

      try {
        const result = await createCanonical({
          image,
          characterBase,
          ipScale,
          steps: canonicalSteps,
        }, { signal: controller.signal });

        // Ignore a result if the user changed the source input while the
        // request was being created.
        if (versionAtStart !== inputVersion.current) return;

        setCanonicalId(result.canonical_id);
        setCanonicalImage(result.image ?? null);
        setStatus(result.status);
      } catch (e) {
        if (controllerRef.current?.signal.aborted) return;
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
        setStatus("generating");
        setCanonicalImage(null);
        const controller = new AbortController();
        controllerRef.current = controller;
        const result = await regenerateCanonical(canonicalId, editRequest, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setCanonicalImage(result.image ?? null);
        setStatus(result.status);
      } catch (e) {
        if (controllerRef.current?.signal.aborted) return;
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
