import type { CriticalPoint } from "@/types/api";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";

const SEV_META: Record<
  CriticalPoint["severity"],
  { card: string; badge: string; icon: typeof AlertTriangle }
> = {
  HIGH: {
    card: "border-red-200 bg-red-50/80",
    badge: "bg-red-100 text-red-800",
    icon: AlertTriangle,
  },
  MEDIUM: {
    card: "border-amber-200 bg-amber-50/80",
    badge: "bg-amber-100 text-amber-900",
    icon: AlertCircle,
  },
  LOW: {
    card: "border-slate-200 bg-slate-50",
    badge: "bg-slate-100 text-slate-700",
    icon: Info,
  },
};

export function CriticalPointsList({ points }: { points: CriticalPoint[] }) {
  if (!points.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No critical points were extracted.
      </p>
    );
  }

  const highCount = points.filter((p) => p.severity === "HIGH").length;

  return (
    <div className="space-y-3">
      {highCount > 0 && (
        <p className="text-xs text-slate-500">
          {highCount} high-priority item{highCount !== 1 ? "s" : ""} — review
          before discharge counseling.
        </p>
      )}
      <ul className="space-y-2">
        {points.map((p) => {
          const meta = SEV_META[p.severity];
          const Icon = meta.icon;
          return (
            <li
              key={p.id}
              className={`flex gap-3 rounded-lg border p-4 ${meta.card}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />
              <div className="min-w-0 flex-1">
                <span
                  className={`mb-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}
                >
                  {p.severity}
                </span>
                <p className="text-sm leading-relaxed text-slate-800">
                  {p.text}
                </p>
                {p.sourcePage != null && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Source · page {p.sourcePage}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
