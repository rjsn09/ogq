import React, { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase/config'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      console.error(err)
      setError('로그인 실패: 이메일 또는 비밀번호를 확인하세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        color: '#18181b',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 상단 부드러운 에메랄드 빛 조명 효과 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 320,
          height: '100%',
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.01) 80%, transparent 100%)',
          clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 로그인 폼 박스 */}
      <form
        onSubmit={handleLogin}
        style={{
          position: 'relative',
          width: 340,
          padding: '40px 32px',
          background: '#ffffff',
          border: '1px solid #e4e4e7',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.06), 0 0 20px rgba(16, 185, 129, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: '0.1em',
              fontFamily: 'Inter, sans-serif',
              whiteSpace: 'nowrap',
              color: '#09090b',
            }}
          >
            로그인
          </div>
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
              marginBottom: 18,
              fontFamily: 'monospace',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* 이메일 입력창 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#059669', fontFamily: 'monospace', marginBottom: 6, letterSpacing: '0.1em', fontWeight: 600 }}>
            아이디
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
              padding: '12px 14px',
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

        {/* 비밀번호 입력창 */}
        <div style={{ marginBottom: 26 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#059669', fontFamily: 'monospace', marginBottom: 6, letterSpacing: '0.1em', fontWeight: 600 }}>
            비밀번호
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
              padding: '12px 14px',
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
            padding: '13px 0',
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
          }}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
