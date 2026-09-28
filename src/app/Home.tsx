import React, { useState } from "react";

interface HomeProps {
  onStart: (presetText?: string) => void;
  onOpenTerms?: () => void;
}

// public/img 폴더에 업로드된 1.png ~ 24.png 파일 직접 매핑
const DC_CON_WALL = Array.from({ length: 24 }, (_, i) => `/img/${i + 1}.png`);

export default function Home({ onStart, onOpenTerms }: HomeProps) {
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState("전체");

  const presets = [
    { title: "필수 감정 세트", desc: "기쁨, 분노, 슬픔, 멘붕 등 실시간 소통 세트", prompt: "귀여운 2D 치비 필수 감정 표현 세트", icon: "✨" },
    { title: "직장인 리액션 세트", desc: "퇴근, 칼퇴, 넵, 확인했습니다 공감 짤", prompt: "직장인 공감 2등신 치비 이모티콘 세트", icon: "💼" },
    { title: "동물 마스코트 세트", desc: "치즈냥이, 댕댕이, 앙증맞은 동물 마스코트", prompt: "귀여운 치즈 고양이 2등신 마스코트 캐릭터", icon: "🐱" },
    { title: "OGQ 마켓 규격 세트", desc: "정방형 투명 배경 최적화 스티커", prompt: "네이버 OGQ 마켓 스티커 제출용 정방형 캐릭터 세트", icon: "📐" },
  ];

  const exampleCharacters = [
    { name: "금발 포니테일 소녀", prompt: "1girl, bright blonde hair, long ponytail, blue eyes, cute chibi", emoji: "👧" },
    { name: "안경 쓴 직장인 곰", prompt: "cute bear wearing tie and glasses, office worker, 2sd chibi", emoji: "🐻" },
    { name: "말랑 치즈 고양이", prompt: "cute orange tabby cat, big round eyes, kawaii sticker", emoji: "🐱" },
    { name: "후드티 토끼", prompt: "cute white bunny wearing oversized hoodie, chibi aesthetic", emoji: "🐰" },
  ];

  const recentCreations = [
    {
      id: 1,
      title: "월요병 치비 직장인",
      tag: "#직장인 #칼퇴기원",
      creator: "user_78**",
      prompt: "exhausted office worker chibi, holding iced coffee, dark circles, cute anime style",
      bgGradient: "from-emerald-500/10 to-teal-500/20",
      emoji: "☕",
    },
    {
      id: 2,
      title: "하트 뿅뿅 치즈냥",
      tag: "#고양이 #애교",
      creator: "nyang**",
      prompt: "cute orange tabby cat, huge sparkling eyes, surrounded by pink floating hearts, 2d sticker",
      bgGradient: "from-amber-500/10 to-orange-500/20",
      emoji: "💖",
    },
    {
      id: 3,
      title: "멘붕 온 아기토끼",
      tag: "#멘붕 #야근",
      creator: "rabbit_k**",
      prompt: "shocked white bunny with swirling eyes, question marks floating, cute chibi sticker",
      bgGradient: "from-rose-500/10 to-pink-500/20",
      emoji: "💫",
    },
    {
      id: 4,
      title: "발랄 점프 마법소녀",
      tag: "#치비 #발랄",
      creator: "magical**",
      prompt: "magical girl chibi, twintails, jumping high, dynamic pose, bright smile, vector sticker",
      bgGradient: "from-green-500/10 to-emerald-500/20",
      emoji: "⭐",
    },
  ];

  // 무한 롤링 트랙에 빈틈이 없도록 2벌 연결
  const rollingList = [...DC_CON_WALL, ...DC_CON_WALL];

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
          {/* 1행: 좌측 이동 */}
          <div className="row-move-left flex gap-4">
            {rollingList.map((src, i) => (
              <div key={`r1-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          {/* 2행: 우측 이동 (교차) */}
          <div className="row-move-right flex gap-4">
            {rollingList.slice().reverse().map((src, i) => (
              <div key={`r2-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          {/* 3행: 좌측 이동 */}
          <div className="row-move-left flex gap-4">
            {rollingList.map((src, i) => (
              <div key={`r3-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          {/* 4행: 우측 이동 (교차) */}
          <div className="row-move-right flex gap-4">
            {rollingList.slice().reverse().map((src, i) => (
              <div key={`r4-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          {/* 5행: 좌측 이동 */}
          <div className="row-move-left flex gap-4">
            {rollingList.map((src, i) => (
              <div key={`r5-${i}`} className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-card border-2 border-border shadow-md overflow-hidden flex-shrink-0">
                <img src={src} alt="dccon" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* 배경 반투명 오버레이 */}
        <div className="absolute inset-0 bg-background/45 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />

        {/* 중앙 카피 & 시작 바 */}
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
              className="h-14 sm:h-16 px-8 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-lg sm:text-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 flex-shrink-0"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card/90 hover:border-primary/60 hover:bg-card text-foreground transition-all shadow-md backdrop-blur-md"
              >
                <span>{c.emoji}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. 템플릿 카드 */}
      <section className="max-w-[1240px] mx-auto px-6 pt-6 pb-14">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-1">상황별 인기 세트 모아보기</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">자주 쓰이는 테마를 고르면 해당 스타일에 맞춰 바로 생성 세트가 구성됩니다.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {presets.map((p) => (
            <div
              key={p.title}
              onClick={() => onStart(p.prompt)}
              className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/60 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {p.icon}
                </div>
                <h3 className="font-bold text-foreground text-lg mb-1 group-hover:text-primary transition-colors">
                  {p.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
                <span>이 세트로 만들기</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 갤러리 피드 */}
      <section className="max-w-[1240px] mx-auto px-6 py-12 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-1">
              🔥 실시간 인기 이모티콘 갤러리
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">다른 테스터들이 완성한 세트를 확인하고 마음에 드는 스타일로 시작해보세요.</p>
          </div>

          <div className="flex gap-1.5 p-1 rounded-xl bg-card border border-border self-start">
            {["전체", "직장인", "동물", "치비소녀"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
          {recentCreations.map((item) => (
            <div 
              key={item.id} 
              className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div className={`h-44 bg-gradient-to-br ${item.bgGradient} flex items-center justify-center relative p-4`}>
                <span className="text-7xl filter drop-shadow-md select-none">{item.emoji}</span>
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-[11px] font-semibold text-foreground border border-border">
                  {item.tag}
                </span>
                <span className="absolute bottom-3 right-3 text-[11px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded">
                  by {item.creator}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-base text-foreground mb-1.5">{item.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                    "{item.prompt}"
                  </p>
                </div>
                <button
                  onClick={() => onStart(item.prompt)}
                  className="w-full py-2.5 rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground text-xs font-semibold transition-all shadow-sm"
                >
                  이 스타일로 세트 생성하기
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
                <span className="font-bold text-sm text-foreground">이모티콘 세트 생성기</span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">BETA</span>
              </div>
              <p className="text-muted-foreground">
                누구나 클릭 한 번으로 나만의 캐릭터 이모티콘 세트를 완성하는 AI 크리에이티브 플랫폼
              </p>
            </div>

            <div className="flex items-center gap-5 font-medium">
              <button onClick={onOpenTerms} className="hover:text-foreground underline underline-offset-4">
                이용약관
              </button>
              <span>·</span>
              <button onClick={onOpenTerms} className="hover:text-foreground underline underline-offset-4">
                개인정보처리방침
              </button>
              <span>·</span>
              <a href="mailto:support@example.com" className="hover:text-foreground underline underline-offset-4">
                고객문의
              </a>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] gap-2">
            <div>© 2026 Emoticon Generator Studio. All rights reserved.</div>
            <div>생성된 세트의 상업적 이용 권리는 라이선스 및 정책 규정에 따릅니다.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
