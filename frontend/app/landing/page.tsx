'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Blocks,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Gauge,
  Headphones,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from 'lucide-react';

const outcomes = [
  { value: '42%', label: 'fewer escaped regressions' },
  { value: '6 hrs', label: 'saved per release cycle' },
  { value: '3 min', label: 'from failure to evidence' },
];

const features = [
  {
    icon: Sparkles,
    title: 'Create tests faster',
    body: 'Generate browser steps from a plain-English prompt, record workflows in Chrome, or edit the structured JSON directly.',
  },
  {
    icon: PlayCircle,
    title: 'Run real browser checks',
    body: 'Execute critical journeys in headless Chromium with Playwright, queue runs in the background, and track live status.',
  },
  {
    icon: FileSearch,
    title: 'Debug with evidence',
    body: 'Every run captures logs and structured reports; failed runs include screenshots and traces for fast triage.',
  },
];

const steps = [
  'Connect a product, marketing site, or customer portal as a project.',
  'Describe, record, or paste the journey your team cannot afford to break.',
  'Run it before releases and inspect pass rate, failed step, logs, and artifacts.',
];

const buyerCards = [
  {
    icon: ShieldCheck,
    title: 'For QA leaders',
    body: 'Standardize smoke coverage and give every failure a reproducible paper trail.',
  },
  {
    icon: Gauge,
    title: 'For product teams',
    body: 'Protect signups, checkout, onboarding, and admin flows without waiting for a bespoke test project.',
  },
  {
    icon: Blocks,
    title: 'For engineering',
    body: 'Keep automation grounded in Playwright, selectors, queues, and artifacts your team can inspect.',
  },
];

type FormState = 'idle' | 'sent';

export default function LandingPage() {
  const [demoState, setDemoState] = useState<FormState>('idle');
  const [auditState, setAuditState] = useState<FormState>('idle');

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    setter: (state: FormState) => void,
  ) {
    event.preventDefault();
    setter('sent');
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative min-h-[92vh] overflow-hidden text-white">
        <Image
          src="/qa-automation-hero.png"
          alt="QA team reviewing automated browser test results, failures, logs, and screenshots on an operations dashboard"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/58" aria-hidden="true" />

        <div className="relative z-10 flex min-h-[92vh] flex-col">
          <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
            <Link href="/landing" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-500 text-white">
                <Gauge className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">QA Automation</span>
                <span className="block text-xs text-white/72">Browser quality ops</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-white/78 md:flex">
              <a href="#platform" className="hover:text-white">Platform</a>
              <a href="#proof" className="hover:text-white">Results</a>
              <a href="#demo" className="hover:text-white">Demo</a>
              <Link href="/" className="hover:text-white">Open app</Link>
            </nav>
          </header>

          <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-12 pt-8 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/86">
                <BadgeCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                AI-assisted Playwright checks with failure evidence
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal md:text-7xl">
                QA Automation
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">
                Help your team create, run, and debug browser tests without turning
                every release check into a custom engineering project.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#demo"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-teal-500 px-5 text-sm font-semibold text-white hover:bg-teal-400"
                >
                  Book a demo
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/28 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/16"
                >
                  View product shell
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="proof" className="border-b border-border bg-panel">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-7 sm:grid-cols-3 lg:px-8">
          {outcomes.map((outcome) => (
            <div key={outcome.label} className="py-2">
              <p className="text-3xl font-semibold text-teal-700">{outcome.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{outcome.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="platform" className="px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase text-teal-700">Platform</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              A practical test operations layer for the flows that protect revenue.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-md border border-border bg-panel p-6 shadow-panel">
                <feature.icon className="h-6 w-6 text-teal-700" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111827] px-5 py-20 text-white lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-300">Workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              From “does checkout still work?” to a run report your team can trust.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/72">
              QA Automation gives business-critical journeys a repeatable home:
              projects, test definitions, async runs, pass history, logs, screenshots,
              and traces in one place.
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step} className="flex gap-4 rounded-md border border-white/14 bg-white/[0.06] p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-sm font-bold text-slate-950">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-white/82">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {buyerCards.map((card) => (
              <article key={card.title} className="rounded-md border border-border bg-panel p-6">
                <card.icon className="h-6 w-6 text-teal-700" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="border-y border-border bg-panel px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">CTA</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              See how fast your team can cover its top release risks.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Share a few details and get a guided demo around the journeys that
              matter most: signups, checkout, onboarding, admin workflows, or internal tools.
            </p>
          </div>

          <form
            onSubmit={(event) => handleSubmit(event, setDemoState)}
            className="rounded-md border border-border bg-background p-5 shadow-panel"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Work email</span>
                <input
                  type="email"
                  required
                  className="mt-1 h-10 w-full rounded-md border border-border bg-panel px-3 text-sm"
                  placeholder="you@company.com"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Company</span>
                <input
                  required
                  className="mt-1 h-10 w-full rounded-md border border-border bg-panel px-3 text-sm"
                  placeholder="Acme"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Critical flow</span>
                <select
                  required
                  className="mt-1 h-10 w-full rounded-md border border-border bg-panel px-3 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Choose one</option>
                  <option>Checkout or payments</option>
                  <option>Login and onboarding</option>
                  <option>Marketing site conversion</option>
                  <option>Internal operations workflow</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">What should never break?</span>
                <textarea
                  className="mt-1 min-h-[96px] w-full resize-y rounded-md border border-border bg-panel px-3 py-2 text-sm leading-6"
                  placeholder="Tell us about the customer journey, release risk, or flaky checks you want under control."
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Request demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            {demoState === 'sent' ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-teal-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Demo request captured for this prototype.
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Quality audit</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              Not ready for a demo? Start with a release-risk audit.
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ClipboardCheck, label: 'Top workflows mapped' },
                { icon: BarChart3, label: 'Automation ROI estimate' },
                { icon: TimerReset, label: 'MVP rollout plan' },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-border bg-panel p-4">
                  <item.icon className="h-5 w-5 text-teal-700" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={(event) => handleSubmit(event, setAuditState)}
            className="rounded-md border border-border bg-panel p-5 shadow-panel"
          >
            <div className="mb-4 flex items-center gap-2">
              <Headphones className="h-5 w-5 text-teal-700" aria-hidden="true" />
              <h3 className="text-base font-semibold">Get the audit checklist</h3>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <input
                type="email"
                required
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                placeholder="team@company.com"
              />
            </label>
            <button
              type="submit"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
            >
              Send checklist
            </button>
            {auditState === 'sent' ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-teal-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Checklist request captured for this prototype.
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <footer className="border-t border-border bg-panel px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>QA Automation helps teams ship browser changes with clearer evidence.</p>
          <div className="flex gap-4">
            <Link href="/" className="font-medium text-foreground hover:text-teal-700">Open app</Link>
            <a href="#demo" className="font-medium text-foreground hover:text-teal-700">Book demo</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
