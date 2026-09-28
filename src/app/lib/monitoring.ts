import { collection, doc, increment, runTransaction, serverTimestamp, type DocumentData } from "firebase/firestore";
import { db } from "../firebase/config";

let sessionId: string | undefined;
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem("monitoringSessionId") ?? crypto.randomUUID();
    sessionStorage.setItem("monitoringSessionId", sessionId);
  } catch {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

type EventType = "visit" | "generation_start" | "generation_complete" | "generation_fail" | "generation_cancel";

async function record(uid: string, type: EventType, options: { regenerate?: boolean; durationMs?: number } = {}): Promise<void> {
  try {
    const session = getSessionId();
    const detailsRef = doc(db, "user_details", uid);
    // A visit is counted once per signed-in user and tab session, including reloads.
    const eventRef = type === "visit"
      ? doc(db, "events", `visit_${uid}_${session}`)
      : doc(collection(db, "events"));
    await runTransaction(db, async (transaction) => {
      const details = await transaction.get(detailsRef);
      if (type === "visit" && (await transaction.get(eventRef)).exists()) return;
      const existing = details.data() ?? {};
      const update: DocumentData = {};
      for (const field of ["visitCount", "generationStartCount", "generationCompleteCount", "generationFailCount", "regenerateCount", "totalGenerationTimes"]) {
        if (existing[field] == null) update[field] = 0;
      }
      if (type === "visit") {
        update.visitCount = increment(1);
        update.lastVisitAt = serverTimestamp();
        if (!existing.firstVisitAt) update.firstVisitAt = serverTimestamp();
      } else if (type === "generation_start") {
        update.generationStartCount = increment(1);
        update.lastGenerationAt = serverTimestamp();
        if (!existing.firstGenerationAt) update.firstGenerationAt = serverTimestamp();
        if (options.regenerate) update.regenerateCount = increment(1);
      } else {
        if (type === "generation_complete") update.generationCompleteCount = increment(1);
        if (type === "generation_fail") update.generationFailCount = increment(1);
        update.totalGenerationTimes = increment(options.durationMs ?? 0);
      }
      transaction.set(detailsRef, update, { merge: true });
      transaction.set(eventRef, { uid, sessionId: session, type, createdAt: serverTimestamp() });
    });
  } catch (error) {
    // Monitoring must not prevent login or image generation.
    console.error("모니터링 기록 실패:", error);
  }
}

export function recordVisit(uid: string): Promise<void> {
  return record(uid, "visit");
}

/** Counts each canonical/sticker API request; totalGenerationTimes is elapsed milliseconds. */
export async function monitorGeneration<T>(uid: string, regenerate: boolean, signal: AbortSignal, generate: () => Promise<T>): Promise<T> {
  await record(uid, "generation_start", { regenerate });
  const startedAt = performance.now();
  try {
    if (signal.aborted) throw new DOMException("Generation cancelled", "AbortError");
    const result = await generate();
    await record(uid, signal.aborted ? "generation_cancel" : "generation_complete", { durationMs: Math.round(performance.now() - startedAt) });
    return result;
  } catch (error) {
    await record(uid, signal.aborted ? "generation_cancel" : "generation_fail", { durationMs: Math.round(performance.now() - startedAt) });
    throw error;
  }
}
