import React, { useState } from "react";

interface HomeProps {
  onStart: (presetText?: string) => void;
  onOpenTerms?: () => void;
}

// 넷플릭스 배경용 샘플 이모티콘/아이콘 리스트 (SVG / 더미 이미지)
const SAMPLE_STICKERS = [
  "https://api.iconify.design/fluent-emoji:grinning-face-with-smiling-eyes.svg",
  "https://api.iconify.design/fluent-emoji:smiling-face-with-heart-eyes.svg",
  "https://api.iconify.design/fluent-emoji:partying-face.svg",
  "https://api.iconify.design/fluent-emoji:face-with-tears-of-joy.svg",
  "https://api.iconify.design/fluent-emoji:sparkles.svg",
  "https://api.iconify.design/fluent-emoji:cat-face.svg",
  "https://api.iconify.design/fluent-emoji:bear.svg",
  "https://api.iconify.design/fluent-emoji:rabbit-face.svg",
  "https://api.iconify.design/fluent-emoji:fire.svg",
  "https://api.iconify.design/fluent-emoji:glowing-star.svg",
  "https://api.iconify.design/fluent-emoji:thumbs-up.svg",
  "https://api.iconify.design/fluent-emoji:rocket.svg",
];

export default function Home({ onStart, onOpenTerms }: HomeProps) {
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState("전체");

  // 상단 퀵 프리셋 카드
  const presets = [
    { title: "필수 감정 24종", desc: "기쁨, 분노, 슬픔, 멘붕 등 핵심 감정", prompt: "귀여운 2D 치비 필수 감정 표현 24종 세트", icon: "✨" },
    { title: "직장인 리액션", desc: "퇴근, 칼퇴, 넵, 확인했습니다 공감짤", prompt: "직장인 공감 2등신 치비 이모티콘 세트", icon: "💼" },
    { title: "동물 마스코트", desc: "치즈냥이, 댕댕이, 앙증맞은 동물", prompt: "귀여운 치즈 고양이 2등신 마스코트 캐릭터", icon: "🐱" },
    { title: "네이버 OGQ 규격", desc: "1024x1024 정방형 투명 배경 최적화", prompt: "네이버 OGQ 마켓 스티커 제출용 정방형 캐릭터", icon: "📐" },
  ];

  // 추천 캐릭터 아바타 칩
  const exampleCharacters = [
    { name: "금발 포니테일 소녀", prompt: "1girl, bright blonde hair, long ponytail, blue eyes, cute chibi", emoji: "👧" },
    { name: "안경 쓴 직장인 곰", prompt: "cute bear wearing tie and glasses, office worker, 2sd chibi", emoji: "🐻" },
    { name: "말랑 치즈 고양이", prompt: "cute orange tabby cat, big round eyes, kawaii sticker", emoji: "🐱" },
    { name: "후드티 토끼", prompt: "cute white bunny wearing oversized hoodie, chibi aesthetic", emoji: "🐰" },
  ];

  // 최근 생성 갤러리 피드 데이터
  const recentCreations = [
    {
      id: 1,
      title: "월요병 치비 직장인",
      tag: "#직장인 #칼퇴기원",
      creator: "user_78**",
      prompt: "exhausted office worker chibi, holding iced coffee, dark circles, cute anime style",
      bgGradient: "from-blue-500/20 to-indigo-500/20",
      emoji: "☕"
    },
    {
      id: 2,
      title: "하트 뿅뿅 치즈냥",
      tag: "#고양이 #애교",
      creator: "nyang**",
      prompt: "cute orange tabby cat, huge sparkling eyes, surrounded by pink floating hearts, 2d sticker",
      bgGradient: "from-amber-500/20 to-orange-500/20",
      emoji: "💖"
    },
    {
      id: 3,
      title: "멘붕 온 아기토끼",
      tag: "#멘붕 #야근",
      creator: "rabbit_k**",
      prompt: "shocked white bunny with swirling eyes, question marks floating, cute chibi sticker",
      bgGradient: "from-rose-500/20 to-pink-500/20",
      emoji: "💫"
    },
    {
      id: 4,
      title: "발랄 점프 마법소녀",
      tag: "#치비 #발랄",
      creator: "magical**",
      prompt: "magical girl chibi, twintails, jumping high, dynamic pose, bright smile, vector sticker",
      bgGradient: "from-purple-500/20 to-violet-500/20",
      emoji: "⭐"
    }
  ];

  return (
    <div className="w-full bg-background text-foreground overflow-x-hidden">
      {/* ========================================================================= */}
      {/* 1. 넷플릭스 스타일 인터랙티브 히어로 섹션 (대각선 롤링 배경 + 딤드 오버레이) */}
      {/* ========================================================================= */}
      <section className="relative min-h-[640px] flex items-center justify-center overflow-hidden border-b border-border">
        {/* 대각선 틸트 롤링 배경 그리드 */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-20 scale-125"
          style={{ transform: "rotate(-8deg)" }}
        >
          <div className="flex flex-col gap-4 -mt-20">
            {/* 행 1: 왼쪽으로 무한 이동 */}
            <div className="flex gap-4 animate-marquee-left">
              {[...SAMPLE_STICKERS, ...SAMPLE_STICKERS, ...SAMPLE_STICKERS].map((img, i) => (
                <div key={i} className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/80 flex items-center justify-center p-4 shadow-sm flex-shrink-0">
                  <img src={img} alt="sticker" className="w-full h-full object-contain filter drop-shadow-sm" />
                </div>
              ))}
            </div>

            {/* 행 2: 오른쪽으로 무한 이동 */}
            <div className="flex gap-4 animate-marquee-right">
              {[...SAMPLE_STICKERS.slice().reverse(), ...SAMPLE_STICKERS.slice().reverse(), ...SAMPLE_STICKERS.slice().reverse()].map((img, i) => (
                <div key={i} className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/80 flex items-center justify-center p-4 shadow-sm flex-shrink-0">
                  <img src={img} alt="sticker" className="w-full h-full object-contain filter drop-shadow-sm" />
                </div>
              ))}
            </div>

            {/* 행 3: 왼쪽으로 무한 이동 */}
            <div className="flex gap-4 animate-marquee-left">
              {[...SAMPLE_STICKERS, ...SAMPLE_STICKERS, ...SAMPLE_STICKERS].map((img, i) => (
                <div key={i} className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/80 flex items-center justify-center p-4 shadow-sm flex-shrink-0">
                  <img src={img} alt="sticker" className="w-full h-full object-contain filter drop-shadow-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 넷플릭스 특유의 다크/그라데이션 비네팅 딤드 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />

        {/* 중앙 카피 & 인터랙션 영역 */}
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6 animate-pulse">
            <span>🔥 현재 얼리버드 베타 테스터 모집 중</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>무료 생성 지원</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight mb-4">
            다른 어디에도 없는<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500">
              나만의 이모티콘 24종
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground font-medium mb-8 max-w-xl mx-auto">
            단 한 장의 캐릭터로 카톡 · 네이버 OGQ 마켓 규격 24장을 30초 만에.<br />
            지금 바로 무료로 시작해보세요.
          </p>

          {/* 메인 검색창 (다방 & 넷플릭스 결합) */}
          <div className="relative max-w-xl mx-auto mb-6">
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-card/90 backdrop-blur-md border-2 border-primary/50 shadow-xl focus-within:border-primary transition-all">
              <span className="pl-3 text-lg">🔍</span>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onStart(keyword)}
                placeholder="어떤 캐릭터를 만들고 싶으신가요? (예: 안경 쓴 아기 토끼)"
                className="w-full px-3 py-2 bg-transparent text-sm sm:text-base outline-none text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={() => onStart(keyword)}
                className="px-6 py-3 bg-primary text-primary-foreground font-bold text-sm sm:text-base rounded-xl hover:opacity-90 transition-opacity flex-shrink-0 shadow-md"
              >
                시작하기 →
              </button>
            </div>
          </div>

          {/* 추천 캐릭터 아바타 칩 */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground font-medium">추천 캐릭터:</span>
            {exampleCharacters.map((c) => (
              <button
                key={c.name}
                onClick={() => onStart(c.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-card/80 hover:bg-accent hover:border-primary/40 text-foreground transition-all shadow-sm"
              >
                <span>{c.emoji}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. 신뢰도 통계 바 (Social Proof Metrics) */}
      {/* ========================================================================= */}
      <section className="border-b border-border bg-card/40 py-5">
        <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-extrabold text-foreground">24종</div>
            <div className="text-xs text-muted-foreground font-medium">원클릭 세트 자동 생성</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-500">100%</div>
            <div className="text-xs text-muted-foreground font-medium">네이버 OGQ 규격 매칭</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">2등신</div>
            <div className="text-xs text-muted-foreground font-medium">치비 캐릭터 비율 강제 엔진</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-primary">Free</div>
            <div className="text-xs text-muted-foreground font-medium">베타 기간 전액 무료 지원</div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. 다방식 4개 카테고리 퀵 선택 카드 */}
      {/* ========================================================================= */}
      <section className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">상황별 추천 템플릿</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">목적에 맞는 세트를 선택하면 맞춤 프롬프트로 바로 생성창이 열립니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {presets.map((p) => (
            <div
              key={p.title}
              onClick={() => onStart(p.prompt)}
              className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                  {p.icon}
                </div>
                <h3 className="font-bold text-foreground text-base mb-1 group-hover:text-primary transition-colors">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-primary">
                <span>세트 만들기</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. 실시간 생성 갤러리 피드 (다방 하단 큐레이션 형태) */}
      {/* ========================================================================= */}
      <section className="max-w-[1200px] mx-auto px-6 py-10 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">🔥 최근 유저들이 완성한 인기 이모티콘</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">다른 크리에이터들이 생성한 스타일을 둘러보고 원클릭으로 내 캐릭터에 적용해보세요.</p>
          </div>

          {/* 필터 탭 */}
          <div className="flex gap-1.5 p-1 rounded-xl bg-card border border-border self-start">
            {["전체", "직장인", "동물", "치비소녀"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 갤러리 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          {recentCreations.map((item) => (
            <div 
              key={item.id} 
              className="rounded-2xl border border-border bg-card overflow-hidden hover:shadow-xl hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              {/* 이미지 썸네일 영역 (이모지 & 그라데이션) */}
              <div className={`h-40 bg-gradient-to-br ${item.bgGradient} flex items-center justify-center relative p-4`}>
                <span className="text-6xl filter drop-shadow-md select-none">{item.emoji}</span>
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-[11px] font-semibold text-foreground">
                  {item.tag}
                </span>
                <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
                  by {item.creator}
                </span>
              </div>

              {/* 하단 카드 정보 */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-foreground mb-1">{item.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    "{item.prompt}"
                  </p>
                </div>
                <button
                  onClick={() => onStart(item.prompt)}
                  className="w-full py-2 rounded-xl border border-border hover:border-primary bg-secondary/50 text-secondary-foreground text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  이 스타일로 생성하기
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. 공식 서비스 푸터 (이용약관 및 정책 명시) */}
      {/* ========================================================================= */}
      <footer className="border-t border-border bg-card/60 mt-12 py-10">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-sm text-foreground">이모티콘 생성기 (Beta)</span>
                <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] text-muted-foreground">v1.0.0</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                네이버 OGQ 마켓 및 카카오톡 스티커를 위한 2D 치비 스타일 24종 자동 생성 플랫폼
              </p>
            </div>

            {/* 정책 및 약관 링크 */}
            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <button onClick={onOpenTerms} className="hover:text-foreground underline underline-offset-4">
                이용약관
              </button>
              <span>·</span>
              <button onClick={onOpenTerms} className="hover:text-foreground underline underline-offset-4">
                개인정보처리방침
              </button>
              <span>·</span>
              <a href="mailto:support@example.com" className="hover:text-foreground underline underline-offset-4">
                문의하기
              </a>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground gap-2">
            <div>© 2026 Emoticon Generator Team. All rights reserved.</div>
            <div>생성된 결과물의 상업적 활용은 이용약관 및 오픈 소스 라이선스 정책을 준수합니다.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
