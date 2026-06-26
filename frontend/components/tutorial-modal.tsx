'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  FileSearch,
  FolderPlus,
  GraduationCap,
  ListChecks,
  PlayCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Live completion derived from the dashboard's loaded data. */
export type TutorialLiveProgress = {
  project: boolean;
  definition: boolean;
  run: boolean;
};

type Progress = TutorialLiveProgress & { viewedRun: boolean };

const STORAGE_KEY = 'qa-tutorial-progress';
/** Set by the run-detail page on mount; see app/runs/[runId]/page.tsx. */
export const TUTORIAL_VIEWED_RUN_KEY = 'qa-tutorial-viewed-run';

const EMPTY: Progress = {
  project: false,
  definition: false,
  run: false,
  viewedRun: false,
};

function readStored(): Progress {
  if (typeof window === 'undefined') {
    return EMPTY;
  }

  let stored: Progress = { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      stored = { ...stored, ...(JSON.parse(raw) as Partial<Progress>) };
    }
  } catch {
    // Corrupt/blocked storage — fall back to a clean slate.
  }

  if (window.localStorage.getItem(TUTORIAL_VIEWED_RUN_KEY)) {
    stored.viewedRun = true;
  }

  return stored;
}

/**
 * Tutorial steps. `target` is the `data-tutorial` value of the element the
 * walkthrough flashes for that step (see TutorialWalkthrough); `progressKey`
 * maps the step to its completion flag.
 */
export const STEP_META = [
  {
    progressKey: 'project' as const,
    target: 'create-project',
    icon: FolderPlus,
    title: 'Create a project',
    body: 'Add a project with the base URL of the site you want to test.',
  },
  {
    progressKey: 'definition' as const,
    target: 'add-definition',
    icon: ListChecks,
    title: 'Add a test definition',
    body: 'Give it a start URL and steps to run (goto, click, assertText, …).',
  },
  {
    progressKey: 'run' as const,
    target: 'run-test',
    icon: PlayCircle,
    title: 'Run a test',
    body: 'Trigger a run — it queues instantly and a worker executes it in the background.',
  },
  {
    progressKey: 'viewedRun' as const,
    target: 'view-results',
    icon: FileSearch,
    title: 'View results & artifacts',
    body: 'Open a run for live status, step logs, and downloadable screenshot/trace artifacts.',
  },
];

export type TutorialStep = (typeof STEP_META)[number];

export function TutorialModal({
  open,
  onClose,
  onStartWalkthrough,
  live,
}: {
  open: boolean;
  onClose: () => void;
  onStartWalkthrough: () => void;
  live: TutorialLiveProgress;
}) {
  const [progress, setProgress] = useState<Progress>(() => readStored());

  // Latch live progress (and the viewed-run flag) into persisted progress so a
  // completed step stays checked even after switching projects or reloading.
  useEffect(() => {
    setProgress((prev) => {
      const next: Progress = {
        project: prev.project || live.project,
        definition: prev.definition || live.definition,
        run: prev.run || live.run,
        viewedRun:
          prev.viewedRun ||
          (typeof window !== 'undefined' &&
            Boolean(window.localStorage.getItem(TUTORIAL_VIEWED_RUN_KEY))),
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Persistence is best-effort.
      }
      return next;
    });
  }, [live.project, live.definition, live.run, open]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const steps = STEP_META.map((meta) => ({
    ...meta,
    done: progress[meta.progressKey],
  }));
  const completed = steps.filter((step) => step.done).length;
  const allDone = completed === steps.length;
  const pct = Math.round((completed / steps.length) * 100);

  const resetProgress = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(TUTORIAL_VIEWED_RUN_KEY);
    } catch {
      // ignore
    }
    // Live conditions (e.g. an existing project) re-latch on the next effect run.
    setProgress({ ...EMPTY, ...live });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="tutorial-title" className="text-lg font-semibold leading-tight">
                Welcome to QA Automation
              </h2>
              <p className="text-sm text-muted-foreground">
                Four steps to your first verified run.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {allDone ? 'All steps complete 🎉' : `${completed} of ${steps.length} complete`}
            </span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <ol className="space-y-3 px-5 py-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.progressKey}
                className={cn(
                  'flex items-start gap-3 rounded-md border px-3 py-3 transition',
                  step.done
                    ? 'border-emerald-200 bg-emerald-50/60'
                    : 'border-border bg-panel',
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>
                      {index + 1}. {step.title}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={resetProgress}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Reset progress
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              {allDone ? 'Done' : 'Got it'}
            </button>
            <button
              type="button"
              onClick={onStartWalkthrough}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Show me how
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
