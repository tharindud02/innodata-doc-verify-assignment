import { useState } from "react";
import type { FlaggedEntity } from "@/types/api";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const STATUS_META = {
  SUPPORTED: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    label: "Supported",
  },
  CONTRADICTED: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Contradicted",
  },
  UNSUPPORTED: {
    icon: HelpCircle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "Not in formulary",
  },
} as const;

export function FlaggedIssuesPanel({ items }: { items: FlaggedEntity[] }) {
  if (!items.length)
    return <p className="text-sm text-slate-500">No medications extracted.</p>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <FlaggedRow key={it.entity.id} item={it} />
      ))}
    </div>
  );
}

function FlaggedRow({ item }: { item: FlaggedEntity }) {
  const [open, setOpen] = useState(false);
  const status = item.flag?.status ?? "UNSUPPORTED";
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <div className={`rounded-md border ${meta.border} ${meta.bg}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Icon className={`h-4 w-4 ${meta.color}`} />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {item.entity.drugName}
            {item.entity.dose && (
              <span className="ml-1 font-normal text-slate-600">
                - {item.entity.dose}
                {item.entity.unit ?? ""} {item.entity.frequency ?? ""}
              </span>
            )}
          </p>
        </div>
        <span className={`text-xs font-medium uppercase ${meta.color}`}>
          {meta.label}
        </span>
      </button>

      {open && (
        <div className="border-t bg-white px-3 py-3 text-sm">
          {item.flag?.explanation && (
            <p className="mb-2 text-slate-700">{item.flag.explanation}</p>
          )}
          {item.flag?.citationText ? (
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="mb-1 text-xs font-medium text-slate-500">
                Reference passage
                {item.flag.citationSection && ` · ${item.flag.citationSection}`}
                {item.flag.citationPage != null &&
                  ` · p. ${item.flag.citationPage}`}
              </p>
              <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-700">
                {item.flag.citationText}
              </blockquote>
            </div>
          ) : (
            <p className="text-xs italic text-slate-500">
              No supporting passage found in reference.
            </p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-1 text-xs text-slate-600">
            {item.entity.duration && (
              <>
                <dt className="text-slate-500">Duration</dt>
                <dd>{item.entity.duration}</dd>
              </>
            )}
            {item.entity.indication && (
              <>
                <dt className="text-slate-500">Indication</dt>
                <dd>{item.entity.indication}</dd>
              </>
            )}
            {item.entity.route && (
              <>
                <dt className="text-slate-500">Route</dt>
                <dd>{item.entity.route}</dd>
              </>
            )}
            {item.entity.sourcePage != null && (
              <>
                <dt className="text-slate-500">Source page</dt>
                <dd>{item.entity.sourcePage}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}