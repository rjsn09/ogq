import React, { useState } from "react";

interface TermsConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (allowAiTraining: boolean) => void;
}

export default function TermsConsentModal({
  isOpen,
  onClose,
  onConfirm,
}: TermsConsentModalProps) {
  const [agreeRequired, setAgreeRequired] = useState(false);
  const [agreeOptional, setAgreeOptional] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeRequired) {
      alert("서비스 이용을 위해 필수 항목에 동의해 주세요.");
      return;
    }
    onConfirm(agreeOptional);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        userSelect: "none",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          width: 400,
          padding: "32px 28px",
          background: "#ffffff",
          borderRadius: 16,
          border: "1px solid #e4e4e7",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 800,
              margin: 0,
              color: "#09090b",
            }}
          >
            서비스 이용 및 데이터 처리 동의
          </h3>
          <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#71717a" }}>
            이모티콘 생성을 위해 아래 개인정보 처리 방침을 확인해 주세요.
          </p>
        </div>

        {/* 간이형 핵심 고지 박스 */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "14px",
            fontSize: 12,
            color: "#334155",
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            📌 AI 생성 데이터 처리 안내
          </p>
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li>
              <strong>처리 목적:</strong> 24장 이모티콘 이미지 자동 생성
            </li>
            <li>
              <strong>처리 항목:</strong> 업로드 이미지, 입력 프롬프트
            </li>
            <li>
              <strong>보유 기간:</strong> 생성 후 30일 보관 뒤 영구 파기
            </li>
            <li>
              <strong>국외 위탁:</strong> 이미지 생성을 위해 해외 AI API로
              암호화 전송 후 즉시 파기
            </li>
          </ul>
        </div>

        {/* 체크박스 영역 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={agreeRequired}
              onChange={(e) => setAgreeRequired(e.target.checked)}
            />
            <span>[필수] 개인정보 수집 및 AI 생성 국외 위탁 동의</span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: "pointer",
              color: "#475569",
            }}
          >
            <input
              type="checkbox"
              checked={agreeOptional}
              onChange={(e) => setAgreeOptional(e.target.checked)}
            />
            <span>[선택] 서비스 품질 향상을 위한 생성 데이터 활용 동의</span>
          </label>
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              background: "#f1f5f9",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "#475569",
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!agreeRequired}
            style={{
              flex: 2,
              padding: "12px 0",
              background: agreeRequired
                ? "linear-gradient(135deg, #34d399 0%, #10B981 100%)"
                : "#94a3b8",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 800,
              color: "#ffffff",
              cursor: agreeRequired ? "pointer" : "not-allowed",
              boxShadow: agreeRequired
                ? "0 4px 12px rgba(16, 185, 129, 0.3)"
                : "none",
            }}
          >
            동의하고 생성하기
          </button>
        </div>
      </div>
    </div>
  );
}
