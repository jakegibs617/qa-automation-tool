'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, TestDefinition, TestRun } from '@/lib/api';

export type DetailLoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Owns the selected project's detail workflow: loading test definitions and
 * run history together, tracking load state, and clearing both lists when no
 * project is selected. Rendering stays in the page component.
 *
 * `onMessage` must be referentially stable (e.g. a useState setter); an inline
 * arrow would re-create `reload` every render and refetch in a loop.
 */
export function useProjectDetail(
  projectId: string | null,
  onMessage: (message: string | null) => void,
) {
  const [definitions, setDefinitions] = useState<TestDefinition[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [detailState, setDetailState] = useState<DetailLoadState>('idle');

  const reload = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setDetailState('loading');
    onMessage(null);

    try {
      const [definitionResult, runResult] = await Promise.all([
        api.listTestDefinitions(projectId),
        api.listRuns(projectId),
      ]);
      setDefinitions(definitionResult);
      setRuns(runResult);
      setDetailState('ready');
    } catch (error) {
      setDetailState('error');
      onMessage(error instanceof Error ? error.message : 'Unable to load project detail');
    }
  }, [projectId, onMessage]);

  useEffect(() => {
    if (projectId) {
      void reload();
    } else {
      setDefinitions([]);
      setRuns([]);
    }
  }, [projectId, reload]);

  return { definitions, runs, setRuns, detailState, reload };
}
