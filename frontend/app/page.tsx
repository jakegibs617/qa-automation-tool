'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  Boxes,
  Check,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileJson,
  Gauge,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { api, Project, TestDefinition, TestRun, TestStep } from '@/lib/api';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

const starterSteps = JSON.stringify(
  [
    { type: 'goto', url: '/' },
    { type: 'assertText', selector: 'body', text: 'Dashboard' },
  ],
  null,
  2,
);

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<TestDefinition[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [detailState, setDetailState] = useState<LoadState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [runningDefinitionId, setRunningDefinitionId] = useState<string | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return projects;
    }

    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(needle) ||
        project.baseUrl.toLowerCase().includes(needle),
    );
  }, [projects, query]);

  async function loadProjects() {
    setLoadState('loading');
    setMessage(null);

    try {
      const result = await api.listProjects();
      setProjects(result);
      setSelectedProjectId((current) => current ?? result[0]?.id ?? null);
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to load projects');
    }
  }

  async function loadProjectDetail(projectId: string) {
    setDetailState('loading');
    setMessage(null);

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
      setMessage(error instanceof Error ? error.message : 'Unable to load project detail');
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      void loadProjectDetail(selectedProjectId);
    } else {
      setDefinitions([]);
      setRuns([]);
    }
  }, [selectedProjectId]);

  // While any run is queued or running, silently refresh the run list so the
  // history and latest-status reflect the background worker's progress.
  const hasPendingRun = runs.some(
    (run) => run.status === 'queued' || run.status === 'running',
  );

  useEffect(() => {
    if (!selectedProjectId || !hasPendingRun) {
      return;
    }

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const runResult = await api.listRuns(selectedProjectId);
        if (!cancelled) {
          setRuns(runResult);
        }
      } catch {
        // Transient refresh failures are ignored; the next tick retries.
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedProjectId, hasPendingRun]);

  async function handleRun(testDefinitionId: string) {
    setRunningDefinitionId(testDefinitionId);
    setMessage(null);

    try {
      await api.runTestDefinition(testDefinitionId);
      if (selectedProjectId) {
        await loadProjectDetail(selectedProjectId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start test run');
    } finally {
      setRunningDefinitionId(null);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-border bg-panel lg:sticky lg:top-0 lg:h-screen lg:w-[340px] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Gauge className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">QA Automation</h1>
                  <p className="text-sm text-muted-foreground">Test operations shell</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <ProjectForm
                onCreated={async (project) => {
                  await loadProjects();
                  setSelectedProjectId(project.id);
                }}
                onMessage={setMessage}
              />

              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <span className="sr-only">Search projects</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
                  placeholder="Search projects"
                />
              </label>
            </div>

            <nav className="min-h-0 flex-1 overflow-auto px-3 pb-4">
              {loadState === 'loading' ? (
                <LoadingRows />
              ) : filteredProjects.length > 0 ? (
                <div className="space-y-1">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-3 py-3 text-left transition',
                        selectedProjectId === project.id
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{project.name}</span>
                        <span className="block truncate text-xs">{project.baseUrl}</span>
                      </span>
                      <ChevronRight className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Boxes}
                  title="No projects"
                  body="Create a project to start organizing browser checks."
                />
              )}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="border-b border-border bg-panel px-5 py-4 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current project</p>
                <h2 className="text-2xl font-semibold tracking-normal">
                  {selectedProject?.name ?? 'No project selected'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {selectedProject ? (
                  <a
                    href={selectedProject.baseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Base URL
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => selectedProjectId && loadProjectDetail(selectedProjectId)}
                  disabled={!selectedProjectId || detailState === 'loading'}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw
                    className={cn('h-4 w-4', detailState === 'loading' && 'animate-spin')}
                    aria-hidden="true"
                  />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {message ? (
            <div className="mx-5 mt-5 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:mx-8">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{message}</span>
            </div>
          ) : null}

          {selectedProject ? (
            <div className="grid min-w-0 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8">
              <div className="min-w-0 space-y-5">
                <StatsStrip
                  definitions={definitions}
                  runs={runs}
                  isLoading={detailState === 'loading'}
                />
                <DefinitionList
                  definitions={definitions}
                  runs={runs}
                  isLoading={detailState === 'loading'}
                  runningDefinitionId={runningDefinitionId}
                  onRun={handleRun}
                />
                <RunHistory runs={runs} isLoading={detailState === 'loading'} />
              </div>

              <div className="min-w-0 space-y-5">
                <TestDefinitionForm
                  project={selectedProject}
                  onCreated={() => loadProjectDetail(selectedProject.id)}
                  onMessage={setMessage}
                />
                <ProjectSummary project={selectedProject} />
              </div>
            </div>
          ) : (
            <div className="p-5 lg:p-8">
              <EmptyState
                icon={ClipboardList}
                title="Create or select a project"
                body="The shell is ready for project, test definition, and run workflows."
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ProjectForm({
  onCreated,
  onMessage,
}: {
  onCreated: (project: Project) => void | Promise<void>;
  onMessage: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    onMessage(null);

    try {
      const project = await api.createProject({ name, baseUrl });
      setName('');
      setBaseUrl('');
      await onCreated(project);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Unable to create project');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-background p-3 shadow-panel">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Plus className="h-4 w-4" aria-hidden="true" />
        New project
      </div>
      <div className="space-y-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-panel px-3 text-sm"
          placeholder="Project name"
          required
        />
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-panel px-3 text-sm"
          placeholder="https://example.com"
          type="url"
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Create
        </button>
      </div>
    </form>
  );
}

function TestDefinitionForm({
  project,
  onCreated,
  onMessage,
}: {
  project: Project;
  onCreated: () => void | Promise<void>;
  onMessage: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [startUrl, setStartUrl] = useState('/');
  const [steps, setSteps] = useState(starterSteps);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    onMessage(null);

    try {
      const parsedSteps = JSON.parse(steps) as TestStep[];
      if (!Array.isArray(parsedSteps)) {
        throw new Error('Steps JSON must be an array');
      }

      await api.createTestDefinition({
        projectId: project.id,
        name,
        startUrl,
        steps: parsedSteps,
      });
      setName('');
      setStartUrl('/');
      setSteps(starterSteps);
      await onCreated();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Unable to create test definition');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center gap-2">
        <FileJson className="h-4 w-4 text-accent" aria-hidden="true" />
        <h3 className="text-sm font-semibold">New test definition</h3>
      </div>
      <div className="space-y-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          placeholder="Homepage smoke test"
          required
        />
        <input
          value={startUrl}
          onChange={(event) => setStartUrl(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          placeholder="/"
          required
        />
        <textarea
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          className="min-h-[210px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-5"
          spellCheck={false}
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Save definition
        </button>
      </div>
    </form>
  );
}

function StatsStrip({
  definitions,
  runs,
  isLoading,
}: {
  definitions: TestDefinition[];
  runs: TestRun[];
  isLoading: boolean;
}) {
  const latestRun = runs[0];
  const passCount = runs.filter((run) => run.status === 'passed').length;
  const passRate = runs.length > 0 ? Math.round((passCount / runs.length) * 100) : 0;

  const stats = [
    { label: 'Definitions', value: definitions.length.toString(), icon: ClipboardList },
    { label: 'Runs', value: runs.length.toString(), icon: Activity },
    { label: 'Pass rate', value: `${passRate}%`, icon: Check },
    {
      label: 'Latest',
      value: latestRun ? latestRun.status : 'None',
      icon: Gauge,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-md border border-border bg-panel p-4 shadow-panel">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <stat.icon className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-normal">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function DefinitionList({
  definitions,
  runs,
  isLoading,
  runningDefinitionId,
  onRun,
}: {
  definitions: TestDefinition[];
  runs: TestRun[];
  isLoading: boolean;
  runningDefinitionId: string | null;
  onRun: (testDefinitionId: string) => void;
}) {
  const latestRunByDefinition = useMemo(() => {
    const byDefinition = new Map<string, TestRun>();
    for (const run of runs) {
      if (!byDefinition.has(run.testDefinitionId)) {
        byDefinition.set(run.testDefinitionId, run);
      }
    }
    return byDefinition;
  }, [runs]);

  return (
    <section className="min-w-0 rounded-md border border-border bg-panel shadow-panel">
      <SectionHeader icon={ClipboardList} title="Test definitions" />
      {isLoading ? (
        <TableLoading />
      ) : definitions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/70 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold">Name</th>
                <th className="px-3 py-3 font-semibold">Start URL</th>
                <th className="px-3 py-3 font-semibold">Steps</th>
                <th className="px-3 py-3 font-semibold">Latest run</th>
                <th className="px-3 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {definitions.map((definition) => {
                const latestRun = latestRunByDefinition.get(definition.id);
                const isRunning = runningDefinitionId === definition.id;

                return (
                  <tr key={definition.id}>
                    <td className="px-3 py-3 font-medium">{definition.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{definition.startUrl}</td>
                    <td className="px-3 py-3 text-muted-foreground">{definition.steps.length}</td>
                    <td className="px-3 py-3">
                      {latestRun ? <StatusBadge status={latestRun.status} /> : <span className="text-muted-foreground">None</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onRun(definition.id)}
                        disabled={isRunning}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Run
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={FileJson}
          title="No test definitions"
          body="Add a JSON definition from the side panel."
        />
      )}
    </section>
  );
}

function RunHistory({ runs, isLoading }: { runs: TestRun[]; isLoading: boolean }) {
  return (
    <section className="min-w-0 rounded-md border border-border bg-panel shadow-panel">
      <SectionHeader icon={Activity} title="Run history" />
      {isLoading ? (
        <TableLoading />
      ) : runs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/70 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Definition</th>
                <th className="px-3 py-3 font-semibold">Duration</th>
                <th className="px-3 py-3 font-semibold">Failure</th>
                <th className="px-3 py-3 font-semibold">Created</th>
                <th className="px-3 py-3 text-right font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id} className="transition hover:bg-muted/50">
                  <td className="px-3 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-3 py-3 font-medium">
                    {run.testDefinition?.name ?? shortId(run.testDefinitionId)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {run.durationMs === null ? '-' : `${run.durationMs} ms`}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {run.failureStep === null ? '-' : run.failureStep}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(run.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/runs/${run.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
                    >
                      View
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="No runs yet"
          body="Run a definition to populate execution history."
        />
      )}
    </section>
  );
}

function ProjectSummary({ project }: { project: Project }) {
  return (
    <section className="rounded-md border border-border bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center gap-2">
        <Boxes className="h-4 w-4 text-accent" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Project detail</h3>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Project ID</dt>
          <dd className="mt-1 break-all font-mono text-xs">{project.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Base URL</dt>
          <dd className="mt-1 break-all">{project.baseUrl}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="mt-1">{formatDate(project.createdAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Activity; title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ClipboardList;
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center rounded-md px-4 py-8 text-center">
      <Icon className="mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-[320px] text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2 px-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function TableLoading() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
