export type MonitoringEvent = { id: string; uid: string; type: string; sessionId: string; createdAt: number };
export type UserDetails = {
  uid: string; firstVisitAt: number | null; lastVisitAt: number | null;
  visitCount: number; generationStartCount: number; generationCompleteCount: number;
  generationFailCount: number; regenerateCount: number; totalGenerationTimes: number;
};

const DAY = 86_400_000;
export function koreaDay(time: number): number {
  return Math.floor((time + 9 * 3_600_000) / DAY);
}
export function koreaWeek(time: number): number {
  const day = koreaDay(time);
  return day - (day + 3) % 7; // Monday, Korea time
}
export function dayLabel(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}
export function calculateMetrics(events: MonitoringEvent[], details: UserDetails[], now: number, days = 14) {
  const today = koreaDay(now);
  const valid = events.filter((event) => event.uid && Number.isFinite(event.createdAt) && event.createdAt <= now);
  const inPeriod = valid.filter((event) => koreaDay(event.createdAt) >= today - days + 1);
  const activeTypes = new Set(["generation_start", "generation_complete", "generation_fail", "generation_cancel"]);
  const activeCount = (period: number) => new Set(valid.filter((event) => koreaDay(event.createdAt) >= today - period + 1 && activeTypes.has(event.type)).map((event) => event.uid)).size;
  const visits = inPeriod.filter((event) => event.type === "visit");
  const visitors = new Set(visits.map((event) => event.uid));
  const starts = new Set<string>();
  const completions = new Set<string>();
  const returns = new Set<string>();
  // Ordered, unique-user funnel. Later stages must follow the preceding stage.
  const stage = new Map<string, { visit: number; start?: number; complete?: number }>();
  for (const event of [...inPeriod].sort((a, b) => a.createdAt - b.createdAt)) {
    if (event.type === "visit" && !stage.has(event.uid)) stage.set(event.uid, { visit: event.createdAt });
    const user = stage.get(event.uid);
    if (!user) continue;
    if (event.type === "generation_start" && user.start === undefined) {
      user.start = event.createdAt;
      starts.add(event.uid);
    }
    if (event.type === "generation_complete" && user.start !== undefined && user.complete === undefined) {
      user.complete = event.createdAt;
      completions.add(event.uid);
    }
    if (event.type === "visit" && user.complete !== undefined && koreaDay(event.createdAt) > koreaDay(user.complete)) returns.add(event.uid);
  }
  const terminal = inPeriod.filter((event) => ["generation_complete", "generation_fail", "generation_cancel"].includes(event.type));
  const completeCount = terminal.filter((event) => event.type === "generation_complete").length;
  const failCount = terminal.filter((event) => event.type === "generation_fail").length;
  const cancelCount = terminal.filter((event) => event.type === "generation_cancel").length;
  const returningVisitors = new Set(visits.filter((event) => {
    const first = details.find((detail) => detail.uid === event.uid)?.firstVisitAt;
    return first != null && koreaDay(event.createdAt) > koreaDay(first);
  }).map((event) => event.uid));
  const daily = Array.from({ length: days }, (_, index) => {
    const day = today - days + 1 + index;
    const rows = inPeriod.filter((event) => koreaDay(event.createdAt) === day);
    return { date: dayLabel(day).slice(5), visitors: new Set(rows.filter((event) => event.type === "visit").map((event) => event.uid)).size, active: new Set(rows.filter((event) => activeTypes.has(event.type)).map((event) => event.uid)).size, complete: rows.filter((event) => event.type === "generation_complete").length };
  });
  const visitWeeks = new Map<string, Set<number>>();
  for (const event of valid.filter((event) => event.type === "visit")) {
    if (!visitWeeks.has(event.uid)) visitWeeks.set(event.uid, new Set());
    visitWeeks.get(event.uid)!.add(koreaWeek(event.createdAt));
  }
  const currentWeek = koreaWeek(now);
  const cohorts = Array.from({ length: 7 }, (_, index) => {
    const week = currentWeek - (6 - index) * 7;
    const users = details.filter((detail) => detail.firstVisitAt != null && koreaWeek(detail.firstVisitAt) === week);
    return { week: dayLabel(week), size: users.length, retention: Array.from({ length: 5 }, (_, offset) => {
      if (!users.length || week + offset * 7 >= currentWeek) return null;
      const count = offset === 0 ? users.length : users.filter((user) => visitWeeks.get(user.uid)?.has(week + offset * 7)).length;
      return { count, rate: count / users.length * 100 };
    }) };
  });
  const observed = cohorts.filter((cohort) => cohort.retention[1] !== null);
  const eligible = observed.reduce((sum, cohort) => sum + cohort.size, 0);
  const retained = observed.reduce((sum, cohort) => sum + cohort.retention[1]!.count, 0);
  const funnel = [{ label: "방문", count: visitors.size }, { label: "생성 시작", count: starts.size }, { label: "생성 완료", count: completions.size }, { label: "완료 후 재방문", count: returns.size }].map((item, index, all) => ({ ...item, dropRate: index === 0 || all[index - 1].count === 0 ? null : (1 - item.count / all[index - 1].count) * 100 }));
  const biggestDrop = funnel.slice(1).filter((item) => item.dropRate !== null).sort((a, b) => b.dropRate! - a.dropRate!)[0] ?? null;
  const previous = valid.filter((event) => koreaDay(event.createdAt) >= today - days * 2 + 1 && koreaDay(event.createdAt) < today - days + 1);
  const previousCompleteUsers = new Set(previous.filter((event) => event.type === "generation_complete").map((event) => event.uid)).size;
  return { dau: activeCount(1), wau: activeCount(7), mau: activeCount(30), daily, cohorts, funnel, biggestDrop, completeCount, failCount, cancelCount,
    successRate: completeCount + failCount ? completeCount / (completeCount + failCount) * 100 : null,
    returnRate: visitors.size ? returningVisitors.size / visitors.size * 100 : null,
    weekRetention: eligible ? retained / eligible * 100 : null, eligible, retained,
    completeUsers: new Set(inPeriod.filter((event) => event.type === "generation_complete").map((event) => event.uid)).size,
    previousCompleteUsers,
  };
}
