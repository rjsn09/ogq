import React, { useState, useEffect, lazy, Suspense } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase/config";
import Login from "./Login";
import { recordVisit } from "./lib/monitoring";
import TermsConsentModal from "./TermsConsentModal";
import Home from "./Home";
import Header from "./Header";
import EditorView from "./EditorView";
import ProfileMenu from "./components/ProfileMenu";
import ProductLibraryDialog from "./components/ProductLibraryDialog";
import ProductSettingsDialog from "./components/ProductSettingsDialog";
import { useProductLibrary } from "./hooks/useProductLibrary";

const AdminDashboard = lazy(() => import("./components/AdminDashboard"));

export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "editor" | "dashboard">("home");

  // 인증 및 권한 상태
  const [user, setUser] = useState<any>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [hasAgreedTerms, setHasAgreedTerms] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Home에서 전달받은 프롬프트/제목
  const [initialDescription, setInitialDescription] = useState("");
  const [initialTitle, setInitialTitle] = useState("");

  // 보관함 & 설정 모달 상태
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const productLibrary = useProductLibrary(user?.uid, libraryOpen);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      unsubscribeProfile?.();
      setUser(currentUser);
      setIsAdmin(false);
      setHasAgreedTerms(false);
      setCurrentView(view => (view === "dashboard" ? "home" : view));

      if (!currentUser) return;

      setIsLoginModalOpen(false);
      void recordVisit(currentUser.uid);

      unsubscribeProfile = onSnapshot(
        doc(db, "users", currentUser.uid),
        snapshot => {
          const profile = snapshot.data();
          const admin = profile?.isAdmin === true;
          setIsAdmin(admin);
          setHasAgreedTerms(profile?.termsAgreed === true);
          if (!admin) setCurrentView(view => (view === "dashboard" ? "home" : view));
        },
        error => {
          console.error("Firestore 사용자 정보 확인 실패:", error);
          setIsAdmin(false);
          setHasAgreedTerms(false);
        }
      );
    });

    return () => {
      unsubscribe();
      unsubscribeProfile?.();
    };
  }, []);

  useEffect(() => {
    setLibraryOpen(false);
    setSettingsOpen(false);

    try {
      setAutoSave(localStorage.getItem(`ogq:autoSave:${user?.uid ?? ""}`) !== "false");
    } catch {
      setAutoSave(true);
    }
  }, [user?.uid]);

  const changeAutoSave = (enabled: boolean) => {
    setAutoSave(enabled);

    try {
      localStorage.setItem(`ogq:autoSave:${user?.uid ?? ""}`, String(enabled));
    } catch {
      /* session fallback */
    }
  };

  const handleTermsConfirm = async (allowAiTraining: boolean) => {
    if (!user?.uid) return;

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          termsAgreed: true,
          termsVersion: "1.0",
          agreedAt: serverTimestamp(),
          allowAiTraining,
          userEmail: user.email || "",
          is_admin: false,
        },
        { merge: true }
      );

      setHasAgreedTerms(true);
      setIsTermsModalOpen(false);
    } catch (err) {
      console.error("약관 동의 DB 저장 실패:", err);
      alert("약관 동의 정보를 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const handleStartFromHome = (presetText?: string) => {
    if (presetText) {
      setInitialDescription(presetText);
      setInitialTitle(presetText.slice(0, 15));
    }

    setCurrentView("editor");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        userEmail={user ? user.email ?? "내 계정" : null}
        isAdmin={isAdmin}
        onDashboardClick={() => {
          if (isAdmin) setCurrentView("dashboard");
        }}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoClick={() => setCurrentView("home")}
        profileMenu={
          user && (
            <ProfileMenu
              email={user.email ?? "내 계정"}
              busy={productLibrary.saving}
              saving={productLibrary.saving}
              canSave={true}
              onSave={() => {}}
              onOpenLibrary={() => setLibraryOpen(true)}
              onSettings={() => setSettingsOpen(true)}
              onLogout={() => void signOut(auth)}
            />
          )
        }
      />

      {(productLibrary.saving || productLibrary.notice || productLibrary.error) && (
        <div className="mx-auto max-w-[1400px] px-6 pt-4">
          <div
            role={productLibrary.error ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm ${
              productLibrary.error
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-primary/20 bg-primary/5 text-foreground"
            }`}
          >
            {productLibrary.saving
              ? `상품을 계정에 저장하고 있습니다… ${productLibrary.saveProgress}%`
              : productLibrary.error ?? productLibrary.notice}
          </div>
        </div>
      )}

      {currentView === "dashboard" && isAdmin && user ? (
        <Suspense fallback={<p className="p-8" role="status">대시보드 불러오는 중…</p>}>
          <AdminDashboard uid={user.uid} onBack={() => setCurrentView("home")} />
        </Suspense>
      ) : currentView === "home" ? (
        <Home onStart={handleStartFromHome} />
      ) : (
        <EditorView
          user={user}
          hasAgreedTerms={hasAgreedTerms}
          onRequestLogin={() => setIsLoginModalOpen(true)}
          onRequestTerms={() => setIsTermsModalOpen(true)}
          onBackToHome={() => setCurrentView("home")}
          productLibrary={productLibrary}
          autoSave={autoSave}
          initialDescription={initialDescription}
          initialTitle={initialTitle}
        />
      )}

      <ProductLibraryDialog
        open={libraryOpen && !!user}
        onOpenChange={setLibraryOpen}
        products={productLibrary.products}
        selected={productLibrary.selected}
        selectedSummary={productLibrary.selectedSummary}
        selectedId={productLibrary.selectedId}
        loading={productLibrary.loading}
        previewLoading={productLibrary.previewLoading}
        error={productLibrary.error}
        onSelect={summary => productLibrary.select(summary)}
        onLoad={async () => {
          const ok = await productLibrary.loadSelected();
          if (!ok) return;

          setLibraryOpen(false);
          setCurrentView("editor");
        }}
      />

      <ProductSettingsDialog
        open={settingsOpen && !!user}
        onOpenChange={setSettingsOpen}
        email={user?.email ?? "내 계정"}
        autoSave={autoSave}
        onAutoSaveChange={changeAutoSave}
      />

      {isLoginModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setIsLoginModalOpen(false)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-3 right-3 z-30 text-zinc-400 hover:text-zinc-600 text-sm cursor-pointer p-1"
            >
              ✕
            </button>
            <Login onSuccess={() => setIsLoginModalOpen(false)} />
          </div>
        </div>
      )}

      <TermsConsentModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onConfirm={handleTermsConfirm}
      />
    </div>
  );
}
