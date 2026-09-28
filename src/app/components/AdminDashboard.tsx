import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { db } from "../firebase/config";
import { calculateMetrics, type MonitoringEvent, type UserDetails } from "../lib/dashboardMetrics";

const number = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const time = (value: unknown): number | null => value instanceof Timestamp ? value.toMillis() : null;
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
const eventNames: Record<string, string> = { visit: "방문", return_visit: "재방문", generation_start: "생성 시작", generation_complete: "생성 완료", generation_fail: "생성 실패", generation_cancel: "생성 취소" };
const panel = "rounded-2xl border border-border bg-card p-5";

export default function AdminDashboard({ uid, onBack }: { uid: string; onBack: () => void }) {
  const [data, setData] = useState<{ events: MonitoringEvent[]; details: UserDetails[]; emails: Record<string, string>; now: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [days, setDays] = useState(14);
  const [target, setTarget] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    const now = Date.now();
    // Eight weeks covers the cohorts, MAU and the previous comparison period.
    Promise.all([
      getDocs(collection(db, "user_details")),
      getDocs(collection(db, "users")),
      getDocs(query(collection(db, "events"), where("createdAt", ">=", Timestamp.fromMillis(now - 56 * 86_400_000)))),
    ]).then(([details, users, events]) => {
      if (cancelled) return;
      setData({ now,
        emails: Object.fromEntries(users.docs.map((user) => [user.id, user.data().userEmail ?? user.id])),
        details: details.docs.map((user) => {
          const row = user.data();
          return { uid: user.id, firstVisitAt: time(row.firstVisitAt), lastVisitAt: time(row.lastVisitAt), visitCount: number(row.visitCount), generationStartCount: number(row.generationStartCount), generationCompleteCount: number(row.generationCompleteCount), generationFailCount: number(row.generationFailCount), regenerateCount: number(row.regenerateCount), totalGenerationTimes: number(row.totalGenerationTimes) };
        }),
        events: events.docs.flatMap((event) => {
          const row = event.data();
          const createdAt = time(row.createdAt);
          return createdAt !== null && typeof row.uid === "string" && typeof row.type === "string" ? [{ id: event.id, uid: row.uid, type: row.type, sessionId: typeof row.sessionId === "string" ? row.sessionId : "", createdAt }] : [];
        }).sort((a, b) => b.createdAt - a.createdAt),
      });
    }).catch((cause) => {
      if (!cancelled) setError(cause?.code === "permission-denied" ? "조회 권한이 없습니다. default DB에 관리자용 Firestore 규칙을 게시하고 users/{UID}.isAdmin이 true인지 확인해 주세요." : "데이터를 불러오지 못했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, refresh]);

  const metrics = useMemo(() => data ? calculateMetrics(data.events, data.details, data.now, days) : null, [data, days]);
  const cards = metrics ? [
    ["DAU", metrics.dau, "오늘 생성 활동 사용자"], ["WAU", metrics.wau, "최근 7일 생성 활동 사용자"], ["MAU", metrics.mau, "최근 30일 생성 활동 사용자"],
    ["생성 성공률", percent(metrics.successRate), "완료 ÷ (완료 + 실패), 취소 제외"], ["재방문율", percent(metrics.returnRate), "기간 방문자 중 최초 방문일 이후 방문자"], ["다음 주 리텐션", percent(metrics.weekRetention), `${metrics.retained} / ${metrics.eligible}명 · 관찰 완료 코호트`],
  ] : [];

  return <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← 홈으로</button><h1 className="text-2xl font-bold mt-3">운영 대시보드</h1><p className="text-sm text-muted-foreground mt-2">다시 오는 사용자와 생성 흐름의 이탈을 확인하세요.</p></div>
      <div className="flex items-center gap-3"><label className="text-sm">분석 기간 <select aria-label="분석 기간" value={days} onChange={(event) => setDays(Number(event.target.value))} className="ml-2 bg-card border border-border rounded-lg p-2"><option value={7}>최근 7일</option><option value={14}>최근 14일</option><option value={28}>최근 28일</option></select></label><button disabled={loading} onClick={() => setRefresh((value) => value + 1)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">새로고침</button></div>
    </div>
    {loading && <p role="status" className={panel}>모니터링 데이터를 불러오는 중…</p>}
    {error && <p role="alert" className={`${panel} text-red-400`}>{error}</p>}
    {data && metrics && <>
      <p className="text-xs text-muted-foreground">한국 시간 기준 · {new Date(data.now).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} 조회 · 로그인 사용자만 계측 · 생성은 기준 캐릭터/이모티콘 API 요청 단위</p>
      {!data.events.length && <p className={panel}>최근 8주간 이벤트가 없습니다. 계측이 시작된 뒤 방문·생성하면 실측 지표가 표시됩니다.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{cards.map(([label, value, help]) => <section key={label} className={panel}><h2 className="text-sm text-muted-foreground">{label}</h2><p className="text-3xl font-bold my-3">{value}</p><p className="text-xs text-muted-foreground">{help}</p></section>)}</div>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className={panel}><h2 className="font-semibold mb-4">방문 → 생성 → 재방문 퍼널</h2><p className="text-xs text-muted-foreground mb-4">기간 내 방문부터 순서대로 진행한 고유 사용자. 재방문은 완료일 다음 날 이후 방문입니다.</p><div className="space-y-4">{metrics.funnel.map((step) => <div key={step.label}><div className="flex justify-between text-sm mb-2"><span>{step.label}</span><span>{step.count}명 · 이전 단계 이탈 {percent(step.dropRate)}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${metrics.funnel[0].count ? step.count / metrics.funnel[0].count * 100 : 0}%` }} /></div></div>)}</div><p className="mt-5 text-sm text-muted-foreground">{metrics.biggestDrop ? `가장 큰 이탈: ${metrics.biggestDrop.label} 단계 (${percent(metrics.biggestDrop.dropRate)}). 해당 단계의 대기 시간과 오류를 먼저 확인하세요.` : "퍼널을 분석할 방문 데이터가 아직 없습니다."}</p></section>
        <section className={panel}><h2 className="font-semibold mb-4">일별 사용 추이</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={metrics.daily}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line dataKey="visitors" name="방문자(명)" stroke="#60a5fa" dot={false} /><Line dataKey="active" name="생성 활동(명)" stroke="#a78bfa" dot={false} /><Line dataKey="complete" name="생성 완료(요청)" stroke="#34d399" dot={false} /></LineChart></ResponsiveContainer></div></section>
      </div>
      <section className={panel}><h2 className="font-semibold mb-2">주간 코호트 리텐션</h2><p className="text-xs text-muted-foreground mb-4">최초 방문 주(월~일)별 사용자 중 해당 주에 다시 방문한 비율. 진행 중인 주는 ‘관찰 중’이며, 과거 이벤트가 없는 기간은 복원할 수 없습니다.</p><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-border"><th className="p-3">최초 방문 주</th><th className="p-3">인원</th>{[0, 1, 2, 3, 4].map((week) => <th key={week} className="p-3">{week === 0 ? "첫 주" : `+${week}주`}</th>)}</tr></thead><tbody>{metrics.cohorts.map((cohort) => <tr key={cohort.week} className="border-b border-border"><th className="p-3 font-normal">{cohort.week}</th><td className="p-3">{cohort.size}명</td>{cohort.retention.map((value, index) => <td key={index} className="p-3" style={value ? { backgroundColor: `rgba(52, 211, 153, ${value.rate / 100 * 0.22})` } : undefined}>{!cohort.size ? "—" : value ? `${percent(value.rate)} (${value.count}명)` : "관찰 중"}</td>)}</tr>)}</tbody></table></div></section>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className={panel}><h2 className="font-semibold mb-3">북극성 지표 · 생성 완료 사용자</h2><p className="text-3xl font-bold">{metrics.completeUsers}명 <span className="text-sm font-normal text-muted-foreground">/ 최근 {days}일</span></p><label className="block mt-4 text-sm">목표 인원 <input type="number" min={1} step={1} value={target} onChange={(event) => setTarget(Math.max(1, Math.floor(Number(event.target.value)) || 1))} className="ml-2 w-24 rounded-lg bg-background border border-border p-2" /></label><p className="text-sm mt-3">목표 대비 {percent(metrics.completeUsers / target * 100)} · 이전 {days}일: {metrics.previousCompleteUsers}명</p><p className="text-xs text-muted-foreground mt-3">목표는 이 화면에서만 적용됩니다. 개선일을 기준으로 기간별 결과를 비교하고, 실제 개선 내용과 함께 기록하세요.</p></section>
        <section className={panel}><h2 className="font-semibold mb-3">생성 요청 결과</h2><div className="grid grid-cols-3 gap-3">{[["완료", metrics.completeCount], ["실패", metrics.failCount], ["취소", metrics.cancelCount]].map(([label, count]) => <div key={label} className="rounded-xl bg-muted p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl mt-2 font-bold">{count}</p></div>)}</div><p className="text-xs text-muted-foreground mt-4">시작과 종료가 분석 기간을 넘는 요청이 있어, 기간별 시작 수와 종료 수는 다를 수 있습니다.</p></section>
      </div>
      <section className={panel}><h2 className="font-semibold mb-4">사용자별 누적 집계 · {data.details.length}명</h2><div className="overflow-x-auto"><table className="w-full text-sm text-left whitespace-nowrap"><thead><tr className="border-b border-border">{["사용자", "방문", "시작", "완료", "실패", "재생성", "소요 시간", "최근 방문"].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{[...data.details].sort((a, b) => (b.lastVisitAt ?? 0) - (a.lastVisitAt ?? 0)).map((user) => <tr key={user.uid} className="border-b border-border"><td className="p-3" title={user.uid}>{data.emails[user.uid] ?? user.uid}</td>{[user.visitCount, user.generationStartCount, user.generationCompleteCount, user.generationFailCount, user.regenerateCount].map((count, index) => <td key={index} className="p-3">{count}</td>)}<td className="p-3">{(user.totalGenerationTimes / 1000).toFixed(1)}초</td><td className="p-3">{user.lastVisitAt ? new Date(user.lastVisitAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "—"}</td></tr>)}</tbody></table></div></section>
      <section className={panel}><h2 className="font-semibold mb-4">최근 이벤트 · 최대 50건</h2><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-border"><th className="p-3">시각</th><th className="p-3">사용자</th><th className="p-3">이벤트</th><th className="p-3">세션</th></tr></thead><tbody>{data.events.slice(0, 50).map((event) => <tr key={event.id} className="border-b border-border"><td className="p-3 whitespace-nowrap">{new Date(event.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td><td className="p-3 break-all">{data.emails[event.uid] ?? event.uid}</td><td className="p-3 whitespace-nowrap">{eventNames[event.type] ?? event.type}</td><td className="p-3 font-mono text-xs break-all">{event.sessionId || "—"}</td></tr>)}</tbody></table></div></section>
    </>}
  </main>;
}
