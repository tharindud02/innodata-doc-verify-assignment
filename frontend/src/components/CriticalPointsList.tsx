import type { CriticalPoint } from "@/types/api";
import { AlertTriangle } from "lucide-react";

const SEV_COLORS: Record<CriticalPoint["severity"], string> = {
  HIGH: "bg-red-50 text-red-700 border-red-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-slate-50 text-slate-700 border-slate-200",
};

export function CriticalPointsList({ points }: { points: CriticalPoint[] }) {
  if (!points.length)
    return <p className="text-sm text-slate-500">No critical points extracted.</p>;
  return (
    <ul className="space-y-2">
      {points.map((p) => (
        <li
          key={p.id}
          className={`flex gap-2 rounded-md border p-3 ${SEV_COLORS[p.severity]}`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="text-sm">{p.text}</p>
            {p.sourcePage != null && (
              <p className="mt-1 text-xs opacity-70">Page {p.sourcePage}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}