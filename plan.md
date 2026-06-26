Use this as a project brief for an implementation agent.

---

# Active Priorities (next milestones)

These two are the current top priorities, to be delivered as separate milestones in order, toward a demoable MVP:

1. **AI Test Generation (Phase 4)** — replace the raw JSON "steps" field in the test-definition form with a natural-language **prompt**. Claude (`@anthropic-ai/sdk`, model `claude-opus-4-8`) converts the description into the existing structured step schema. Flow is **generate → review/edit**: the generated steps populate the form for the user to tweak before saving/running. Requires `ANTHROPIC_API_KEY` in the backend env; the endpoint must fail gracefully with a clear message when it is absent.
2. **Recorder (Phase 2)** — capture **discrete actions → resilient-selector steps** (clicks, inputs, navigation, selects) and convert them to the same JSON step schema (resilient-selector order: `data-testid` → `aria-label` → `role` → `text` → CSS). Built as the Chrome extension described in Phase 2 below. Mouse movement is used only to infer targets, not stored as a continuous recording.

The loop building these ends once both are merged and a coherent MVP demo is ready to test.

---

# Project: Open Source QA Automation

## Overview

The platform should allow users to:

* Record browser interactions
* Create automated tests without writing code
* Run tests manually or on schedules
* View screenshots, videos, logs, and traces
* Receive alerts on failures
* Use AI to generate, repair, and explain tests

This should be designed as a production-grade SaaS, but built incrementally with a strong MVP-first approach.

---

# Product Vision

The goal is to become:

> "The easiest way to create, run, monitor, and maintain browser tests."

Target users:

* QA Analysts
* Product Managers
* Developers
* Site Reliability Engineers
* Small businesses without dedicated QA teams

---

# Core Principles

1. Playwright should be the execution engine.
2. Tests should be represented as structured JSON.
3. The system must support both low-code and AI-generated workflows.
4. Every test run should generate debugging artifacts.
5. Architecture should support future multi-tenancy.

---

# Recommended Technology Stack

Frontend:

* Next.js
* TypeScript
* Tailwind
* shadcn/ui

Backend:

* NestJS or FastAPI
* TypeScript preferred if using NestJS

Database:

* PostgreSQL

Queue:

* Redis
* BullMQ

Storage:

* S3-compatible storage

Authentication:

* Clerk
* Or Supabase Auth

Test Execution:

* Playwright
* Dockerized workers

Deployment:

* Docker Compose for local development
* ECS/Fargate or Fly.io for production

---

# MVP Scope

## Feature 1: Projects

Users can create projects.

Project fields:

```json
{
  "id": "uuid",
  "name": "Marketing Site",
  "baseUrl": "https://example.com"
}
```

---

## Feature 2: Test Definitions

Tests are stored as JSON.

Example:

```json
{
  "id": "uuid",
  "name": "Homepage Smoke Test",
  "startUrl": "/",
  "steps": [
    {
      "type": "goto",
      "url": "/"
    },
    {
      "type": "click",
      "selector": "text=Login"
    },
    {
      "type": "fill",
      "selector": "#email",
      "value": "{{EMAIL}}"
    },
    {
      "type": "assertText",
      "selector": "body",
      "text": "Dashboard"
    }
  ]
}
```

Supported MVP step types:

* goto
* click
* fill
* press
* select
* wait
* assertText
* assertVisible
* assertUrl

---

## Feature 3: Test Runner

Build a Playwright execution service.

Responsibilities:

* Load test JSON
* Execute steps
* Capture failures
* Capture screenshots
* Capture videos
* Capture Playwright traces

Output:

```json
{
  "status": "failed",
  "duration": 5021,
  "failureStep": 4,
  "artifacts": {
    "screenshot": "...",
    "video": "...",
    "trace": "..."
  }
}
```

---

## Feature 4: Run History

Store all runs.

Run page should show:

* status
* duration
* timestamp
* screenshots
* video
* trace
* logs

---

## Feature 5: Scheduling

Allow tests to run:

* manually
* hourly
* daily
* weekly

Scheduler should enqueue jobs.

Workers execute jobs.

---

## Feature 6: Notifications

Slack webhook support.

Failure notification example:

```text
Homepage Smoke Test failed.

Project: Marketing Site
Environment: Production
Failed Step: Click Login
Duration: 5.2s

View Run
```

---

# Database Design

Create migrations for:

## organizations

```sql
id
name
created_at
```

## users

```sql
id
email
organization_id
```

## projects

```sql
id
organization_id
name
base_url
```

## tests

```sql
id
project_id
name
definition_json
```

## runs

```sql
id
test_id
status
duration_ms
started_at
completed_at
```

## artifacts

```sql
id
run_id
type
storage_path
```

---

# API Design

REST or GraphQL acceptable.

Required endpoints:

```text
POST   /projects
GET    /projects

POST   /tests
GET    /tests/:id

POST   /tests/:id/run

GET    /runs
GET    /runs/:id
```

---

# Phase 2: Recorder

Build Chrome extension.

Capture:

* clicks
* inputs
* navigation
* selects

Convert actions into test JSON.

Example:

User clicks Login

Output:

```json
{
  "type": "click",
  "selector": "text=Login"
}
```

Recorder should prioritize resilient selectors:

Order:

1. data-testid
2. aria-label
3. role
4. text
5. CSS selector

Avoid brittle XPath.

---

# Phase 3: Visual Regression

Store baseline screenshots.

For each run:

1. Capture screenshot
2. Compare against baseline
3. Generate diff image

Store:

```json
{
  "baseline": "...",
  "current": "...",
  "diff": "...",
  "similarity": 98.7
}
```

---

# Phase 4: AI Features

## AI Test Generation

Input:

```text
Verify a user can login and reach the dashboard.
```

Output:

```json
{
  "steps": [...]
}
```

---

## AI Failure Analysis

Input:

* run logs
* screenshot
* trace

Output:

```text
Login button not found.

Possible causes:
1. Text changed
2. Element hidden
3. Slow page load
```

---

## AI Selector Healing

When selector fails:

Current:

```json
{
  "selector": "text=Login"
}
```

AI attempts:

```json
{
  "selector": "[aria-label='Sign In']"
}
```

Require confidence scoring.

---

# Future Roadmap

* Multi-browser execution
* Mobile emulation
* Parallel execution
* API testing
* Synthetic monitoring
* CI integrations
* GitHub integration
* Jira integration
* AI-generated test suites from requirements
* AI-generated tests from Playwright traces
* Self-healing tests
* Session recording replay

---

# Deliverables

Produce:

1. System architecture diagram
2. Database schema
3. API specification
4. Docker development environment
5. Initial monorepo structure
6. MVP implementation plan
7. Sprint breakdown
8. Risk assessment
9. Estimated infrastructure costs
10. Recommended folder structure

The implementation should prioritize shipping a working MVP quickly, while preserving a path toward a scalable SaaS platform.
