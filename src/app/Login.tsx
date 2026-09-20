import React, { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase/config'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      // 성공 시 모달 닫기 및 후속 동작 실행
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      if (isSignUp) {
        setError('회원가입 실패: 이메일 형식이나 비밀번호 조건(6자 이상)을 확인하세요.')
      } else {
        setError('로그인 실패: 이메일 또는 비밀번호를 확인하세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        userSelect: 'none',
      }}
      onClick={onClose} // 바깥 영역 클릭 시 닫기
    >
      {/* 모달 내부 박스 (바깥 클릭 이벤트 전파 방지) */}
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 340,
          padding: '40px 32px 32px 32px',
          background: '#ffffff',
          border: '1px solid #e4e4e7',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2,
        }}
      >
        {/* 우측 상단 닫기(X) 버튼 */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            fontSize: 18,
            color: '#71717a',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: '0.05em',
              fontFamily: 'Inter, sans-serif',
              color: '#09090b',
            }}
          >
            {isSignUp ? '회원가입' : '로그인'}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#71717a' }}>
            이모티콘을 생성하려면 로그인이 필요합니다.
          </p>
        </div>

        {error && (
          <div
            style={{
              fontSize: 11,
              color: '#dc2626',
              padding: '10px 12px',
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 6,
              marginBottom: 16,
              fontFamily: 'monospace',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* 이메일 입력 */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#059669', fontFamily: 'monospace', marginBottom: 6, letterSpacing: '0.1em', fontWeight: 600 }}>
            아이디 (이메일)
          </label>
          <input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
            required
            style={{
              width: '100%',
              padding: '11px 13px',
              background: '#f8fafc',
              border: `1px solid ${focusedInput === 'email' ? '#10B981' : '#cbd5e1'}`,
              boxShadow: focusedInput === 'email' ? '0 0 0 3px rgba(16, 185, 129, 0.15)' : 'none',
              color: '#0f172a',
              borderRadius: 6,
              boxSizing: 'border-box',
              fontSize: 12,
              outline: 'none',
              transition: 'all 0.2s ease',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* 비밀번호 입력 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#059669', fontFamily: 'monospace', marginBottom: 6, letterSpacing: '0.1em', fontWeight: 600 }}>
            비밀번호 {isSignUp && <span style={{ fontSize: 9, color: '#64748b' }}>(6자 이상)</span>}
          </label>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedInput('password')}
            onBlur={() => setFocusedInput(null)}
            required
            style={{
              width: '100%',
              padding: '11px 13px',
              background: '#f8fafc',
              border: `1px solid ${focusedInput === 'password' ? '#10B981' : '#cbd5e1'}`,
              boxShadow: focusedInput === 'password' ? '0 0 0 3px rgba(16, 185, 129, 0.15)' : 'none',
              color: '#0f172a',
              borderRadius: 6,
              boxSizing: 'border-box',
              fontSize: 12,
              outline: 'none',
              transition: 'all 0.2s ease',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 0',
            background: loading ? '#059669' : 'linear-gradient(135deg, #34d399 0%, #10B981 100%)',
            border: 'none',
            color: '#ffffff',
            fontWeight: 800,
            borderRadius: 6,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            transition: 'all 0.2s ease',
            marginBottom: 14,
          }}
        >
          {loading ? '처리 중...' : isSignUp ? '회원가입 완료' : '로그인'}
        </button>

        {/* 전환 버튼 */}
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#059669',
              fontSize: 11,
              fontFamily: 'monospace',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </form>
    </div>
  )
}
