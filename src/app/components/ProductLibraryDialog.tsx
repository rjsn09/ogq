import { useEffect, useMemo, useState } from 'react';
import { Check, FolderOpen, ImageIcon, Search } from 'lucide-react';
import type { ProductSummary, SavedProduct } from '../lib/productArchive';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductSummary[];
  selected: { summary: ProductSummary; data: SavedProduct } | null;
  selectedId: string | null;
  loading: boolean;
  previewLoading: boolean;
  error: string | null;
  onSelect: (summary: ProductSummary) => void;
  onLoad: () => void;
};

const dateFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ProductLibraryDialog({ open, onOpenChange, products, selected, selectedId, loading, previewLoading, error, onSelect, onLoad }: Props) {
  const [search, setSearch] = useState('');
  useEffect(() => { if (!open) setSearch(''); }, [open]);
  const filtered = useMemo(() => products.filter(product => product.title.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())), [products, search]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[1100px] sm:max-w-[1100px] overflow-hidden rounded-3xl p-0 gap-0">
        <div className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-xl"><FolderOpen size={20} className="text-primary" />상품 불러오기</DialogTitle>
          <DialogDescription className="mt-2">오른쪽에서 상품을 선택한 뒤, 이미지를 확인하고 편집 화면으로 불러오세요.</DialogDescription>
        </div>
        <div className="grid max-h-[75vh] min-h-[440px] overflow-y-auto md:grid-cols-[minmax(0,1fr)_280px]">
          <section aria-label="선택한 상품 미리보기" className="min-w-0 p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{selected?.data.title ?? '상품 미리보기'}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{selected ? `${selected.data.images.filter(Boolean).length}/24장 · 제목, 태그와 프롬프트도 함께 복원됩니다.` : '저장한 상품의 24개 슬롯을 미리 볼 수 있습니다.'}</p>
              </div>
              <button type="button" disabled={!selected || previewLoading} onClick={onLoad} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"><Check size={16} />이 상품 불러오기</button>
            </div>
            {error && <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {previewLoading ? (
              <div role="status" className="flex min-h-80 items-center justify-center gap-3 text-sm text-muted-foreground"><span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />상품 이미지 불러오는 중…</div>
            ) : selected ? (
              <div className="mx-auto grid grid-cols-4 gap-2 sm:grid-cols-6" style={{ maxWidth: 'min(100%, calc(112.5vh - 225px))' }}>
                {selected.data.images.map((image, index) => <div key={index} className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                  {image ? <img src={image} alt={`${selected.data.slotVariants[index]?.name ?? '이모티콘'} ${index + 1}`} className="h-full w-full object-contain p-1" /> : <ImageIcon size={22} className="text-muted-foreground/30" />}
                  <span className="absolute left-1.5 bottom-1 rounded bg-card/90 px-1 text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                </div>)}
              </div>
            ) : <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 text-center"><ImageIcon size={36} className="text-muted-foreground/40" /><p className="text-sm text-muted-foreground">{loading ? '저장한 상품을 찾고 있습니다.' : products.length ? '오른쪽에서 불러올 상품을 선택해 주세요.' : '아직 저장한 상품이 없습니다.'}</p><p className="text-xs text-muted-foreground">생성을 완료하면 자동 저장되며, 프로필 메뉴에서도 저장할 수 있습니다.</p></div>}
          </section>
          <aside aria-label="저장한 상품 목록" className="border-t border-border bg-muted/25 p-4 md:border-l md:border-t-0">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">내 상품</h3><span className="text-xs text-muted-foreground">{products.length}개</span></div>
            <label className="mt-3 mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5"><Search size={15} className="text-muted-foreground" /><input aria-label="상품명 검색" value={search} onChange={event => setSearch(event.target.value)} placeholder="상품명 검색" className="min-w-0 w-full bg-transparent text-xs outline-none" /></label>
            <div className="max-h-[52vh] space-y-2 overflow-y-auto">
              {loading && <p role="status" className="p-3 text-xs text-muted-foreground">목록 불러오는 중…</p>}
              {!loading && filtered.map(product => <button type="button" key={product.id} aria-pressed={selectedId === product.id} onClick={() => onSelect(product)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selectedId === product.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/40'}`}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">{product.coverImage ? <img src={product.coverImage} alt="" className="h-full w-full object-contain" /> : <ImageIcon size={20} className="text-muted-foreground" />}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{product.title}</span><span className="mt-1 block text-[10px] text-muted-foreground">{product.imageCount}/24장 · {dateFormatter.format(product.updatedAt)}</span></span>
              </button>)}
              {!loading && !filtered.length && products.length > 0 && <p className="p-3 text-xs text-muted-foreground">검색한 상품이 없습니다.</p>}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
