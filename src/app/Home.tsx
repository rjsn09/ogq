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

const DC_CON_WALL = Array.from({ length: 24 }, (_, i) => `/img/${i + 1}.png`);

interface HomeProps {
  onStart: (presetText?: string) => void;
  onOpenTerms?: () => void;
}

export default function Home({ onStart, onOpenTerms }: HomeProps) {
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState("전체");
  const [communitySets, setCommunitySets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // OGQ 실시간 데이터 상태
  const [ogqMarketStyles, setOgqMarketStyles] = useState<any[]>([]);
  const [ogqLoading, setOgqLoading] = useState(true);

  const exampleCharacters = [
    { name: "금발 포니테일 소녀", prompt: "1girl, bright blonde hair, long ponytail, blue eyes, cute chibi", emoji: "👧" },
    { name: "안경 쓴 직장인 곰", prompt: "cute bear wearing tie and glasses, office worker, 2sd chibi", emoji: "🐻" },
    { name: "말랑 치즈 고양이", prompt: "cute orange tabby cat, big round eyes, kawaii sticker", emoji: "🐱" },
    { name: "후드티 토끼", prompt: "cute white bunny wearing oversized hoodie, chibi aesthetic", emoji: "🐰" },
  ];

  // API 대기 또는 오류 시 화면을 지켜줄 안전 폴백 스타일 4종
  const defaultOgqStyles = [
    {
      id: "ogq-crayon",
      title: "동글동글 크레용 낙서풍",
      ogqRank: "OGQ 인기 1위 스타일",
      tag: "#손그림 #크레용",
      emoji: "🖍️",
      bgGradient: "from-amber-500/10 to-orange-500/20",
      description: "삐뚤빼뚤 정감 가는 크레용 질감과 따스한 파스텔 톤앤매너",
      stylePrompt: "textured crayon lineart, rough hand-drawn aesthetic, soft warm pastel palette, minimal flat shading, cute doodle sticker",
    },
    {
      id: "ogq-bold-chibi",
      title: "선명한 굵은선 치비 캐릭터",
      ogqRank: "OGQ 누적 판매 TOP",
      tag: "#선명한외곽선 #이모티콘정석",
      emoji: "🎨",
      bgGradient: "from-emerald-500/10 to-teal-500/20",
      description: "어떤 배경에서도 뚜렷하게 눈에 띄는 굵은 외곽선과 팝한 컬러감",
      stylePrompt: "bold clean black outline, 2-head chibi proportion, vibrant flat colors, crisp vector sticker, white stroke border",
    },
    {
      id: "ogq-watercolor",
      title: "투명한 수채화 감성 파스텔",
      ogqRank: "블로그 스티커 추천 1위",
      tag: "#수채화 #블로그감성",
      emoji: "🌸",
      bgGradient: "from-sky-500/10 to-indigo-500/20",
      description: "네이버 블로그 리뷰나 일상 포스팅에 어울리는 은은한 물감 번짐",
      stylePrompt: "soft watercolor wash, light paper texture, gentle pastel tone, airy dreamy vibe, subtle gradient blending, elegant sticker",
    },
    {
      id: "ogq-retro-pixel",
      title: "도트 픽셀 레트로 게임풍",
      ogqRank: "MZ세대 급상승 트렌드",
      tag: "#픽셀아트 #Y2K",
      emoji: "👾",
      bgGradient: "from-purple-500/10 to-pink-500/20",
      description: "레트로 오락실 감성의 아기자기하고 깜찍한 16-bit 도트 그래픽",
      stylePrompt: "16-bit cute pixel art, nostalgic game asset, vibrant retro palette, pixel perfect outline, playful arcade sticker",
    },
  ];

  const defaultCreations = [
    {
      id: "mock-1",
      title: "월요병 치비 직장인",
      tag: "#직장인 #칼퇴기원",
      category: "직장인",
      creator: "user_78**",
      prompt: "exhausted office worker chibi, holding iced coffee, dark circles, cute anime style",
      bgGradient: "from-emerald-500/10 to-teal-500/20",
      emoji: "☕",
      likesCount: 24,
      popularityScore: 54,
    },
    {
      id: "mock-2",
      title: "하트 뿅뿅 치즈냥",
      tag: "#고양이 #애교",
      category: "동물",
      creator: "nyang**",
      prompt: "cute orange tabby cat, huge sparkling eyes, surrounded by pink floating hearts, 2d sticker",
      bgGradient: "from-amber-500/10 to-orange-500/20",
      emoji: "💖",
      likesCount: 38,
      popularityScore: 92,
    },
    {
      id: "mock-3",
      title: "멘붕 온 아기토끼",
      tag: "#멘붕 #야근",
      category: "동물",
      creator: "rabbit_k**",
      prompt: "shocked white bunny with swirling eyes, question marks floating, cute chibi sticker",
      bgGradient: "from-rose-500/10 to-pink-500/20",
      emoji: "💫",
      likesCount: 19,
      popularityScore: 43,
    },
    {
      id: "mock-4",
      title: "발랄 점프 마법소녀",
      tag: "#치비 #발랄",
      category: "치비소녀",
      creator: "magical**",
      prompt: "magical girl chibi, twintails, jumping high, dynamic pose, bright smile, vector sticker",
      bgGradient: "from-green-500/10 to-emerald-500/20",
      emoji: "⭐",
      likesCount: 29,
      popularityScore: 68,
    },
  ];

  const rollingList = [...DC_CON_WALL, ...DC_CON_WALL];

  // 🌟 검증된 프록시(/api/canonical/ogq-popular)를 통한 인기 스티커 조회
  useEffect(() => {
    let isMounted = true;

    async function fetchOgqTrending() {
      setOgqLoading(true);

      try {
        const res = await fetch("/api/canonical/ogq-popular?limit=4");

        if (!res.ok) throw new Error(`Proxy Error: ${res.status}`);

        const json: any = await res.json();
        const rawList = json.items || json.data || json.content || [];

        if (isMounted) {
          if (Array.isArray(rawList) && rawList.length > 0) {
            const mapped = rawList.slice(0, 4).map((item: any, idx: number) => ({
              id: item.artWorkId || item.id || `ogq-${idx}`,
              title: item.title || item.name || `인기 화풍 #${idx + 1}`,
              ogqRank: `OGQ 인기 ${idx + 1}위`,
              tag: item.tags?.length ? `#${item.tags.slice(0, 2).join(" #")}` : "#OGQ인기",
              thumbnailUrl: item.thumbnailUrl || item.mainImageUrl || item.imageUrl,
              description: item.description || "OGQ 마켓에서 검증된 실시간 인기 그림체입니다.",
              stylePrompt: `inspired by OGQ sticker "${item.title || 'style'}", clean vector lineart, vibrant pastel colors, sticker outline`,
            }));
            setOgqMarketStyles(mapped);
          } else {
            setOgqMarketStyles(defaultOgqStyles);
          }
        }
      } catch {
        if (isMounted) {
          setOgqMarketStyles(defaultOgqStyles);
        }
      } finally {
        if (isMounted) {
          setOgqLoading(false);
        }
      }
    }

    fetchOgqTrending();

    return () => {
      isMounted = false;
    };
  }, []);

  // Firestore 실시간 랭킹 구독
  useEffect(() => {
    setLoading(true);

    try {
      const collectionRef = collection(db, "community_sets");
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
          if (!snapshot.empty) {
            const list = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }));
            list.sort((a: any, b: any) => (b.popularityScore || 0) - (a.popularityScore || 0));
            setCommunitySets(list);
          } else {
            const filtered = activeTab === "전체" 
              ? defaultCreations 
              : defaultCreations.filter((c) => c.category === activeTab);
            setCommunitySets(filtered.length > 0 ? filtered : defaultCreations);
          }
          setLoading(false);
        },
        () => {
          const filtered = activeTab === "전체" 
            ? defaultCreations 
            : defaultCreations.filter((c) => c.category === activeTab);
          setCommunitySets(filtered);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch {
      setCommunitySets(defaultCreations);
      setLoading(false);
    }
  }, [activeTab]);

  // 좋아요 클릭 (+1점)
  const handleLike = async (e: React.MouseEvent, setId: string) => {
    e.stopPropagation();
    try {
      const setRef = doc(db, "community_sets", setId);
      await updateDoc(setRef, {
        likesCount: increment(1),
        popularityScore: increment(1),
      });
    } catch {
      setCommunitySets((prev) =>
        prev.map((item) =>
          item.id === setId
            ? { ...item, likesCount: (item.likesCount || 0) + 1, popularityScore: (item.popularityScore || 0) + 1 }
            : item
        )
      );
    }
  };

  // 세트 생성하기 클릭 (+3점)
  const handleSelectSet = async (item: any) => {
    try {
      const setRef = doc(db, "community_sets", item.id);
      void updateDoc(setRef, {
        usesCount: increment(1),
        popularityScore: increment(3),
      });
    } catch {}
    onStart(item.prompt);
  };

  // 화풍 복사 버튼 클릭
  const handleApplyOgqStyle = (stylePrompt: string) => {
    const finalPrompt = keyword.trim()
      ? `${keyword.trim()}, ${stylePrompt}`
      : stylePrompt;
    onStart(finalPrompt);
  };

  return (
    <div className="w-full bg-background text-foreground overflow-x-hidden">
      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .row-move-left {
          display: flex;
          width: max-content;
          animation: scroll-left 35s linear infinite !important;
          will-change: transform;
        }
        .row-move-right {
          display: flex;
          width: max-content;
          animation: scroll-right 35s linear infinite !important;
          will-change: transform;
        }
      `}</style>

      {/* 1. 디시콘 대각선 교차 롤링 히어로 섹션 */}
      <section className="relative min-h-[700px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 pointer-events-none scale-125 flex flex-col justify-center gap-4 select-none"
          style={{ transform: "rotate(-8deg)", opacity: 0.85 }}
        >
          <div className="row-move-left flex gap-4">
            {rollingList.map((src, i) => (
              <div key={`r1-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <div className="row-move-right flex gap-4">
            {rollingList.slice().reverse().map((src, i) => (
              <div key={`r2-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <div className="row-move-left flex gap-4">
            {rollingList.map((src, i) => (
              <div key={`r3-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <div className="row-move-right flex gap-4">
            {rollingList.slice().reverse().map((src, i) => (
              <div key={`r4-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <div className="row-move-left flex gap-4">
            {rollingList.map((src, i) => (
              <div key={`r5-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 bg-background/45 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/90 border border-primary/30 text-primary text-xs font-semibold mb-6 shadow-md backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>현재 얼리버드 베타테스터 모집 중 · 전 기능 무료 오픈</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.2] mb-4 text-foreground drop-shadow-md">
            다른 어디에도 없는<br />
            <span className="text-primary">나만의 이모티콘 세트</span>
          </h1>

          <p className="text-lg sm:text-xl font-bold text-foreground mb-2 drop-shadow-sm">
            지금 무료로 시작하세요. 나만의 캐릭터 세트가 완성됩니다.
          </p>

          <p className="text-sm sm:text-base text-muted-foreground font-medium mb-8 max-w-xl">
            준비되셨나요? 원하는 캐릭터 키워드를 입력하고 나만의 세트를 바로 만들어보세요.
          </p>

          <div className="w-full max-w-2xl flex flex-col sm:flex-row gap-2.5 items-stretch justify-center mb-6">
            <div className="relative flex-1">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onStart(keyword)}
                placeholder="만들고 싶은 캐릭터를 적어보세요 (예: 안경 쓴 아기 토끼)"
                className="w-full h-14 sm:h-16 px-5 rounded-xl bg-card/95 border-2 border-border text-foreground placeholder:text-muted-foreground text-base sm:text-lg focus:outline-none focus:border-primary shadow-lg backdrop-blur-md transition-all"
              />
            </div>
            <button
              onClick={() => onStart(keyword)}
              className="h-14 sm:h-16 px-8 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-lg sm:text-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 flex-shrink-0 cursor-pointer"
            >
              <span>시작하기</span>
              <span className="text-2xl leading-none">›</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap text-xs sm:text-sm">
            <span className="text-foreground/80 font-semibold drop-shadow-sm">인기 캐릭터로 시작:</span>
            {exampleCharacters.map((c) => (
              <button
                key={c.name}
                onClick={() => onStart(c.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card/90 hover:border-primary/60 hover:bg-card text-foreground transition-all shadow-md backdrop-blur-md cursor-pointer"
              >
                <span>{c.emoji}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. OGQ 마켓 실시간 인기 스타일 참고 섹션 */}
      <section className="max-w-[1240px] mx-auto px-6 pt-12 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎨</span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                OGQ 마켓 인기 화풍 둘러보기
              </h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">
                OGQ API 연동
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              마켓에서 검증된 인기 스티커 화풍을 선택해 내 캐릭터에 그 스타일을 그대로 입혀보세요.
            </p>
          </div>

          <button
            onClick={() => onStart(keyword.trim() ? `${keyword.trim()}, cute 2d chibi sticker style` : "cute 2d chibi sticker style")}
            className="px-4 py-2 rounded-xl bg-card border border-border hover:border-primary/60 hover:text-primary text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>자유롭게 직접 만들기</span>
            <span>→</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ogqLoading ? (
            [1, 2, 3, 4].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-card border border-border animate-pulse p-4 flex flex-col justify-between">
                <div className="h-36 bg-muted rounded-xl" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-8 bg-muted rounded" />
              </div>
            ))
          ) : (
            ogqMarketStyles.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/60 hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div className={`h-40 flex flex-col items-center justify-center relative p-3 border-b border-border overflow-hidden ${
                  item.thumbnailUrl ? "bg-muted/30" : `bg-gradient-to-br ${item.bgGradient || "from-amber-500/10 to-orange-500/20"}`
                }`}>
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-5xl select-none group-hover:scale-110 transition-transform">
                      {item.emoji || "🎨"}
                    </span>
                  )}

                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 backdrop-blur-xs">
                    {item.ogqRank}
                  </span>

                  <span className="absolute bottom-2.5 left-2.5 text-[10px] text-muted-foreground bg-background/80 px-2 py-0.5 rounded backdrop-blur-xs font-medium">
                    {item.tag}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                      {item.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleApplyOgqStyle(item.stylePrompt)}
                    className="w-full py-2.5 rounded-xl border border-border bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer text-center"
                  >
                    이 화풍으로 내 캐릭터 만들기 →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 3. 실시간 인기 이모티콘 갤러리 피드 */}
      <section className="max-w-[1240px] mx-auto px-6 py-10 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                🔥 실시간 주간 인기 갤러리
              </h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                최근 7일 랭킹
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              좋아요(+1)와 이 스타일로 세트 생성(+3)이 가장 많은 실시간 인기 스티커입니다.
            </p>
          </div>

          <div className="flex gap-1.5 p-1 rounded-xl bg-card border border-border self-start">
            {["전체", "직장인", "동물", "치비소녀"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {communitySets.map((item, idx) => (
            <div 
              key={item.id} 
              className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all flex flex-col justify-between group relative"
            >
              <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-sm text-[11px] font-black text-foreground border border-border">
                #{idx + 1}
              </span>

              <button 
                onClick={(e) => handleLike(e, item.id)}
                className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-background/90 backdrop-blur-sm text-[11px] font-semibold text-foreground border border-border hover:text-rose-500 hover:border-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                ❤️ {item.likesCount || 0}
              </button>

              <div className={`h-44 flex items-center justify-center relative p-4 ${
                item.thumbnailUrl ? "bg-muted/30" : `bg-gradient-to-br ${item.bgGradient || "from-emerald-500/10 to-teal-500/20"}`
              }`}>
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-7xl filter drop-shadow-md select-none group-hover:scale-110 transition-transform">
                    {item.emoji || "✨"}
                  </span>
                )}

                {item.tag && (
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md bg-background/80 backdrop-blur-sm text-[10px] font-semibold text-foreground border border-border">
                    {item.tag}
                  </span>
                )}

                <span className="absolute bottom-3 right-3 text-[11px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded">
                  by {item.creator || item.creatorName || "익명"}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-base text-foreground mb-1.5">{item.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                    "{item.prompt || item.description}"
                  </p>
                </div>
                <button
                  onClick={() => handleSelectSet(item)}
                  className="w-full py-2.5 rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground text-xs font-semibold transition-all shadow-sm cursor-pointer"
                >
                  이 스타일로 세트 생성하기 (+3점 기여)
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. 푸터 */}
      <footer className="border-t border-border bg-card/50 py-10 text-muted-foreground text-xs">
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-bold text-sm text-foreground">모아모지</span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">BETA</span>
              </div>
              <p className="text-muted-foreground">
                누구나 클릭 한 번으로 나만의 캐릭터 이모티콘 세트를 완성하는 AI 크리에이티브 플랫폼
              </p>
            </div>

            <div className="flex items-center gap-5 font-medium">
              <button onClick={onOpenTerms} className="hover:text-foreground underline underline-offset-4 cursor-pointer">
                이용약관
              </button>
              <span>·</span>
              <button onClick={onOpenTerms} className="hover:text-foreground underline underline-offset-4 cursor-pointer">
                개인정보처리방침
              </button>
              <span>·</span>
              <a href="mailto:support@moamoji.com" className="hover:text-foreground underline underline-offset-4">
                고객문의
              </a>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] gap-2">
            <div>© 2026 Team BERT. All rights reserved.</div>
            <div>생성된 세트의 상업적 이용 권리는 라이선스 및 정책 규정에 따릅니다.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
