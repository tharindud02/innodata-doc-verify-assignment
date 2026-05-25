import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { FlaggedEntity, FlagStatus } from "@/types/api";
import {
  formatPrescription,
  formatPrescriptionSubtitle,
} from "@/lib/format-prescription";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ExternalLink,
  Filter,
} from "lucide-react";

const STATUS_META = {
  SUPPORTED: {
    icon: CheckCircle2,
    color: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
    border: "border-emerald-200",
    rowBg: "bg-emerald-50/60",
    label: "Supported",
    sort: 2,
  },
  CONTRADICTED: {
    icon: XCircle,
    color: "text-red-700",
    badge: "bg-red-100 text-red-800 ring-red-600/20",
    border: "border-red-200",
    rowBg: "bg-red-50/80",
    label: "Contradicted",
    sort: 0,
  },
  UNSUPPORTED: {
    icon: HelpCircle,
    color: "text-amber-800",
    badge: "bg-amber-100 text-amber-900 ring-amber-600/20",
    border: "border-amber-200",
    rowBg: "bg-amber-50/60",
    label: "Not in formulary",
    sort: 1,
  },
} as const;

type FilterKey = "all" | "issues" | FlagStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "issues", label: "Needs review" },
  { key: "CONTRADICTED", label: "Contradicted" },
  { key: "UNSUPPORTED", label: "Not in formulary" },
  { key: "SUPPORTED", label: "Supported" },
];

export function FlaggedIssuesPanel({
  items,
  jobId,
}: {
  items: FlaggedEntity[];
  jobId: string;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const sa = STATUS_META[a.flag?.status ?? "UNSUPPORTED"].sort;
      const sb = STATUS_META[b.flag?.status ?? "UNSUPPORTED"].sort;
      return sa - sb || a.entity.drugName.localeCompare(b.entity.drugName);
    });
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return sorted;
    if (filter === "issues") {
      return sorted.filter(
        (i) =>
          i.flag?.status === "CONTRADICTED" ||
          i.flag?.status === "UNSUPPORTED"
      );
    }
    return sorted.filter((i) => i.flag?.status === filter);
  }, [sorted, filter]);

  const issueCount = items.filter(
    (i) =>
      i.flag?.status === "CONTRADICTED" || i.flag?.status === "UNSUPPORTED"
  ).length;

  if (!items.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No medications were extracted from this document.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" aria-hidden />
        {FILTERS.map((f) => {
          const count =
            f.key === "all"
              ? items.length
              : f.key === "issues"
                ? issueCount
                : items.filter((i) => i.flag?.status === f.key).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
              <span
                className={`ml-1.5 tabular-nums ${active ? "text-brand-100" : "text-slate-400"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No medications match this filter.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((it) => (
            <FlaggedRow key={it.entity.id} item={it} jobId={jobId} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlaggedRow({
  item,
  jobId,
}: {
  item: FlaggedEntity;
  jobId: string;
}) {
  const status = item.flag?.status ?? "UNSUPPORTED";
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const isIssue =
    status === "CONTRADICTED" || status === "UNSUPPORTED";
  const [open, setOpen] = useState(isIssue);
  const subtitle = formatPrescriptionSubtitle(item.entity);
  const showReferenceLink =
    (status === "SUPPORTED" || status === "CONTRADICTED") &&
    item.flag?.citationChunkId;

  return (
    <article
      className={`overflow-hidden rounded-lg border shadow-sm ${meta.border} ${meta.rowBg}`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:brightness-[0.98]"
      >
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">
              {item.entity.drugName}
            </p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}
            >
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            {formatPrescription(item.entity)}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
          {!open && item.flag?.explanation && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-700">
              {item.flag.explanation}
            </p>
          )}
        </div>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-200/80 bg-white px-4 py-4">
          {item.flag?.explanation && (
            <p className="mb-4 text-sm leading-relaxed text-slate-700">
              {item.flag.explanation}
            </p>
          )}

          {item.flag?.citationText ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Formulary citation
                  {item.flag.citationMonograph && (
                    <span className="ml-1 font-normal normal-case text-slate-600">
                      · {item.flag.citationMonograph}
                    </span>
                  )}
                  {item.flag.citationSection && (
                    <span className="font-normal normal-case text-slate-600">
                      {" "}
                      · {item.flag.citationSection}
                    </span>
                  )}
                  {item.flag.citationPage != null && (
                    <span className="font-normal normal-case text-slate-600">
                      {" "}
                      · p. {item.flag.citationPage}
                    </span>
                  )}
                </p>
                {showReferenceLink && (
                  <Link
                    to={`/reference/${jobId}?chunk=${item.flag!.citationChunkId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View in reference
                  </Link>
                )}
              </div>
              <blockquote className="border-l-4 border-brand-400 pl-4 text-sm italic text-slate-700">
                {item.flag.citationText}
              </blockquote>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-500">
              No supporting passage found in the institutional formulary.
            </p>
          )}

          {(item.entity.duration ||
            item.entity.indication ||
            item.entity.route) && (
            <dl className="mt-4 grid gap-2 sm:grid-cols-3">
              {item.entity.route && (
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <dt className="text-xs font-medium text-slate-500">Route</dt>
                  <dd className="text-sm text-slate-800">{item.entity.route}</dd>
                </div>
              )}
              {item.entity.duration && (
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <dt className="text-xs font-medium text-slate-500">
                    Duration
                  </dt>
                  <dd className="text-sm text-slate-800">
                    {item.entity.duration}
                  </dd>
                </div>
              )}
              {item.entity.indication && (
                <div className="rounded-md bg-slate-50 px-3 py-2 sm:col-span-1">
                  <dt className="text-xs font-medium text-slate-500">
                    Indication
                  </dt>
                  <dd className="text-sm text-slate-800">
                    {item.entity.indication}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </article>
  );
}
