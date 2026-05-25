import type { FlaggedEntity } from "@/types/api";
import { CheckCircle2, XCircle, HelpCircle, Pill } from "lucide-react";

export function VerificationStats({ items }: { items: FlaggedEntity[] }) {
  const supported = items.filter((i) => i.flag?.status === "SUPPORTED").length;
  const contradicted = items.filter(
    (i) => i.flag?.status === "CONTRADICTED"
  ).length;
  const unsupported = items.filter(
    (i) => i.flag?.status === "UNSUPPORTED"
  ).length;

  const stats = [
    {
      label: "Medications",
      value: items.length,
      icon: Pill,
      className: "border-slate-200 bg-white text-slate-900",
      iconClass: "text-slate-500",
    },
    {
      label: "Supported",
      value: supported,
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
      iconClass: "text-emerald-600",
    },
    {
      label: "Contradicted",
      value: contradicted,
      icon: XCircle,
      className: "border-red-200 bg-red-50 text-red-900",
      iconClass: "text-red-600",
    },
    {
      label: "Not in formulary",
      value: unsupported,
      icon: HelpCircle,
      className: "border-amber-200 bg-amber-50 text-amber-900",
      iconClass: "text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${s.className}`}
        >
          <s.icon className={`h-5 w-5 shrink-0 ${s.iconClass}`} />
          <div>
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
