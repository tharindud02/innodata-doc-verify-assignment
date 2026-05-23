import type { Stage, StageName } from "@/types/api";
import { Check, Loader2, Circle, AlertCircle } from "lucide-react";

const STAGE_ORDER: StageName[] = [
  "PARSE",
  "CHUNK",
  "EMBED",
  "SUMMARIZE",
  "CRITICAL_POINTS",
  "EXTRACT",
  "VERIFY",
];

const LABELS: Record<StageName, string> = {
  PARSE: "Parsing document",
  CHUNK: "Chunking",
  EMBED: "Generating embeddings",
  SUMMARIZE: "Summarizing",
  CRITICAL_POINTS: "Extracting critical points",
  EXTRACT: "Extracting medications",
  VERIFY: "Verifying against formulary",
};

function durationLabel(s: Stage): string | null {
  if (!s.startedAt) return null;
  const end = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
  const ms = end - new Date(s.startedAt).getTime();
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function PipelineStages({ stages }: { stages: Stage[] }) {
  const byName = new Map(stages.map((s) => [s.name, s]));
  return (
    <ol className="space-y-2">
      {STAGE_ORDER.map((name) => {
        const s: Stage =
          byName.get(name) ?? {
            name,
            status: "PENDING",
            startedAt: null,
            endedAt: null,
            error: null,
          };
        return (
          <li
            key={name}
            className="flex items-center gap-3 rounded-md border bg-white px-4 py-3"
          >
            <StageIcon status={s.status} />
            <div className="flex-1">
              <p className="font-medium">{LABELS[name]}</p>
              {s.error && <p className="text-xs text-red-600">{s.error}</p>}
              {s.startedAt && !s.error && (
                <p className="text-xs text-slate-500">
                  {new Date(s.startedAt).toLocaleTimeString()}
                  {durationLabel(s) && ` · ${durationLabel(s)}`}
                </p>
              )}
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {s.status}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StageIcon({ status }: { status: Stage["status"] }) {
  if (status === "DONE") return <Check className="h-5 w-5 text-emerald-600" />;
  if (status === "RUNNING")
    return <Loader2 className="h-5 w-5 animate-spin text-brand-600" />;
  if (status === "FAILED")
    return <AlertCircle className="h-5 w-5 text-red-600" />;
  return <Circle className="h-5 w-5 text-slate-300" />;
}