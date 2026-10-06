import React from "react";

export function StepBadge({
  step,
  label,
  done,
}: {
  step: number;
  label: string;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ${
        done
          ? "bg-secondary border-primary/30 text-secondary-foreground"
          : "bg-card border-border text-muted-foreground"
      }`}
      style={{ fontWeight: 500 }}
    >
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center ${
          done
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
        style={{ fontWeight: 700, fontSize: "10px" }}
      >
        {done ? "✓" : step}
      </span>
      {label}
    </div>
  );
}

interface HeaderProps {
  userEmail?: string | null;
  onLoginClick: () => void;
  onLogoClick: () => void;
  isAdmin: boolean;
  onDashboardClick: () => void;
  profileMenu?: React.ReactNode;
}

export default function Header({
  userEmail,
  onLoginClick,
  onLogoClick,
  isAdmin,
  onDashboardClick,
  profileMenu,
}: HeaderProps) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={onLogoClick}
        >
          <div className="w-8 h-8 flex items-center justify-center">
            <img
              src="/moamoji.png"
              className="w-full h-full object-contain drop-shadow-sm"
              alt="moamoji"
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-foreground"
              style={{ fontWeight: 700, fontSize: "1rem" }}
            >
              모아모지
            </span>
            <span className="text-muted-foreground text-xs hidden sm:inline">
              네이버 OGQ 마켓연계 · 이모지 세트 생성
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userEmail ? (
            <>
              <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                {userEmail}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                Beta
              </span>
              {isAdmin && (
                <button 
                  onClick={onDashboardClick} 
                  className="px-3 py-1.5 rounded-xl border border-primary/40 text-xs text-primary hover:bg-muted transition-colors cursor-pointer"
                >
                  대시보드
                </button>
              )}
              {profileMenu}
            </>
          ) : (
            <button
              onClick={onLoginClick}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity font-mono font-semibold cursor-pointer"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
