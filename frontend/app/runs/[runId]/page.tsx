'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock3,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  OctagonAlert,
  Route,
  Terminal,
} from 'lucide-react';
import {
  api,
  Artifact,
  ArtifactType,
  RunReport,
  StepResult,
  TestRun,
} from '@/lib/api';
import { cn, formatBytes, formatDateTime, formatDuration } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

type LoadState = 'loading' | 'ready' | 'error';

const POLL_INTERVAL_MS = 1500;

const isPendingStatus = (status: TestRun['status']) =>
  status === 'queued' || status === 'running';

const artifactIcon: Record<ArtifactType, typeof FileText> = {
  log: FileText,
  screenshot: ImageIcon,
  trace: Route,
  video: Film,
};

const artifactLabel: Record<ArtifactType, string> = {
  log: 'Run report',
  screenshot: 'Failure screenshot',
  trace: 'Trace',
  video: 'Video',
};

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;

  const [run, setRun] = useState<TestRun | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [message, setMessage] = useState<string | null>(null);

  // Mark the tutorial's "view results & artifacts" step done on first visit.
  useEffect(() => {
    try {
      window.localStorage.setItem('qa-tutorial-viewed-run', '1');
    } catch {
      // Storage may be unavailable; the tutorial step simply stays unchecked.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(isInitial: boolean) {
      if (isInitial) {
        setLoadState('loading');
        setMessage(null);
      }

      try {
        const runResult = await api.getRun(runId);
        if (cancelled) {
          return;
        }
        setRun(runResult);

        const logArtifact = runResult.artifacts?.find((artifact) => artifact.type === 'log');
        if (logArtifact) {
          try {
            const text = await api.fetchArtifactText(logArtifact.id);
            if (!cancelled) {
              setReport(JSON.parse(text) as RunReport);
            }
          } catch {
            // Structured report is best-effort; the raw logs still render below.
          }
        }

        if (!cancelled) {
          setLoadState('ready');
        }

        // Keep polling while the run is still in flight so the UI reflects the
        // queued → running → passed/failed transitions the worker drives.
        if (!cancelled && isPendingStatus(runResult.status)) {
          timer = setTimeout(() => void load(false), POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadState('error');
          setMessage(error instanceof Error ? error.message : 'Unable to load run');
        }
      }
    }

    void load(true);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [runId]);

  const steps = report?.steps ?? [];
  const logs = report?.logs ?? run?.logs ?? [];
  const artifacts = run?.artifacts ?? [];

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8 lg:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>

        <header className="mt-4 flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Run detail</p>
            <h1 className="truncate text-2xl font-semibold">
              {run?.testDefinition?.name ?? report?.testDefinitionName ?? 'Test run'}
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{runId}</p>
          </div>
          {run ? <StatusBadge status={run.status} /> : null}
        </header>

        {message ? (
          <div className="mt-5 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="break-words">{message}</span>
          </div>
        ) : null}

        {loadState === 'loading' ? (
          <div className="mt-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        ) : run ? (
          <div className="mt-6 space-y-6">
            <MetaGrid run={run} />

            {run.errorMessage ? (
              <section className="rounded-md border border-red-300 bg-red-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
                  <OctagonAlert className="h-4 w-4" aria-hidden="true" />
                  {run.failureStep !== null
                    ? `Failed at step ${run.failureStep}`
                    : 'Run failed'}
                </div>
                <p className="break-words font-mono text-xs text-red-900">{run.errorMessage}</p>
              </section>
            ) : null}

            {steps.length > 0 ? <StepList steps={steps} /> : null}

            <Logs logs={logs} />

            <Artifacts artifacts={artifacts} />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function MetaGrid({ run }: { run: TestRun }) {
  const items = [
    { label: 'Status', value: run.status },
    { label: 'Duration', value: formatDuration(run.durationMs) },
    {
      label: 'Failure step',
      value: run.failureStep === null ? '-' : String(run.failureStep),
    },
    { label: 'Started', value: formatDateTime(run.createdAt) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border bg-panel p-4 shadow-panel">
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-lg font-semibold capitalize">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function StepList({ steps }: { steps: StepResult[] }) {
  return (
    <section className="rounded-md border border-border bg-panel shadow-panel">
      <SectionHeader icon={Clock3} title="Steps" />
      <ul className="divide-y divide-border">
        {steps.map((step) => {
          const failed = step.status === 'failed';
          return (
            <li key={step.stepNumber} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
                  failed
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-700',
                )}
              >
                {failed ? <OctagonAlert className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-sm">{step.log}</span>
                <span className="text-xs text-muted-foreground">{step.type}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDuration(step.durationMs)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Logs({ logs }: { logs: string[] }) {
  return (
    <section className="rounded-md border border-border bg-panel shadow-panel">
      <SectionHeader icon={Terminal} title="Logs" />
      {logs.length > 0 ? (
        <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-5 text-foreground">
          {logs.join('\n')}
        </pre>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No logs recorded.</p>
      )}
    </section>
  );
}

function Artifacts({ artifacts }: { artifacts: Artifact[] }) {
  return (
    <section className="rounded-md border border-border bg-panel shadow-panel">
      <SectionHeader icon={FileText} title="Artifacts" />
      {artifacts.length > 0 ? (
        <ul className="divide-y divide-border">
          {artifacts.map((artifact) => {
            const Icon = artifactIcon[artifact.type] ?? FileText;
            return (
              <li key={artifact.id} className="flex items-center gap-3 px-4 py-3">
                <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {artifactLabel[artifact.type] ?? artifact.type}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {artifact.contentType ?? 'unknown'} · {formatBytes(artifact.sizeBytes)}
                  </span>
                </span>
                <a
                  href={api.artifactContentUrl(artifact.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Open
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No artifacts for this run.
        </p>
      )}
    </section>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof FileText; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}
