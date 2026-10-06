import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase/config";

export interface SetBundle {
  title: string;
  description: string;
  category: string;
  uploadedImage?: string | null;
  slotVariants?: any[];
  slotPrompts?: any[];
}

interface HomeProps {
  onStartWithBundle: (bundle: SetBundle) => void;
  onOpenTerms?: () => void;
}

export default function Home({ onStartWithBundle, onOpenTerms }: HomeProps) {
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState("전체");
  const [communitySets, setCommunitySets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. 실시간 랭킹 쿼리 (인기 점수 popularityScore 기준 정렬)
  useEffect(() => {
    setLoading(true);

    try {
      const collectionRef = collection(db, "community_sets");
      
      // 최근 7일 필터 기준 시점
      const sevenDaysAgo = Timestamp.fromDate(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      let q;
      if (activeTab === "전체") {
        q = query(
          collectionRef,
          where("createdAt", ">=", sevenDaysAgo),
          orderBy("createdAt", "desc"),
          orderBy("popularityScore", "desc"),
          limit(12)
        );
      } else {
        q = query(
          collectionRef,
          where("category", "==", activeTab),
          where("createdAt", ">=", sevenDaysAgo),
          orderBy("createdAt", "desc"),
          orderBy("popularityScore", "desc"),
          limit(12)
        );
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          // 복합 인덱스 빌드 전이거나 클라이언트 보정이 필요할 경우 score 순 최종 정렬
          list.sort((a: any, b: any) => (b.popularityScore || 0) - (a.popularityScore || 0));
          setCommunitySets(list);
          setLoading(false);
        },
        (error) => {
          console.warn("Firestore 실시간 랭킹 구독 실패 (인덱스 생성 확인 필요):", error.message);
          
          // 인덱스 생성 전 fallback 쿼리 (단순 점수 정렬)
          const fallbackQ = query(
            collectionRef,
            orderBy("popularityScore", "desc"),
            limit(12)
          );
          onSnapshot(fallbackQ, (fallbackSnap) => {
            const list = fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setCommunitySets(list);
            setLoading(false);
          });
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("DB 연동 오류:", err);
      setLoading(false);
    }
  }, [activeTab]);

  // ❤️ 좋아요 클릭: +1점 및 likesCount +1
  const handleLike = async (e: React.MouseEvent, setId: string) => {
    e.stopPropagation();
    try {
      const setRef = doc(db, "community_sets", setId);
      await updateDoc(setRef, {
        likesCount: increment(1),
        popularityScore: increment(1),
      });
    } catch (err) {
      console.error("좋아요 점수 반영 실패:", err);
    }
  };

  // 🚀 세트 생성/복사 클릭: +3점 및 usesCount +1
  const handleSelectSet = async (item: any) => {
    try {
      const setRef = doc(db, "community_sets", item.id);
      void updateDoc(setRef, {
        usesCount: increment(1),
        popularityScore: increment(3),
      });
    } catch (err) {
      console.error("생성 점수 반영 실패:", err);
    }

    onStartWithBundle({
      title: item.title || "",
      description: item.description || "",
      category: item.category || "캐릭터",
      uploadedImage: item.thumbnailUrl || null,
      slotVariants: item.slotVariants || null,
      slotPrompts: item.slotPrompts || null,
    });
  };

  return (
    <div className="w-full bg-background text-foreground overflow-x-hidden">
      {/* 1. 상단 히어로 검색 바 */}
      <section className="relative min-h-[440px] flex items-center justify-center overflow-hidden border-b border-border bg-gradient-to-b from-card to-background px-6 py-16">
        <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-5">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>실시간 인기 이모티콘 세트</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-3">
            검증된 프롬프트로 <span className="text-primary">바로 만들기</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-lg">
            다른 크리에이터들이 검증한 프롬프트와 24종 설정을 클릭 한 번으로 내 에디터에 그대로 가져오세요.
          </p>

          <div className="w-full max-w-xl flex gap-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyword.trim()) {
                  onStartWithBundle({
                    title: keyword.trim().slice(0, 15),
                    description: keyword.trim(),
                    category: "캐릭터",
                  });
                }
              }}
              placeholder="원하는 캐릭터나 콘셉트를 적어보세요 (예: 안경 쓴 곰인형)"
              className="flex-1 h-13 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary shadow-sm"
            />
            <button
              onClick={() => {
                if (keyword.trim()) {
                  onStartWithBundle({
                    title: keyword.trim().slice(0, 15),
                    description: keyword.trim(),
                    category: "캐릭터",
                  });
                }
              }}
              className="h-13 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              새로 만들기
            </button>
          </div>
        </div>
      </section>

      {/* 2. 랭킹 갤러리 피드 */}
      <section className="max-w-[1240px] mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                🔥 주간 인기 랭킹 피드
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                최근 7일 기준
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              좋아요, 리뷰, 실제 세트 생성 횟수를 종합하여 실시간으로 순위가 매겨집니다.
            </p>
          </div>

          {/* 탭 카테고리 필터 */}
          <div className="flex gap-1 p-1 rounded-xl bg-card border border-border self-start">
            {["전체", "직장인", "동물", "치비소녀", "일상"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 로딩 스켈레톤 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-72 rounded-2xl bg-card border border-border animate-pulse p-4 flex flex-col justify-between">
                <div className="h-44 bg-muted rounded-xl" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-8 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : communitySets.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-card/40">
            <p className="text-3xl mb-2">🎨</p>
            <h3 className="font-bold text-foreground text-base">아직 등록된 공개 세트가 없습니다</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-5">
              직접 첫 번째 이모티콘 세트를 만들고 실시간 랭킹 1위를 차지해보세요!
            </p>
            <button
              onClick={() => onStartWithBundle({ title: "첫 번째 세트", description: "", category: "캐릭터" })}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
            >
              내 이모티콘 만들러 가기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {communitySets.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleSelectSet(item)}
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer relative"
              >
                {/* 랭킹 뱃지 */}
                <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-xs border border-border text-[11px] font-bold text-foreground">
                  #{idx + 1}
                </div>

                {/* 썸네일 영역 */}
                <div className="h-44 relative bg-muted/40 flex items-center justify-center p-3 overflow-hidden border-b border-border">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-5xl select-none">✨</span>
                  )}

                  {/* 좋아요 버튼 (+1점) */}
                  <button
                    onClick={(e) => handleLike(e, item.id)}
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-background/90 backdrop-blur-xs text-[11px] font-semibold text-foreground border border-border hover:text-rose-500 hover:border-rose-300 transition-colors flex items-center gap-1 cursor-pointer z-10"
                  >
                    ❤️ {item.likesCount || 0}
                  </button>

                  <span className="absolute bottom-2.5 left-2.5 text-[10px] text-muted-foreground bg-background/80 px-2 py-0.5 rounded backdrop-blur-xs">
                    by {item.creatorName || "익명"}
                  </span>
                </div>

                {/* 카드 정보 영역 */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                        {item.reviewCount ? `💬 ${item.reviewCount}` : ""}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                      "{item.description}"
                    </p>
                  </div>

                  {/* 이 세트로 만들기 버튼 (+3점) */}
                  <button
                    onClick={() => handleSelectSet(item)}
                    className="w-full py-2 rounded-xl border border-border bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground text-xs font-semibold transition-all cursor-pointer text-center"
                  >
                    이 세트로 만들기 (+3점 기여)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
