import { useParams, useNavigate, Link } from "react-router";
import { useEffect } from "react";
import { useJobStream } from "@/hooks/useJobStream";
import { PipelineStages } from "@/components/PipelineStages";
import { DocumentRenderer } from "@/components/DocumentRenderer";
import { Loader2 } from "lucide-react";
import { getStoredUploadResult } from "@/lib/documents";

export function JobStatusPage() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const { job, error } = useJobStream(jobId ?? null);
  const stored = getStoredUploadResult();
  const optimisticName =
    stored && stored.jobId === jobId
      ? stored.filename
      : sessionStorage.getItem("pending-upload-name");

  useEffect(() => {
    if (job?.status === "COMPLETED") {
      const t = setTimeout(() => nav(`/jobs/${job.id}/results`), 600);
      return () => clearTimeout(t);
    }
  }, [job?.status, job?.id, nav]);

  const documentId =
    job?.documentId ??
    (stored && stored.jobId === jobId ? stored.documentId : null);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Processing</h1>
      <p className="mb-6 text-slate-600">
        {job?.filename ?? optimisticName ?? "Your document"} — verifying against
        the institutional formulary.
      </p>

      {documentId && (
        <p className="mb-4 text-sm">
          <Link
            to={`/documents/${documentId}${jobId ? `?job=${jobId}` : ""}`}
            className="text-brand-600 hover:underline"
          >
            View document preview
          </Link>
        </p>
      )}

      {!job ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {error ? error : "Connecting..."}
        </div>
      ) : (
        <PipelineStages stages={job.stages} />
      )}

      {job?.status === "FAILED" && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Processing failed. See pipeline stage errors above.
        </p>
      )}

      {documentId && job && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </h2>
          <DocumentRenderer documentId={documentId} />
        </div>
      )}
    </div>
  );
}
