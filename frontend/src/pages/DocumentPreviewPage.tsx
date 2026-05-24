import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DocumentRenderer } from "@/components/DocumentRenderer";
import { PipelineStages } from "@/components/PipelineStages";
import { useJobStream } from "@/hooks/useJobStream";
import { getStoredUploadResult } from "@/lib/documents";
import type { Stage, StageName } from "@/types/api";

const STAGE_NAMES: StageName[] = [
  "PARSE",
  "CHUNK",
  "EMBED",
  "SUMMARIZE",
  "CRITICAL_POINTS",
  "EXTRACT",
  "VERIFY",
];

const QUEUED_STAGES: Stage[] = STAGE_NAMES.map((name) => ({
  name,
  status: "PENDING",
  startedAt: null,
  endedAt: null,
  error: null,
}));

export function DocumentPreviewPage() {
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job");
  const stored = getStoredUploadResult();
  const filename =
    stored && stored.documentId === documentId
      ? stored.filename
      : sessionStorage.getItem("pending-upload-name");

  const { job, error: streamError } = useJobStream(jobId);

  if (!documentId) {
    return <p className="text-red-600">Missing document id.</p>;
  }

  const stages = job?.stages ?? QUEUED_STAGES;
  const jobStatus = job?.status ?? "QUEUED";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Upload another
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {filename ?? "Document preview"}
          </h1>
          <p className="text-sm text-slate-500">
            Parsed and ready — verification pipeline{" "}
            {jobStatus === "COMPLETED"
              ? "complete"
              : jobStatus === "FAILED"
                ? "failed"
                : "queued"}
          </p>
        </div>
        {jobId && jobStatus === "COMPLETED" && (
          <Link
            to={`/jobs/${jobId}/results`}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            View verification results
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Document preview
          </h2>
          <DocumentRenderer documentId={documentId} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Verification pipeline
          </h2>
          {!job && jobId && !streamError ? (
            <p className="mb-3 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting to job stream...
            </p>
          ) : null}
          {streamError && !job && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Live updates unavailable — showing queued stages. Job{" "}
              <code className="text-xs">{jobId}</code>
            </p>
          )}
          <PipelineStages stages={stages} />
          {jobStatus === "FAILED" && (
            <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              Processing failed. See pipeline stage errors above.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
