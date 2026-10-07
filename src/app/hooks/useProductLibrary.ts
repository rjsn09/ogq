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

type LoadedProduct = {
  uid: string;
  summary: ProductSummary;
  data: SavedProduct;
};

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

  // 보관함에서 미리보기 중인 상품
  const [selection, setSelection] = useState<LoadedProduct | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 실제 에디터에 적용하기로 확정한 상품
  const [loadedProduct, setLoadedProduct] = useState<LoadedProduct | null>(null);

  useEffect(() => {
    loadController.current?.abort();
    setSelection(null);
    setSelectedId(null);
    setLoadedProduct(null);
    setPreviewLoading(false);
    setError(null);
    setNotice(null);
    currentProduct.current = null;
  }, [uid]);

  // 보관함을 새로 열 때 이전 미리보기 선택만 초기화한다.
  // loadedProduct는 유지해서 현재 에디터 상태가 갑자기 바뀌지 않게 한다.
  useEffect(() => {
    if (!open) return;
    loadController.current?.abort();
    setSelection(null);
    setSelectedId(null);
    setPreviewLoading(false);
    setError(null);
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

  // 오른쪽 프로젝트를 클릭하면 그 즉시 전체 이모티콘을 다운로드해서 미리보기한다.
  // 하지만 아직 에디터에는 적용하지 않는다.
  const select = useCallback(
    async (summary: ProductSummary) => {
      if (!uid) return;

      loadController.current?.abort();
      const controller = new AbortController();
      loadController.current = controller;

      setSelectedId(summary.id);
      setSelection(null);
      setPreviewLoading(true);
      setError(null);

      try {
        const data = await loadProduct(uid, summary, controller.signal);

        if (account.current !== uid || controller.signal.aborted) return;
        setSelection({ uid, summary, data });
      } catch (failure) {
        if (account.current === uid && !controller.signal.aborted) {
          setError(storageMessage(failure));
        }
      } finally {
        if (account.current === uid && !controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    },
    [uid]
  );

  // “이 상품 불러오기”를 눌렀을 때만 미리보기 데이터를 에디터 적용 대상으로 확정한다.
  const loadSelected = useCallback(() => {
    if (!uid || !selection || selection.uid !== uid) return false;

    setLoadedProduct(selection);
    currentProduct.current = {
      uid,
      id: selection.summary.id,
      title: selection.summary.title,
      loaded: true,
    };
    setNotice('상품의 이미지와 편집 정보를 불러왔습니다.');
    setError(null);
    return true;
  }, [uid, selection]);

  const markLoaded = useCallback((summary: ProductSummary) => {
    if (uid) {
      currentProduct.current = {
        uid,
        id: summary.id,
        title: summary.title,
        loaded: true,
      };
    }

    setNotice("상품의 이미지와 편집 정보를 불러왔습니다.");
    setError(null);
  }, [uid]);

  return {
    products: list.uid === uid ? list.products : [],

    selected: selection?.uid === uid ? selection : null,
    loaded: loadedProduct?.uid === uid ? loadedProduct : null,

    selectedId,

    selectedSummary:
      list.uid === uid
        ? list.products.find(product => product.id === selectedId) ?? null
        : null,

    loading,
    previewLoading,
    saving,
    saveProgress,
    notice,
    error,

    save,
    select,
    markLoaded,
    loadSelected,
  }
};