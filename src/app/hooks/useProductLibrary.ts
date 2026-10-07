import { useCallback, useEffect, useRef, useState } from 'react';
import { loadProduct, saveProduct, subscribeProducts } from '../lib/productRepository';
import type { ProductDraft, ProductSummary, SavedProduct } from '../lib/productArchive';

function storageMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'resource-exhausted') return 'Firestore 무료 사용량 한도에 도달했습니다. 저장 공간과 사용량을 확인하거나 일일 한도가 초기화된 후 다시 시도해 주세요.';
  if (code === 'permission-denied' || code === 'storage/unauthorized') return '계정 저장소에 접근할 수 없습니다. 저장소 설정을 확인해 주세요.';
  if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') return '계정 저장소가 아직 준비되지 않았습니다.';
  return error instanceof Error ? error.message : '상품을 저장하거나 불러오지 못했습니다. 다시 시도해 주세요.';
}

export function useProductLibrary(uid: string | undefined, open: boolean) {
  const account = useRef(uid);
  account.current = uid;

  const currentProduct = useRef<{ uid: string; id: string; title: string; loaded?: boolean } | null>(null);
  const savingLock = useRef(false);
  const loadController = useRef<AbortController | null>(null);

  const [list, setList] = useState<{ uid?: string; products: ProductSummary[] }>({ products: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    uid: string;
    summary: ProductSummary;
    data: SavedProduct;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadController.current?.abort();
    setSelection(null);
    setSelectedId(null);
    setPreviewLoading(false);
    setError(null);
    setNotice(null);
    currentProduct.current = null;
  }, [uid]);

  // 보관함을 새로 열 때만 선택 상태를 초기화한다.
  // 닫힐 때 selection을 지우면 에디터가 불러온 데이터를 받을 수 없다.
  useEffect(() => {
    loadController.current?.abort();

    if (open) {
      setSelection(null);
      setSelectedId(null);
      setPreviewLoading(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!uid || !open) return;

    setLoading(true);
    setError(null);

    return subscribeProducts(
      uid,
      products => {
        if (account.current !== uid) return;

        setList({ uid, products });
        setSelection(current =>
          current?.uid === uid &&
          !products.some(
            product =>
              product.id === current.summary.id &&
              product.storagePath === current.summary.storagePath
          )
            ? null
            : current
        );
        setLoading(false);
      },
      failure => {
        if (account.current !== uid) return;
        setError(storageMessage(failure));
        setLoading(false);
      }
    );
  }, [uid, open]);

  useEffect(() => () => loadController.current?.abort(), []);

  const save = useCallback(
    async (draft: ProductDraft) => {
      if (!uid || savingLock.current) return false;

      savingLock.current = true;
      setSaving(true);
      setSaveProgress(0);
      setNotice(null);
      setError(null);

      const current = currentProduct.current;
      const id =
        current?.uid === uid &&
        (current.loaded || current.title === draft.title.trim())
          ? current.id
          : crypto.randomUUID();

      try {
        await saveProduct(uid, id, draft, percent => {
          if (account.current === uid) setSaveProgress(percent);
        });

        if (account.current === uid) {
          currentProduct.current = {
            uid,
            id,
            title: draft.title.trim(),
            loaded: current?.loaded,
          };
          setNotice(`“${draft.title.trim()}” 상품을 계정에 저장했습니다.`);
        }

        return true;
      } catch (failure) {
        if (account.current === uid) setError(storageMessage(failure));
        return false;
      } finally {
        savingLock.current = false;
        setSaving(false);
      }
    },
    [uid]
  );

  // 상품 클릭 시에는 선택만 한다. Supabase 파일 다운로드는 하지 않는다.
  const select = useCallback(
    (summary: ProductSummary) => {
      if (!uid) return;

      loadController.current?.abort();
      setSelectedId(summary.id);
      setSelection(null);
      setPreviewLoading(false);
      setError(null);
    },
    [uid]
  );

  // 실제 다운로드는 "이 상품 불러오기" 버튼을 눌렀을 때만 실행한다.
  const loadSelected = useCallback(async () => {
    if (!uid || !selectedId || list.uid !== uid) return false;

    const summary = list.products.find(product => product.id === selectedId);
    if (!summary) {
      setError('선택한 상품을 찾을 수 없습니다. 보관함을 다시 열어 주세요.');
      return false;
    }

    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;

    setPreviewLoading(true);
    setError(null);
    setNotice(null);

    try {
      const data = await loadProduct(uid, summary, controller.signal);

      if (account.current !== uid || controller.signal.aborted) return false;

      setSelection({ uid, summary, data });
      return true;
    } catch (failure) {
      if (account.current === uid && !controller.signal.aborted) {
        setError(storageMessage(failure));
      }
      return false;
    } finally {
      if (account.current === uid && !controller.signal.aborted) {
        setPreviewLoading(false);
      }
    }
  }, [uid, selectedId, list]);

  const markLoaded = useCallback(
    (summary: ProductSummary) => {
      if (uid) {
        currentProduct.current = {
          uid,
          id: summary.id,
          title: summary.title,
          loaded: true,
        };
      }

      setNotice('상품의 이미지와 편집 정보를 불러왔습니다.');
      setError(null);
    },
    [uid]
  );

  const products = list.uid === uid ? list.products : [];
  const selectedSummary = selectedId
    ? products.find(product => product.id === selectedId) ?? null
    : null;

  return {
    products,
    selected: selection?.uid === uid ? selection : null,
    selectedSummary,
    selectedId,
    loading,
    previewLoading,
    saving,
    saveProgress,
    notice,
    error,
    save,
    select,
    loadSelected,
    markLoaded,
  };
}
