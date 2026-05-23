import { useParams } from "react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { JobDetail } from "@/types/api";
import { DocumentRenderer } from "@/components/DocumentRenderer";
import { SummaryPanel } from "@/components/SummaryPanel";
import { CriticalPointsList } from "@/components/CriticalPointsList";
import { FlaggedIssuesPanel } from "@/components/FlaggedIssuesPanel";

export function DocumentViewPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    api.get<JobDetail>(`/jobs/${jobId}`).then(
      (r) => setJob(r.data),
      (e) => setErr(e.response?.data?.message ?? e.message)
    );
  }, [jobId]);

  if (err) return <p className="text-red-600">{err}</p>;
  if (!job) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">{job.filename}</h1>
      <p className="mb-6 text-sm text-slate-500">
        Verified ·{" "}
        {job.completedAt && new Date(job.completedAt).toLocaleString()}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Primary document
          </h2>
          <DocumentRenderer documentId={job.documentId} />
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Summary
            </h2>
            <div className="rounded-md border bg-white p-4">
              <SummaryPanel summary={job.summary} />
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Critical points for the patient
            </h2>
            <CriticalPointsList points={job.criticalPoints} />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Verification flags
            </h2>
            <FlaggedIssuesPanel items={job.flagged} />
          </div>
        </section>
      </div>
    </div>
  );
}