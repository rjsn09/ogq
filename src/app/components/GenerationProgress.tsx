type Props = {
  completed: number;
  total: number;
  elapsed: number;
  remaining: number | null;
  cancelling?: boolean;
  registered?: boolean;
  error?: string | null;
  onCancel: () => void;
};

function duration(seconds: number) {
  const rounded = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(rounded / 60);
  return minutes ? `${minutes}분 ${rounded % 60}초` : `${rounded}초`;
}

export default function GenerationProgress({ completed, total, elapsed, remaining, cancelling, registered, error, onCancel }: Props) {
  const percent = Math.min(100, Math.round(completed / Math.max(1, total) * 100));
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>{registered ? '이미지 생성 중' : '작업 등록 중'}</span>
        </div>
        <span className="text-sm font-bold text-primary">{completed}/{total}장 · {percent}%</span>
      </div>
      <div role="progressbar" aria-label="이미지 생성 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>경과 {duration(elapsed)}</p>
          <p>{remaining !== null ? `예상 남은 시간 약 ${duration(remaining)}` : completed > 0 ? '예상보다 지연되고 있어요. 다음 그림이 나오면 다시 계산합니다.' : '남은 시간 계산 중 · 첫 그림이 완성되면 표시됩니다.'}</p>
        </div>
        <button type="button" disabled={!registered || cancelling} onClick={onCancel} className="shrink-0 rounded-xl border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50">
          {cancelling ? '취소 요청 중…' : '생성 취소'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">다른 작업의 대기 시간에 따라 예상 시간이 달라질 수 있습니다.</p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
