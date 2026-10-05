import { ChevronDown, FolderOpen, LogOut, Save, Settings, UserRound } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';

type Props = {
  email: string;
  canSave: boolean;
  saving: boolean;
  busy: boolean;
  onSave: () => void;
  onOpenLibrary: () => void;
  onSettings: () => void;
  onLogout: () => void;
};

export default function ProfileMenu({ email, canSave, saving, busy, onSave, onOpenLibrary, onSettings, onLogout }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="프로필 메뉴" className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 text-sm hover:bg-muted">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound size={16} /></span>
          <span className="hidden sm:inline text-xs font-semibold">내 작업</span><ChevronDown size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
        <DropdownMenuLabel className="px-3 py-3"><p className="font-semibold">내 상품 보관함</p><p className="mt-1 truncate text-xs font-normal text-muted-foreground">{email}</p></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenLibrary} disabled={busy || saving} className="rounded-xl px-3 py-3"><FolderOpen />상품 불러오기</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSave} disabled={!canSave || saving || busy} className="rounded-xl px-3 py-3"><Save />{saving ? '계정에 저장 중…' : '현재 상품 저장'}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSettings} className="rounded-xl px-3 py-3"><Settings />설정</DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout} disabled={busy || saving} variant="destructive" className="rounded-xl px-3 py-3"><LogOut />로그아웃</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
