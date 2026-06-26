'use client';

import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { STEP_META } from '@/components/tutorial-modal';

const HIGHLIGHT_CLASS = 'tutorial-target';

function clearHighlights() {
  if (typeof document === 'undefined') {
    return;
  }
  document
    .querySelectorAll(`.${HIGHLIGHT_CLASS}`)
    .forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
}

/**
 * Guides the user through the core flow one step at a time, flashing an
 * animated border on the element tied to the active step. Pass `step = null`
 * to deactivate. Targets are matched by their `data-tutorial` attribute.
 */
export function TutorialWalkthrough({
  step,
  onStep,
  onClose,
}: {
  step: number | null;
  onStep: (next: number) => void;
  onClose: () => void;
}) {
  const active = step !== null;

  // Move the flashing highlight to the current step's target and scroll it
  // into view; always clean up on step change / unmount.
  useEffect(() => {
    if (step === null) {
      clearHighlights();
      return;
    }

    const meta = STEP_META[step];
    const target = document.querySelector<HTMLElement>(
      `[data-tutorial="${meta.target}"]`,
    );

    clearHighlights();
    if (target) {
      target.classList.add(HIGHLIGHT_CLASS);
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return () => clearHighlights();
  }, [step]);

  // Escape exits the walkthrough.
  useEffect(() => {
    if (!active) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);

  if (step === null) {
    return null;
  }

  const meta = STEP_META[step];
  const Icon = meta.icon;
  const isFirst = step === 0;
  const isLast = step === STEP_META.length - 1;
  const targetMissing =
    typeof document !== 'undefined' &&
    !document.querySelector(`[data-tutorial="${meta.target}"]`);

  return (
    <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 px-4 pt-3">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden="true" />
            Step {step + 1} of {STEP_META.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit walkthrough"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 pb-1">
          <p className="text-sm font-semibold">{meta.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{meta.body}</p>
          {targetMissing ? (
            <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
              Select or create a project to see this part of the app.
            </p>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <div className="flex items-center gap-1">
            {STEP_META.map((s, index) => (
              <span
                key={s.progressKey}
                className={
                  index === step
                    ? 'h-1.5 w-5 rounded-full bg-accent'
                    : 'h-1.5 w-1.5 rounded-full bg-border'
                }
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStep(step - 1)}
              disabled={isFirst}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStep(step + 1)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
