import { CheckCircle2, CircleDashed, Clock3, OctagonAlert, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TestRunStatus } from '@/lib/api';

const statusConfig: Record<
  TestRunStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  queued: {
    label: 'Queued',
    className: 'border-slate-300 bg-slate-50 text-slate-700',
    icon: Clock3,
  },
  running: {
    label: 'Running',
    className: 'border-amber-300 bg-amber-50 text-amber-800',
    icon: CircleDashed,
  },
  passed: {
    label: 'Passed',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    className: 'border-red-300 bg-red-50 text-red-800',
    icon: OctagonAlert,
  },
  canceled: {
    label: 'Canceled',
    className: 'border-zinc-300 bg-zinc-50 text-zinc-700',
    icon: XCircle,
  },
};

export function StatusBadge({ status }: { status: TestRunStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium',
        config.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}
