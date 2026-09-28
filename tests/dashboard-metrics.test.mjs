import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMetrics, koreaDay, koreaWeek, dayLabel } from '../src/app/lib/dashboardMetrics.ts';

const date = (value) => Date.parse(value + '+09:00');
const event = (uid, type, day, hour = '12:00:00') => ({ id: `${uid}-${type}-${day}`, uid, type, sessionId: 'session', createdAt: date(`${day}T${hour}`) });
const user = (uid, first) => ({ uid, firstVisitAt: date(`${first}T12:00:00`), lastVisitAt: null, visitCount: 0, generationStartCount: 0, generationCompleteCount: 0, generationFailCount: 0, regenerateCount: 0, totalGenerationTimes: 0 });

test('Korea midnight and Monday determine reporting periods', () => {
  assert.equal(koreaDay(date('2026-09-28T00:00:00')) - koreaDay(date('2026-09-27T23:59:59')), 1);
  assert.equal(dayLabel(koreaWeek(date('2026-09-27T23:59:59'))), '2026-09-21');
  assert.equal(dayLabel(koreaWeek(date('2026-09-28T00:00:00'))), '2026-09-28');
});

test('funnel deduplicates users and requires completion before a later-day return', () => {
  const rows = [event('a', 'visit', '2026-09-21', '09:00:00'), event('a', 'generation_start', '2026-09-21', '10:00:00'), event('a', 'generation_complete', '2026-09-21', '11:00:00'), event('a', 'visit', '2026-09-21'), event('a', 'visit', '2026-09-22'), event('a', 'return_visit', '2026-09-22'), event('b', 'visit', '2026-09-21'), event('b', 'generation_complete', '2026-09-20'), event('b', 'visit', '2026-09-22'), event('c', 'generation_start', '2026-09-22')];
  const result = calculateMetrics(rows, [user('a', '2026-09-21'), user('b', '2026-09-21')], date('2026-09-28T12:00:00'), 14);
  assert.deepEqual(result.funnel.map((stage) => stage.count), [2, 1, 1, 1]);
  assert.equal(result.biggestDrop.label, '생성 시작');
  assert.equal(result.biggestDrop.dropRate, 50);
  assert.equal(result.returnRate, 100);
});

test('cohorts only include mature weeks in next-week retention', () => {
  const details = [user('a', '2026-09-14'), user('b', '2026-09-14'), user('c', '2026-09-21')];
  const rows = [event('a', 'visit', '2026-09-14'), event('b', 'visit', '2026-09-14'), event('a', 'visit', '2026-09-22'), event('c', 'visit', '2026-09-21')];
  const result = calculateMetrics(rows, details, date('2026-09-28T12:00:00'));
  assert.equal(result.weekRetention, 50);
  assert.equal(result.eligible, 2);
  assert.equal(result.cohorts.find((cohort) => cohort.week === '2026-09-21').retention[1], null);
});

test('active users exclude visitors and future events; success rate excludes cancels', () => {
  const rows = [event('a', 'visit', '2026-09-28'), event('b', 'generation_start', '2026-09-28'), event('b', 'generation_complete', '2026-09-28'), event('c', 'generation_fail', '2026-09-28'), event('d', 'generation_cancel', '2026-09-28'), event('future', 'generation_complete', '2026-09-29')];
  const result = calculateMetrics(rows, [], date('2026-09-28T13:00:00'));
  assert.equal(result.dau, 3);
  assert.equal(result.successRate, 50);
  assert.equal(result.cancelCount, 1);
  assert.equal(result.completeUsers, 1);
});

test('empty data has no invented conversion or retention', () => {
  const result = calculateMetrics([], [], date('2026-09-28T13:00:00'));
  assert.equal(result.weekRetention, null);
  assert.equal(result.successRate, null);
  assert.equal(result.returnRate, null);
  assert.equal(result.dau, 0);
});
