import React, { useState } from "react";

interface HomeProps {
  onStart: (presetText?: string) => void;
}

export default function Home({ onStart }: HomeProps) {
  const [keyword, setKeyword] = useState("");

  const presets = [
    { title: "필수 감정 세트", desc: "기쁨, 분노, 슬픔, 멘붕 등 24종", prompt: "귀여운 2D 치비 감정 표현 세트" },
    { title: "직장인 리액션", desc: "퇴근, 칼퇴, 넵, 확인했습니다", prompt: "직장인 공감 2등신 치비 이모티콘" },
    { title: "동물 마스코트", desc: "강아지, 고양이 앙증맞은 캐릭터", prompt: "귀여운 치즈 고양이 2등신 마스코트" },
    { title: "OGQ 규격 맞춤", desc: "정방형 투명 배경 최적화 생성", prompt: "네이버 OGQ 마켓용 깔끔한 스티커" },
  ];

  const exampleCharacters = [
    { name: "금발 포니테일 소녀", prompt: "1girl, bright blonde hair, long ponytail, blue eyes, cute chibi" },
    { name: "직장인 곰돌이", prompt: "cute bear wearing tie and glasses, office worker, 2sd chibi" },
    { name: "치즈 고양이", prompt: "cute orange tabby cat, big round eyes, kawaii sticker" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12">
      {/* 1. 상단 히어로 & 검색창 */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl font-extrabold text-foreground mb-3">
          어떤 이모티콘을 만들고 싶으신가요?
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          키워드 입력 또는 추천 캐릭터 클릭 한 번으로 24종 세트를 자동 생성합니다.
        </p>

        <div className="flex gap-2 p-1.5 rounded-2xl border border-primary/40 bg-card shadow-sm">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onStart(keyword)}
            placeholder="예: 안경 쓴 귀여운 아기 토끼 캐릭터"
            className="flex-1 px-4 py-2 bg-transparent text-sm outline-none text-foreground"
          />
          <button
            onClick={() => onStart(keyword)}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90"
          >
            만들기
          </button>
        </div>

        {/* 2. 빠른 예시 캐릭터 칩 */}
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <span className="text-xs text-muted-foreground">추천 캐릭터:</span>
          {exampleCharacters.map((c) => (
            <button
              key={c.name}
              onClick={() => onStart(c.prompt)}
              className="px-3 py-1 rounded-full border border-border bg-card text-xs hover:border-primary text-foreground"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 카테고리 퀵 선택 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        {presets.map((p) => (
          <div
            key={p.title}
            onClick={() => onStart(p.prompt)}
            className="p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md cursor-pointer transition-all"
          >
            <h3 className="font-bold text-foreground text-base mb-1">{p.title}</h3>
            <p className="text-xs text-muted-foreground">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
