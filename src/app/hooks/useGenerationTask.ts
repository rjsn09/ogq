import { useCallback, useRef, useState } from 'react';
import { cancelGeneration, type StreamData } from '../../api/sse';

export function useGenerationTask() {
  const identity = useRef<StreamData>({});
  const version = useRef(0);
  const [total, setTotal] = useState(24);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [registered, setRegistered] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const begin = useCallback((count: number) => {
    const current = ++version.current;
    identity.current = {};
    setTotal(count);
    setElapsed(0);
    setRemaining(null);
    setRegistered(false);
    setCancelling(false);
    setCancelled(false);
    setCancelError(null);
    const onStatus = (data: StreamData) => {
      if (version.current !== current) return;
      if (typeof data.elapsed_seconds === 'number') setElapsed(data.elapsed_seconds);
      setRemaining(typeof data.remaining_seconds === 'number' ? data.remaining_seconds : null);
    };
    return {
      onStart: (data: StreamData) => {
        if (version.current !== current) return;
        identity.current = data;
        setRegistered(!!(data.job_id || data.canonical_id));
        onStatus(data);
      },
      onStatus,
    };
  }, []);

  const cancel = useCallback(async () => {
    const current = version.current;
    const active = identity.current;
    setCancelling(true);
    setCancelError(null);
    try {
      const result = await cancelGeneration(active);
      if (version.current !== current) return false;
      const stopped = result.status === 'cancelled';
      setCancelled(stopped);
      return stopped;
    } catch (error) {
      if (version.current === current) setCancelError(error instanceof Error ? error.message : '취소 요청에 실패했습니다.');
      return false;
    } finally {
      if (version.current === current) setCancelling(false);
    }
  }, []);

  return { begin, cancel, total, elapsed, remaining, registered, cancelling, cancelled, cancelError };
}
