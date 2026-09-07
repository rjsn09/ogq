import React, { useEffect, useState } from "react";
import type { CanonicalStatusValue } from "../lib/ogqGenerator";

type Props = {
  open: boolean;
  status: CanonicalStatusValue;
  image?: string | null;
  error?: string | null;
  busy?: boolean;
  onApprove: () => void | Promise<void>;
  onRegenerate: (editRequest: string) => void | Promise<void>;
  onClose: () => void;
};

export default function CanonicalConfirmPanel({
  open,
  status,
  image,
  error,
  busy = false,
  onApprove,
  onRegenerate,
  onClose,
}: Props) {
  const [editRequest, setEditRequest] = useState("");

  useEffect(() => {
    if (!open) {
      setEditRequest("");
    }
  }, [open]);

  if (!open) return null;

  const generating = status === "generating";
  const canApprove = status === "ready" && !!image && !busy;
  const canRegenerate = status === "ready" && !busy;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              캐릭터 기준 이미지
            </span>

            <h2 className="mt-2 text-xl font-bold text-foreground">
              이 캐릭터로 이모티콘을 만들까요?
            </h2>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              승인한 이미지는 이후 이모티콘의 캐릭터 외형과
              그림체 기준으로 사용됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={generating || busy}
            className="rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            닫기
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40">
            {generating && (
              <div className="flex flex-col items-center gap-4 px-6 text-center">
                <div className="h-11 w-11 animate-spin rounded-full border-4 border-muted border-t-primary" />

                <div>
                  <p className="font-semibold text-foreground">
                    기준 캐릭터 생성 중
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    원본 특징을 유지하면서 정자세 이모티콘 스타일로
                    변환하고 있습니다.
                  </p>
                </div>
              </div>
            )}

            {status === "ready" && image && (
              <img
                src={image}
                alt="Canonical 캐릭터"
                className="max-h-[540px] w-full object-contain p-5"
              />
            )}

            {status === "error" && (
              <div className="max-w-md px-6 text-center">
                <p className="font-semibold text-destructive">
                  기준 이미지 생성에 실패했습니다.
                </p>
                <p className="mt-2 break-words text-sm text-muted-foreground">
                  {error || "알 수 없는 오류가 발생했습니다."}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="rounded-2xl bg-muted/50 p-4">
              <p className="text-sm font-semibold text-foreground">
                확인할 부분
              </p>

              <ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground">
                <li>• 머리, 얼굴, 의상 등 원본 특징이 유지됐는지</li>
                <li>• 원하지 않는 장식이나 특징이 추가되지 않았는지</li>
                <li>• 24개 이모티콘의 기준으로 사용해도 괜찮은지</li>
              </ul>
            </div>

            <label className="mt-5 text-sm font-semibold text-foreground">
              수정해서 다시 만들기
            </label>

            <textarea
              value={editRequest}
              onChange={(e) => setEditRequest(e.target.value)}
              disabled={!canRegenerate}
              placeholder="예: 앞머리를 원본처럼 더 길게 유지해줘"
              className="mt-2 min-h-28 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
            />

            {error && status !== "error" && (
              <p className="mt-3 text-xs text-destructive">{error}</p>
            )}

            <div className="mt-auto space-y-2 pt-5">
              <button
                type="button"
                disabled={!canApprove}
                onClick={() => void onApprove()}
                className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                이 캐릭터로 만들기
              </button>

              <button
                type="button"
                disabled={!canRegenerate}
                onClick={() =>
                  void onRegenerate(editRequest.trim())
                }
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                다시 생성
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
