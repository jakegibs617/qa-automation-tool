# Design Patterns And First-Principles Audit

Date: 2026-07-02

Scope: `backend/`, `frontend/`, and the recorder extension, reviewed through first-principles object-oriented design and the pattern vocabulary from *Design Patterns: Elements of Reusable Object-Oriented Software*.

## Executive Summary

The project has a solid MVP architecture: NestJS modules separate projects, test definitions, test runs, artifacts, and AI settings; the frontend has a clear API facade; and run execution is correctly moved off the request path through a queue/worker boundary. The main design risk is not missing patterns. It is responsibility drift: several classes and page components are starting to own orchestration, domain policy, provider branching, persistence details, and presentation workflow at the same time.

The highest-value next design move is to make the central domain concepts explicit:

- A `TestRunLifecycle` or run orchestration policy for valid run transitions.
- A `StepHandler` registry for browser actions/assertions.
- An `AiProviderAdapter` strategy boundary for Anthropic and Ollama.
- A shared recorder selector module to remove duplicated target extraction.
- Frontend hooks or feature modules that separate dashboard workflow state from rendering.

These are not recommended for pattern ceremony. They are recommended because the current forces are visible: more run states, more step types, more AI providers, more artifact storage backends, and more recorder behavior will otherwise keep adding conditionals to already-central files.

## First-Principles Model

The stable domain concepts are:

- **Project:** A named site under test with a base URL.
- **TestDefinition:** A reusable browser scenario with a start URL and ordered steps.
- **TestRun:** One execution attempt of a definition, with lifecycle status, logs, timing, and failure details.
- **Artifact:** Durable output from a run such as reports, screenshots, traces, and eventually video.
- **AI generation:** A convenience workflow that proposes a `TestDefinition`; it should not own the test-step domain.
- **Recorder:** An input adapter that turns browser actions into the same `TestStep` language used by generated and manually authored tests.

The core invariant is that all input paths eventually produce valid `TestStep` objects, and the runner executes those steps with observable outcomes. That means `TestStep` validation, dispatch, recording conversion, AI output validation, and frontend editing are all part of one conceptual language. Today that language exists, but it is spread across backend DTOs, frontend types, AI schema, recorder conversion, and Playwright dispatch.

## Patterns Already Serving The Design

### Facade

`frontend/lib/api.ts` provides a clean client-side API facade over backend routes. Components call named methods such as `listProjects`, `createTestDefinition`, `runTestDefinition`, and `fetchArtifactText` instead of manually assembling every request. See `frontend/lib/api.ts:121` and `frontend/lib/api.ts:154`.

This is a good use of Facade: it hides HTTP mechanics and gives the UI a product vocabulary.

### Repository

Nest services use TypeORM repositories directly, for example `ProjectsService` creates and saves `Project` entities through `Repository<Project>`, and `TestRunsService` injects repositories for runs, definitions, and artifacts. See `backend/src/test-runs/test-runs.service.ts:22`.

This is acceptable for the current size. The repository pattern is already provided by TypeORM, so adding custom repository classes everywhere would likely be speculative generality right now.

### Adapter / Gateway

`ArtifactStorageService` adapts local filesystem storage behind `write`, `read`, `exists`, and `createReadStream`. See `backend/src/artifacts/artifact-storage.service.ts:13`.

`RunQueueService` similarly wraps BullMQ queue access behind `enqueue` and `getRunJobState`. See `backend/src/test-runs/run-queue.service.ts:15`.

These are useful boundaries because storage and queue technologies are plausible future variation points.

### Worker / Command Boundary

The queue job carries only `{ runId }`, and the worker reloads state from the database. See `backend/src/test-runs/run-queue.ts` and `backend/src/test-runs/run-worker.service.ts:37`.

This is close to a Command pattern: the queued run is a durable instruction to execute an action later. The design keeps HTTP responsive and gives run execution a recovery boundary.

## Main Findings

### 1. `TestRunsService` Is Becoming An Orchestration God Object

Evidence: `TestRunsService` creates queued runs, handles enqueue failure, transitions runs to running, loads definitions, invokes Playwright, normalizes runner crashes, builds reports, persists run state, writes artifacts, reconciles pending runs, handles worker interruption, and performs query reads in one service. See `backend/src/test-runs/test-runs.service.ts:38`, `backend/src/test-runs/test-runs.service.ts:79`, `backend/src/test-runs/test-runs.service.ts:147`, `backend/src/test-runs/test-runs.service.ts:174`, and `backend/src/test-runs/test-runs.service.ts:236`.

First-principles force: a run lifecycle is a domain workflow with states, side effects, and recovery. It is more stable than Playwright, BullMQ, or local artifact storage.

Pattern fit: introduce a small Application Service plus focused collaborators:

- `RunLifecycleService` or `RunStateMachine` for valid transitions and terminal-state rules.
- `RunExecutionCoordinator` for load definition -> run browser -> persist outcome.
- `RunArtifactWriter` for report/screenshot/trace persistence.

Anti-pattern risk: God Object and Shotgun Surgery. Adding cancellation, retry, video, parallelism, or richer reports will keep editing the same class.

Recommended first step: extract `writeRunArtifacts` and `saveArtifact` into `RunArtifactWriter` because they already form a cohesive responsibility and have clear inputs.

### 2. Step Execution Is A Switch Statement Waiting For Polymorphism

Evidence: `validateTestStep` switches over every step type to enforce required fields, and `StepDispatcherService.dispatch` switches over every step type to run Playwright behavior. See `backend/src/test-definitions/dto/test-step.dto.ts:41` and `backend/src/test-runs/step-dispatcher.service.ts:41`.

First-principles force: step type is the axis of variation. Every new browser action or assertion likely requires validation, AI schema, recorder conversion, frontend typing, and dispatch behavior.

Pattern fit: Strategy or Command. A `StepHandler` interface can own validation metadata, dispatch behavior, and log formatting per step type:

```ts
interface StepHandler<TStep extends TestStepDto = TestStepDto> {
  type: TStep['type'];
  validate(value: unknown): value is TStep;
  dispatch(page: Page, step: TStep, ctx: StepContext): Promise<StepDispatchResult>;
}
```

This does not need to be a large hierarchy. A registry map from `type` to handler functions would be enough.

Anti-pattern risk: Switch Statement, Shotgun Surgery, and Primitive Obsession. The current shape is fine for nine step types, but the cost rises linearly with every new type.

Recommended first step: do not rewrite the whole step system yet. Extract a table-driven map for required fields and dispatcher functions, then let it grow into handlers if more step types arrive.

### 3. AI Provider Selection Wants Strategy, Not Branching Inside The Generator

Evidence: `AiTestGenerationService` holds prompt/schema concerns, provider selection, Anthropic API calls, Ollama HTTP calls, output parsing, base URL scoping, and connection testing. Provider branching happens in `generateWithSettings`, and each provider has a private method. See `backend/src/ai/ai-test-generation.service.ts:119`, `backend/src/ai/ai-test-generation.service.ts:144`, and `backend/src/ai/ai-test-generation.service.ts:183`.

First-principles force: the stable behavior is "generate a structured test from prompt plus context." Provider transport, credential checks, response shape, and error mapping vary independently.

Pattern fit: Strategy / Adapter. Define an `AiProviderAdapter` with `supports(provider)`, `isConfigured(settings)`, and `generate(prompt, settings)`. Keep `AiTestGenerationService` responsible for orchestration and shared validation.

Anti-pattern risk: Golden Hammer is not the issue; the code is practical. The risk is Open/Closed friction. Adding OpenAI, Gemini, or another local provider will expand the conditional branch and test matrix in a single file.

Recommended first step: extract provider adapters only when the third provider appears or when Anthropic/Ollama tests become cumbersome. Until then, extract common response parsing only if tests show duplication pressure.

### 4. Selector Extraction Is Duplicated Across Recorder Runtime And Shared Core

Evidence: `targetFromElement`, `attr`, `visibleText`, `explicitOrInferredRole`, `cssSelector`, and `cssEscape` appear in both `frontend/recorder-extension/recorder-core.js` and `frontend/recorder-extension/content-script.js`. See `frontend/recorder-extension/recorder-core.js:79` and `frontend/recorder-extension/content-script.js:85`.

First-principles force: selector priority is a central recorder policy. It must stay consistent between capture, conversion, tests, and eventual selector healing.

Pattern fit: Extract Module / Strategy. A shared `selector-policy.js` module can own selector extraction and ranking. If selector healing appears later, promote it to a Strategy boundary.

Anti-pattern risk: Duplicated Code and Divergent Change. A bug fix to role inference or CSS fallback can easily land in one copy but not the other.

Recommended first step: move DOM-safe selector helpers into a shared extension module imported by `content-script.js` and `recorder-core.js`. Keep the module plain JavaScript so the Chrome extension can load it without build tooling.

### 5. Frontend Page Components Own Too Much Workflow State

Evidence: `frontend/app/page.tsx` owns project loading, AI settings loading, project detail loading, run polling, run creation, tutorial state, filtering, and child forms in one file. The top-level component has many independent state variables and effects. See `frontend/app/page.tsx:51`, `frontend/app/page.tsx:81`, `frontend/app/page.tsx:96`, `frontend/app/page.tsx:109`, and `frontend/app/page.tsx:147`.

`AiSettingsPanel` and `TestDefinitionForm` also combine form state, API calls, payload shaping, and UI rendering. See `frontend/app/page.tsx:380` and `frontend/app/page.tsx:681`.

First-principles force: "dashboard data workflow" and "dashboard rendering" change for different reasons. Polling behavior, API error handling, and form submission rules are application logic, not display logic.

Pattern fit: Facade at the hook level. Extract hooks such as `useProjectsDashboard`, `useRunPolling`, `useAiSettingsForm`, and `useTestDefinitionForm`. This is not OO in class syntax, but it follows the same responsibility principles: cohesive modules with stable contracts.

Anti-pattern risk: Large Component and Shotgun Surgery. Adding scheduling, notifications, auth, or richer filtering will make `page.tsx` harder to reason about.

Recommended first step: extract `useProjectDetail(projectId)` and `useRunPolling(projectId, runs)` first, because those are cohesive and testable without changing UI markup.

### 6. Domain Types Are Repeated Across Backend, Frontend, AI Schema, And Recorder

Evidence: `TestStep` is defined in backend DTOs, frontend API types, AI output schema/prompt, recorder action conversion, and dispatch. See `backend/src/test-definitions/dto/test-step.dto.ts:7`, `frontend/lib/api.ts:9`, `backend/src/ai/ai-test-generation.service.ts:35`, and `frontend/recorder-extension/recorder-core.js:19`.

First-principles force: test steps are the product's shared language. Any mismatch is a product bug, not just a type bug.

Pattern fit: Shared Kernel. In a monorepo, consider a small shared package for test-step types, validation, and JSON schema generation. For now, centralize the backend source of truth and generate or mirror frontend types deliberately.

Anti-pattern risk: Stringly Typed Design and Parallel Inheritance-like Drift. Adding or changing one step type requires synchronized edits in many places.

Recommended first step: add a small checklist near `supportedStepTypes` documenting every required update site. A shared package is valuable once the step language changes again.

## Anti-Pattern Watchlist

- **God Object:** `TestRunsService` is the main candidate because it owns run lifecycle, execution, artifacts, recovery, and queries.
- **Switch Statement:** Step validation and dispatch both branch on `step.type`.
- **Duplicated Code:** Recorder selector helpers are copied between shared conversion and content-script capture.
- **Speculative Generality:** Avoid introducing full custom repositories or elaborate pattern hierarchies before there is variation pressure.
- **Anemic Domain Model:** Entities are currently persistence records with little behavior. That is acceptable for the MVP, but run lifecycle rules should not stay as scattered service assignments forever.
- **Stringly Typed Design:** Step types, statuses, artifact types, and provider names are string unions. TypeScript contains some risk, but runtime schema drift remains possible across frontend/backend/extension boundaries.

## Pattern Recommendations By Force

| Force | Current Shape | Recommended Pattern | Timing |
| --- | --- | --- | --- |
| Run state changes, recovery, cancellation, retry | Service-level assignments | State / Application Service | Soon |
| Browser step variation | Switch in dispatcher and validator | Command or Strategy registry | Before adding more step types |
| AI provider variation | Provider `if` branches | Strategy / Adapter | At third provider or test pain |
| Artifact backend variation | Local storage service | Adapter | Already good; keep interface stable |
| Queue technology variation | BullMQ wrapper | Adapter / Facade | Already good |
| Frontend dashboard workflow | Page-level state and effects | Hook facade / controller hook | Soon |
| Shared test-step schema | Repeated types/schema | Shared Kernel | When step language changes again |
| Recorder selector policy | Duplicated helpers | Extract Module, later Strategy | Soon |

## Prioritized Refactor Path

1. Extract recorder selector helpers into a shared module and update recorder smoke tests. This is low-risk and removes real duplication.
2. Extract `RunArtifactWriter` from `TestRunsService`. This reduces the central service without changing run behavior.
3. Extract frontend dashboard hooks for project detail loading and run polling. This improves clarity before adding scheduling or notifications.
4. Convert step dispatch to a table or handler registry. Do this before adding new action/assertion types.
5. Introduce AI provider adapters only when provider count or test complexity grows. Two branches are still readable; three usually justifies Strategy.
6. Consider a shared `test-step` package or generated schema once the step language needs another change.

## What To Avoid

- Do not add custom repositories for every entity just because Repository is a named pattern. TypeORM already provides that boundary.
- Do not replace every switch with classes immediately. A small dispatch table may deliver most of the benefit with less ceremony.
- Do not make entities rich domain objects until there are domain invariants worth protecting inside them. Start with run lifecycle and test-step validation, where the pressure is real.
- Do not treat GoF pattern names as goals. The goal is local clarity under expected change.

## Bottom Line

The project is on a healthy MVP path. The architecture already has useful Facade, Adapter, Repository, and Command-like boundaries. The next stage should focus on making the most volatile axes explicit: run lifecycle, step execution, provider generation, recorder selector policy, and frontend dashboard workflow. If those seams are introduced gradually, the codebase can absorb scheduling, notifications, auth, selector healing, and hosted-extension packaging without turning the current orchestration files into permanent gravity wells.
