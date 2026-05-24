import { useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import type { JobDetail } from "@/types/api";
import { DocumentRenderer } from "@/components/DocumentRenderer";
import { SummaryPanel } from "@/components/SummaryPanel";
import { CriticalPointsList } from "@/components/CriticalPointsList";
import { FlaggedIssuesPanel } from "@/components/FlaggedIssuesPanel";
import { VerificationStats } from "@/components/VerificationStats";
import { SectionCard } from "@/components/SectionCard";
import { WorkflowNav } from "@/components/WorkflowNav";

function ResultsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-2/3 rounded bg-slate-200" />
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-96 rounded-xl bg-slate-200" />
        <div className="space-y-4">
          <div className="h-48 rounded-xl bg-slate-200" />
          <div className="h-32 rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

export function DocumentViewPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    api
      .get<JobDetail>(`/jobs/${jobId}`)
      .then((r) => setJob(r.data))
      .catch((e: unknown) =>
        setErr(getApiErrorMessage(e, "Failed to load results"))
      );
  }, [jobId]);

  const issueCount = useMemo(() => {
    if (!job) return 0;
    return job.flagged.filter(
      (f) =>
        f.flag?.status === "CONTRADICTED" ||
        f.flag?.status === "UNSUPPORTED"
    ).length;
  }, [job]);

  if (err) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{err}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading verification results…
        </div>
        <ResultsSkeleton />
      </div>
    );
  }

  const completedLabel = job.completedAt
    ? new Date(job.completedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="space-y-6 pb-10">
      {/* Page header */}
      <header className="space-y-4">
        <WorkflowNav
          upload={{ to: "/", label: "Upload" }}
          pipeline={{
            to: `/documents/${job.documentId}?job=${job.id}`,
            label: "Pipeline",
          }}
          results={{
            to: `/jobs/${job.id}/results`,
            label: "Results",
            active: true,
          }}
        />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-brand-600">
              <FileText className="h-5 w-5 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Verification complete
              </span>
            </div>
            <h1 className="mt-1 truncate text-2xl font-semibold text-slate-900 sm:text-3xl">
              {job.filename}
            </h1>
            {completedLabel && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <Calendar className="h-4 w-4" />
                Verified {completedLabel}
              </p>
            )}
          </div>

          {issueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <span>
                <strong className="font-semibold">{issueCount}</strong> medication
                {issueCount !== 1 ? "s" : ""} need review
              </span>
            </div>
          )}
        </div>

        <VerificationStats items={job.flagged} />
      </header>

      {/* Main layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Analysis column — primary on mobile, right on desktop */}
        <div className="order-1 space-y-6 xl:order-2 xl:col-span-7">
          <SectionCard
            title="Document summary"
            description="Plain-language overview of the discharge document"
          >
            <SummaryPanel summary={job.summary} />
          </SectionCard>

          <SectionCard
            title="Medication verification"
            description="Compared against the Meridian Bay institutional formulary"
          >
            <FlaggedIssuesPanel items={job.flagged} jobId={job.id} />
          </SectionCard>

          <SectionCard
            title="Critical points for the patient"
            description="Items the patient should not miss before discharge"
          >
            <CriticalPointsList points={job.criticalPoints} />
          </SectionCard>
        </div>

        {/* Document column — sticky on wide screens */}
        <div className="order-2 xl:order-1 xl:col-span-5">
          <div className="xl:sticky xl:top-6">
            <SectionCard
              title="Primary document"
              description="Uploaded discharge summary"
              className="overflow-hidden"
            >
              <DocumentRenderer
                documentId={job.documentId}
                className="max-h-[min(70vh,640px)] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-5 text-sm leading-relaxed prose-headings:font-semibold"
              />
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
