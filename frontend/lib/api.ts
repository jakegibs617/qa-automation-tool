export type Project = {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type TestStep = {
  type:
    | 'goto'
    | 'click'
    | 'fill'
    | 'press'
    | 'select'
    | 'wait'
    | 'assertText'
    | 'assertVisible'
    | 'assertUrl';
  url?: string;
  selector?: string;
  value?: string;
  key?: string;
  timeoutMs?: number;
  text?: string;
};

export type TestDefinition = {
  id: string;
  projectId: string;
  name: string;
  startUrl: string;
  steps: TestStep[];
  createdAt: string;
  updatedAt: string;
};

export type TestRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'canceled';

export type ArtifactType = 'screenshot' | 'video' | 'trace' | 'log';

export type Artifact = {
  id: string;
  projectId: string;
  testRunId: string;
  type: ArtifactType;
  storageKey: string;
  contentType: string | null;
  sizeBytes: string | null;
  createdAt: string;
};

export type TestRun = {
  id: string;
  projectId: string;
  testDefinitionId: string;
  status: TestRunStatus;
  durationMs: number | null;
  failureStep: number | null;
  errorMessage: string | null;
  logs: string[];
  createdAt: string;
  testDefinition?: TestDefinition;
  artifacts?: Artifact[];
};

export type StepResult = {
  stepNumber: number;
  type: string;
  status: 'passed' | 'failed' | 'skipped';
  log: string;
  durationMs: number;
};

export type RunReport = {
  runId: string;
  projectId: string;
  testDefinitionId: string;
  testDefinitionName: string;
  status: TestRunStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  failureStep: number | null;
  errorMessage: string | null;
  steps: StepResult[];
  logs: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(extractErrorMessage(body) || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/** Pull the human-readable Nest error message out of a JSON error body. */
function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(', ');
    }
    if (typeof parsed.message === 'string') {
      return parsed.message;
    }
  } catch {
    // Not JSON — fall back to the raw body.
  }
  return body;
}

export const api = {
  listProjects: () => request<Project[]>('/projects'),
  createProject: (input: { name: string; baseUrl: string }) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listTestDefinitions: (projectId: string) =>
    request<TestDefinition[]>(`/projects/${projectId}/test-definitions`),
  createTestDefinition: (input: {
    projectId: string;
    name: string;
    startUrl: string;
    steps: TestStep[];
  }) =>
    request<TestDefinition>('/test-definitions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listRuns: (projectId: string) => request<TestRun[]>(`/projects/${projectId}/runs`),
  runTestDefinition: (testDefinitionId: string) =>
    request<TestRun>(`/test-definitions/${testDefinitionId}/runs`, {
      method: 'POST',
    }),
  generateSteps: (input: { prompt: string; startUrl?: string; baseUrl?: string }) =>
    request<{ name: string; startUrl: string; steps: TestStep[] }>(
      '/ai/generate-steps',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  getRun: (id: string) => request<TestRun>(`/test-runs/${id}`),
  listRunArtifacts: (testRunId: string) =>
    request<Artifact[]>(`/test-runs/${testRunId}/artifacts`),
  artifactContentUrl: (id: string) => `${API_URL}/artifacts/${id}/content`,
  fetchArtifactText: async (id: string) => {
    const response = await fetch(`${API_URL}/artifacts/${id}/content`);
    if (!response.ok) {
      throw new Error(`Failed to load artifact content (${response.status})`);
    }
    return response.text();
  },
};
