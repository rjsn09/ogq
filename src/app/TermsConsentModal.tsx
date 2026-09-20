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
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAiOptional, setAgreeAiOptional] = useState(false);

  if (!isOpen) return null;

  const isAllRequiredAgreed = agreeTerms && agreePrivacy;

  const handleAllCheck = (checked: boolean) => {
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeAiOptional(checked);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllRequiredAgreed) {
      alert("서비스 이용을 위해 필수 항목에 모두 동의해 주세요.");
      return;
    }
    onConfirm(agreeAiOptional);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
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
          width: 520,
          maxHeight: "90vh",
          padding: "32px 28px 24px 28px",
          background: "#ffffff",
          borderRadius: 16,
          border: "1px solid #e4e4e7",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: "#09090b",
              margin: 0,
            }}
          >
            서비스 이용약관 및 개인정보 처리방침 동의
          </h3>
          <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#71717a" }}>
            이모티콘 자동 생성을 위해 아래 법적 고지 전문을 확인해 주세요.
          </p>
        </div>

        {/* 전체 동의 체크박스 */}
        <div
          style={{
            padding: "12px 14px",
            background: "#f4f4f5",
            borderRadius: 8,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
          }}
          onClick={() => handleAllCheck(!isAllRequiredAgreed)}
        >
          <input
            type="checkbox"
            checked={isAllRequiredAgreed && agreeAiOptional}
            onChange={(e) => handleAllCheck(e.target.checked)}
            style={{ accentColor: "#10B981", width: 16, height: 16, cursor: "pointer" }}
          />
          <span>모든 약관 및 처리방침에 전체 동의합니다.</span>
        </div>

        {/* 정식 장문 약관 스크롤 뷰어 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "14px",
            fontSize: 11,
            color: "#475569",
            lineHeight: 1.65,
            background: "#fafafa",
            marginBottom: 16,
            maxHeight: 250,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a", marginBottom: 6 }}>
            [제1부] 서비스 이용약관
          </div>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제1조 (목적)</strong><br />
            본 약관은 회사가 제공하는 인공지능(AI) 기반 이모티콘 생성 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제2조 (용어의 정의)</strong><br />
            1. "서비스"란 이용자가 입력한 프롬프트 및 이미지를 바탕으로 네이버 OGQ 마켓 규격(24종 세트 등)에 최적화된 이모티콘 이미지를 생성하는 웹 소프트웨어를 말합니다.<br />
            2. "생성물"이란 인공지능 알고리즘이 연산하여 출력한 그래픽 이미지 일체를 의미합니다.
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제3조 (이용자의 금지행위)</strong><br />
            이용자는 다음 각 호의 행위를 하여서는 안 됩니다.<br />
            1. 타인의 초상권, 저작권, 상표권 등 지식재산권을 침해하는 이미지나 텍스트를 입력하는 행위<br />
            2. 음란, 폭력, 혐오, 사기적이거나 미풍양속에 반하는 프롬프트를 전송하는 행위<br />
            3. 특정 개인을 식별할 수 있는 고유식별정보, 주민등록번호, 타인의 개인정보를 대화창/프롬프트에 입력하는 행위
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제4조 (생성물의 저작권 및 마켓 심사 면책)</strong><br />
            1. 생성물에 대한 이용 권한은 법령이 허용하는 범위 내에서 생성한 이용자에게 귀속됩니다.<br />
            2. 이용자는 본 생성물을 네이버 OGQ 마켓 등에 제안할 수 있으나, 해당 플랫폼의 심사 통과 여부 및 상업적 승인 결과는 이용자의 책임이며 회사는 이를 보증하지 않습니다.<br />
            3. 타인의 권리를 침해하여 발생하는 일체의 분쟁에 대한 책임은 이용자 본인에게 있습니다.
          </p>
          <p style={{ margin: "0 0 16px 0" }}>
            <strong>제5조 (서비스 면책 조항)</strong><br />
            생성형 인공지능 기술의 특성상 생성물에는 부정확한 표현, 결함 또는 유사물이 발생할 수 있으며, 회사는 생성물의 무결성이나 특정 목적 적합성을 보증하지 않습니다.
          </p>

          <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a", marginBottom: 6 }}>
            [제2부] 개인정보 처리방침 (정부지침 표준)
          </div>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제1조 (개인정보의 처리 목적)</strong><br />
            회사는 다음의 목적을 위해 최소한의 개인정보를 처리합니다.<br />
            - 회원 식별, 계정 관리 및 부정 이용 방지<br />
            - 인공지능 기반 24장 이모티콘 생성, 이미지 변환 및 다운로드 기능 제공
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제2조 (처리하는 개인정보 항목)</strong><br />
            - 회원정보: 이메일 계정, 비밀번호<br />
            - AI 작업 데이터: 업로드된 기준 이미지(Canonical Image), 입력 텍스트 지시어(프롬프트), 자동 생성된 24장 이미지<br />
            - 자동 수집 항목: 접속 IP, 쿠키, 서비스 접속 일시
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제3조 (개인정보의 처리 및 보유 기간)</strong><br />
            - 회원 계정 정보: 회원 탈퇴 시까지<br />
            - 이모티콘 생성 작업 데이터(이미지, 프롬프트): 생성 완료일로부터 <strong>30일간 보관 후 복구 불가능한 방법으로 영구 파기</strong> (회원 탈퇴 시 즉시 파기)
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제4조 (처리업무의 위탁 및 국외 이전에 관한 사항)</strong><br />
            회사는 이미지 생성을 위해 국외 전문 인공지능 API를 활용합니다.<br />
            - 이전받는 자: 외부 AI 연동 API 사업자 (미국 소재)<br />
            - 이전 항목: 입력 프롬프트 및 변환용 기준 이미지<br />
            - 이전 목적: 고화질 이모티콘 결과물 연산 및 생성<br />
            - 보유 기간: 결과물 생성 반환 즉시 파기 (자체 AI 모델 재학습에 무단 활용되지 않음)
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>제5조 (정보주체의 권리 및 거부권)</strong><br />
            정보주체는 언제든지 본인의 개인정보 열람, 삭제, 처리정지 및 동의 철회를 요구할 수 있습니다.
          </p>
        </div>

        {/* 개별 체크박스 목록 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, fontSize: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              style={{ accentColor: "#10B981" }}
            />
            <span><strong>[필수]</strong> 서비스 이용약관 동의</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              style={{ accentColor: "#10B981" }}
            />
            <span><strong>[필수]</strong> 개인정보 수집·이용 및 국외 위탁 동의</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#64748b" }}>
            <input
              type="checkbox"
              checked={agreeAiOptional}
              onChange={(e) => setAgreeAiOptional(e.target.checked)}
              style={{ accentColor: "#10B981" }}
            />
            <span>[선택] 서비스 품질 향상을 위한 프롬프트 데이터 활용 동의</span>
          </label>
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              background: "#f1f5f9",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
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
            disabled={!isAllRequiredAgreed}
            style={{
              flex: 2,
              padding: "12px 0",
              background: isAllRequiredAgreed
                ? "linear-gradient(135deg, #34d399 0%, #10B981 100%)"
                : "#cbd5e1",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 800,
              color: "#ffffff",
              cursor: isAllRequiredAgreed ? "pointer" : "not-allowed",
              boxShadow: isAllRequiredAgreed
                ? "0 4px 12px rgba(16, 185, 129, 0.3)"
                : "none",
              transition: "all 0.2s ease",
            }}
          >
            동의하고 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
