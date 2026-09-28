import React, { useState } from "react";

interface HomeProps {
  onStart: (presetText?: string) => void;
  onOpenTerms?: () => void;
}

// 넷플릭스 배경용 디시콘/이모티콘 이미지 셋
const STICKER_WALL = [
  "https://api.iconify.design/fluent-emoji:grinning-face-with-smiling-eyes.svg",
  "https://api.iconify.design/fluent-emoji:smiling-face-with-heart-eyes.svg",
  "https://api.iconify.design/fluent-emoji:partying-face.svg",
  "https://api.iconify.design/fluent-emoji:face-with-tears-of-joy.svg",
  "https://api.iconify.design/fluent-emoji:cat-face.svg",
  "https://api.iconify.design/fluent-emoji:bear.svg",
  "https://api.iconify.design/fluent-emoji:rabbit-face.svg",
  "https://api.iconify.design/fluent-emoji:fire.svg",
  "https://api.iconify.design/fluent-emoji:sparkles.svg",
  "https://api.iconify.design/fluent-emoji:clapping-hands.svg",
  "https://api.iconify.design/fluent-emoji:saluting-face.svg",
  "https://api.iconify.design/fluent-emoji:winking-face-with-tongue.svg",
];

export default function Home({ onStart, onOpenTerms }: HomeProps) {
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState("전체");

  // 상황별 추천 템플릿 세트
  const presets = [
    { title: "필수 감정 세트", desc: "기쁨, 분노, 슬픔, 멘붕 등 실시간 소통 세트", prompt: "귀여운 2D 치비 필수 감정 표현 세트", icon: "✨" },
    { title: "직장인 리액션 세트", desc: "퇴근, 칼퇴, 넵, 확인했습니다 공감 짤", prompt: "직장인 공감 2등신 치비 이모티콘 세트", icon: "💼" },
    { title: "동물 마스코트 세트", desc: "치즈냥이, 댕댕이, 앙증맞은 동물 마스코트", prompt: "귀여운 치즈 고양이 2등신 마스코트 캐릭터", icon: "🐱" },
    { title: "OGQ 마켓 규격 세트", desc: "정방형 투명 배경 최적화 스티커", prompt: "네이버 OGQ 마켓 스티커 제출용 정방형 캐릭터 세트", icon: "📐" },
  ];

  // 추천 캐릭터 프리셋 칩
  const exampleCharacters = [
    { name: "금발 포니테일 소녀", prompt: "1girl, bright blonde hair, long ponytail, blue eyes, cute chibi", emoji: "👧" },
    { name: "안경 쓴 직장인 곰", prompt: "cute bear wearing tie and glasses, office worker, 2sd chibi", emoji: "🐻" },
    { name: "말랑 치즈 고양이", prompt: "cute orange tabby cat, big round eyes, kawaii sticker", emoji: "🐱" },
    { name: "후드티 토끼", prompt: "cute white bunny wearing oversized hoodie, chibi aesthetic", emoji: "🐰" },
  ];

  // 하단 최근 생성 쇼케이스
  const recentCreations = [
    {
      id: 1,
      title: "월요병 치비 직장인",
      tag: "#직장인 #칼퇴기원",
      creator: "user_78**",
      prompt: "exhausted office worker chibi, holding iced coffee, dark circles, cute anime style",
      bgGradient: "from-blue-600/30 to-indigo-800/40",
      emoji: "☕",
    },
    {
      id: 2,
      title: "하트 뿅뿅 치즈냥",
      tag: "#고양이 #애교",
      creator: "nyang**",
      prompt: "cute orange tabby cat, huge sparkling eyes, surrounded by pink floating hearts, 2d sticker",
      bgGradient: "from-amber-600/30 to-orange-800/40",
      emoji: "💖",
    },
    {
      id: 3,
      title: "멘붕 온 아기토끼",
      tag: "#멘붕 #야근",
      creator: "rabbit_k**",
      prompt: "shocked white bunny with swirling eyes, question marks floating, cute chibi sticker",
      bgGradient: "from-rose-600/30 to-pink-800/40",
      emoji: "💫",
    },
    {
      id: 4,
      title: "발랄 점프 마법소녀",
      tag: "#치비 #발랄",
      creator: "magical**",
      prompt: "magical girl chibi, twintails, jumping high, dynamic pose, bright smile, vector sticker",
      bgGradient: "from-purple-600/30 to-violet-800/40",
      emoji: "⭐",
    },
  ];

  return (
    <div className="w-full bg-[#0f0f10] text-white overflow-x-hidden selection:bg-red-600 selection:text-white">
      {/* ========================================================================= */}
      {/* 1. 넷플릭스 1:1 스타일 히어로 섹션 (대각선 5행 지그재그 무한 이동 포스터 월) */}
      {/* ========================================================================= */}
      <section className="relative min-h-[720px] flex items-center justify-center overflow-hidden border-b border-white/10">
        
        {/* 대각선 틸트(-8도) 회전된 무한 롤링 그리드 */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-25 scale-125 sm:scale-110 flex flex-col justify-center gap-5"
          style={{ transform: "rotate(-8deg)" }}
        >
          {/* 1행: 좌측으로 이동 */}
          <div className="flex gap-4 animate-marquee-left">
            {[...STICKER_WALL, ...STICKER_WALL, ...STICKER_WALL].map((img, i) => (
              <div key={i} className="w-28 h-36 sm:w-36 sm:h-48 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center p-4 flex-shrink-0 shadow-lg backdrop-blur-sm">
                <img src={img} alt="sticker" className="w-full h-full object-contain filter drop-shadow" />
              </div>
            ))}
          </div>

          {/* 2행: 우측으로 이동 (반대 방향) */}
          <div className="flex gap-4 animate-marquee-right">
            {[...STICKER_WALL.slice().reverse(), ...STICKER_WALL.slice().reverse(), ...STICKER_WALL.slice().reverse()].map((img, i) => (
              <div key={i} className="w-28 h-36 sm:w-36 sm:h-48 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center p-4 flex-shrink-0 shadow-lg backdrop-blur-sm">
                <img src={img} alt="sticker" className="w-full h-full object-contain filter drop-shadow" />
              </div>
            ))}
          </div>

          {/* 3행: 좌측으로 이동 */}
          <div className="flex gap-4 animate-marquee-left">
            {[...STICKER_WALL, ...STICKER_WALL, ...STICKER_WALL].map((img, i) => (
              <div key={i} className="w-28 h-36 sm:w-36 sm:h-48 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center p-4 flex-shrink-0 shadow-lg backdrop-blur-sm">
                <img src={img} alt="sticker" className="w-full h-full object-contain filter drop-shadow" />
              </div>
            ))}
          </div>

          {/* 4행: 우측으로 이동 (반대 방향) */}
          <div className="flex gap-4 animate-marquee-right">
            {[...STICKER_WALL.slice().reverse(), ...STICKER_WALL.slice().reverse(), ...STICKER_WALL.slice().reverse()].map((img, i) => (
              <div key={i} className="w-28 h-36 sm:w-36 sm:h-48 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center p-4 flex-shrink-0 shadow-lg backdrop-blur-sm">
                <img src={img} alt="sticker" className="w-full h-full object-contain filter drop-shadow" />
              </div>
            ))}
          </div>

          {/* 5행: 좌측으로 이동 */}
          <div className="flex gap-4 animate-marquee-left">
            {[...STICKER_WALL, ...STICKER_WALL, ...STICKER_WALL].map((img, i) => (
              <div key={i} className="w-28 h-36 sm:w-36 sm:h-48 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center p-4 flex-shrink-0 shadow-lg backdrop-blur-sm">
                <img src={img} alt="sticker" className="w-full h-full object-contain filter drop-shadow" />
              </div>
            ))}
          </div>
        </div>

        {/* 넷플릭스 딤드 오버레이 (상하 묵직한 블랙 비네팅) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f10] via-black/80 to-[#0f0f10]/90" />
        <div className="absolute inset-0 bg-radial-vignette opacity-80" />

        {/* 중앙 카피 & 시작 바 */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center">
          
          {/* 얼리버드 배지 */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-semibold mb-6 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>현재 얼리버드 베타테스터 모집 중 · 전 기능 무료 오픈</span>
          </div>

          {/* 메인 헤드라인 (넷플릭스 타이포 스타일) */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.15] mb-5 text-white drop-shadow-md">
            다른 어디에도 없는<br />
            <span className="text-white">나만의 이모티콘 세트</span>
          </h1>

          <p className="text-lg sm:text-2xl font-bold text-gray-200 mb-3 drop-shadow">
            지금 무료로 시작하세요. 현재 베타테스터 모집 중.
          </p>

          <p className="text-sm sm:text-base text-gray-400 mb-9 max-w-xl">
            준비되셨나요? 원하는 캐릭터 키워드를 입력하고 나만의 세트를 바로 만들어보세요.
          </p>

          {/* 넷플릭스 스타일 가로 입력 폼 */}
          <div className="w-full max-w-2xl flex flex-col sm:flex-row gap-3 items-stretch justify-center mb-6">
            <div className="relative flex-1">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onStart(keyword)}
                placeholder="만들고 싶은 캐릭터를 적어보세요 (예: 안경 쓴 아기 토끼)"
                className="w-full h-14 sm:h-16 px-5 rounded-md bg-black/60 border border-white/30 text-white placeholder-gray-400 text-base sm:text-lg focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all backdrop-blur-md"
              />
            </div>
            <button
              onClick={() => onStart(keyword)}
              className="h-14 sm:h-16 px-8 rounded-md bg-[#e50914] hover:bg-[#f40612] text-white text-lg sm:text-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
            >
              <span>시작하기</span>
              <span className="text-2xl leading-none">›</span>
            </button>
          </div>

          {/* 빠른 예시 캐릭터 선택 칩 */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs sm:text-sm">
            <span className="text-gray-400 font-medium">인기 캐릭터로 시작:</span>
            {exampleCharacters.map((c) => (
              <button
                key={c.name}
                onClick={() => onStart(c.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 hover:border-white/50 text-gray-200 transition-all backdrop-blur-sm"
              >
                <span>{c.emoji}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. 상황별 추천 템플릿 카드 세트 */}
      {/* ========================================================================= */}
      <section className="max-w-[1240px] mx-auto px-6 py-16">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">상황별 인기 세트 모아보기</h2>
          <p className="text-sm text-gray-400">자주 쓰이는 테마를 고르면 해당 스타일에 맞춰 바로 생성 세트가 구성됩니다.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {presets.map((p) => (
            <div
              key={p.title}
              onClick={() => onStart(p.prompt)}
              className="group p-6 rounded-xl border border-white/10 bg-[#161618] hover:border-red-600/60 hover:bg-[#1c1c1f] transition-all cursor-pointer flex flex-col justify-between shadow-md"
            >
              <div>
                <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">
                  {p.icon}
                </div>
                <h3 className="font-bold text-white text-lg mb-1 group-hover:text-red-500 transition-colors">
                  {p.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">{p.desc}</p>
              </div>
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-red-500">
                <span>이 세트로 만들기</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. 최근 유저들이 완성한 쇼케이스 갤러리 피드 */}
      {/* ========================================================================= */}
      <section className="max-w-[1240px] mx-auto px-6 py-12 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              🔥 실시간 인기 이모티콘 갤러리
            </h2>
            <p className="text-sm text-gray-400">다른 테스터들이 완성한 세트를 확인하고 마음에 드는 스타일로 시작해보세요.</p>
          </div>

          <div className="flex gap-1.5 p-1 rounded-lg bg-[#161618] border border-white/10 self-start">
            {["전체", "직장인", "동물", "치비소녀"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab
                    ? "bg-red-600 text-white font-semibold"
                    : "text-gray-400 hover:text-white"
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
              className="rounded-xl border border-white/10 bg-[#161618] overflow-hidden hover:border-white/30 hover:scale-[1.02] transition-all flex flex-col justify-between"
            >
              <div className={`h-48 bg-gradient-to-br ${item.bgGradient} flex items-center justify-center relative p-4`}>
                <span className="text-7xl filter drop-shadow-lg select-none">{item.emoji}</span>
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white border border-white/15">
                  {item.tag}
                </span>
                <span className="absolute bottom-3 right-3 text-[11px] text-gray-300 bg-black/40 px-2 py-0.5 rounded">
                  by {item.creator}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-base text-white mb-1.5">{item.title}</h4>
                  <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                    "{item.prompt}"
                  </p>
                </div>
                <button
                  onClick={() => onStart(item.prompt)}
                  className="w-full py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-red-600 hover:border-red-600 text-white text-xs font-semibold transition-all shadow-sm"
                >
                  이 스타일로 세트 생성하기
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. 공식 푸터 (넷플릭스 톤앤매너 & 약관) */}
      {/* ========================================================================= */}
      <footer className="border-t border-white/10 bg-[#0a0a0b] py-12 text-gray-400 text-xs">
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-sm text-white">이모티콘 세트 생성기</span>
                <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-400 text-[10px] font-semibold">BETA</span>
              </div>
              <p className="text-gray-400">
                누구나 클릭 한 번으로 나만의 캐릭터 이모티콘 세트를 완성하는 AI 크리에이티브 플랫폼
              </p>
            </div>

            <div className="flex items-center gap-5 font-medium">
              <button onClick={onOpenTerms} className="hover:text-white underline underline-offset-4">
                이용약관
              </button>
              <span>·</span>
              <button onClick={onOpenTerms} className="hover:text-white underline underline-offset-4">
                개인정보처리방침
              </button>
              <span>·</span>
              <a href="mailto:support@example.com" className="hover:text-white underline underline-offset-4">
                고객문의
              </a>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2">
            <div>© 2026 Emoticon Generator Studio. All rights reserved.</div>
            <div>생성된 세트의 상업적 이용 권리는 라이선스 및 정책 규정에 따릅니다.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
