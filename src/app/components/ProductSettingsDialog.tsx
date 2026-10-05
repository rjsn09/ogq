import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; email: string; autoSave: boolean; onAutoSaveChange: (enabled: boolean) => void };

export default function ProductSettingsDialog({ open, onOpenChange, email, autoSave, onAutoSaveChange }: Props) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-3xl">
    <DialogTitle>내 작업 설정</DialogTitle><DialogDescription>{email} 계정의 상품 저장 설정입니다.</DialogDescription>
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-border p-4"><span><span className="block text-sm font-semibold">생성 완료 시 자동 저장</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">새로 생성하거나 재생성한 상품을 계정에 저장합니다. 다른 기기에서도 불러올 수 있습니다.</span></span><input type="checkbox" checked={autoSave} onChange={event => onAutoSaveChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" /></label>
    <p className="text-xs leading-5 text-muted-foreground">자동 저장을 꺼도 프로필 메뉴의 ‘현재 상품 저장’을 사용할 수 있습니다. 이 설정은 현재 브라우저에 적용됩니다.</p>
  </DialogContent></Dialog>;
}
