import { useParams, useNavigate } from "react-router";
import { useEffect } from "react";
import { useJobStream } from "@/hooks/useJobStream";
import { PipelineStages } from "@/components/PipelineStages";
import { Loader2 } from "lucide-react";

export function JobStatusPage() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const { job, error } = useJobStream(jobId ?? null);
  const optimisticName = sessionStorage.getItem("pending-upload-name");

  useEffect(() => {
    if (job?.status === "COMPLETED") {
      sessionStorage.removeItem("pending-upload-name");
      const t = setTimeout(() => nav(`/documents/${job.id}`), 600);
      return () => clearTimeout(t);
    }
  }, [job?.status, job?.id, nav]);

  if (error) return <p className="text-red-600">Error: {error}</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Processing</h1>
      <p className="mb-6 text-slate-600">
        {job?.filename ?? optimisticName ?? "Your document"} - verifying against
        the institutional formulary.
      </p>

      {!job ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
        </div>
      ) : (
        <PipelineStages stages={job.stages} />
      )}

      {job?.status === "FAILED" && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Processing failed. See pipeline stage errors above.
        </p>
      )}
    </div>
  );
}