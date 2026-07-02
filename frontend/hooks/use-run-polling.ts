'use client';

import { useEffect } from 'react';
import { api, TestRun } from '@/lib/api';

/**
 * While any run is queued or running, silently refreshes the run list so the
 * history and latest-status reflect the background worker's progress.
 */
export function useRunPolling(
  projectId: string | null,
  runs: TestRun[],
  onRunsLoaded: (runs: TestRun[]) => void,
  intervalMs = 1500,
) {
  const hasPendingRun = runs.some(
    (run) => run.status === 'queued' || run.status === 'running',
  );

  useEffect(() => {
    if (!projectId || !hasPendingRun) {
      return;
    }

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const runResult = await api.listRuns(projectId);
        if (!cancelled) {
          onRunsLoaded(runResult);
        }
      } catch {
        // Transient refresh failures are ignored; the next tick retries.
      }
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [projectId, hasPendingRun, intervalMs, onRunsLoaded]);
}
