import type { JobStatus } from "@/types/api";

const STATUS_META: Record<
  JobStatus,
  { label: string; badge: string }
> = {
  COMPLETED: {
    label: "Complete",
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  },
  RUNNING: {
    label: "Running",
    badge: "bg-blue-100 text-blue-800 ring-blue-600/20",
  },
  QUEUED: {
    label: "Queued",
    badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
  },
  FAILED: {
    label: "Failed",
    badge: "bg-red-100 text-red-800 ring-red-600/20",
  },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}
    >
      {meta.label}
    </span>
  );
}
