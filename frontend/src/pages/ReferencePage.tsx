import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { fetchDocumentPreview } from "@/lib/documents";
import { getApiErrorMessage } from "@/lib/api-error";
import { highlightCitationInElement } from "@/lib/citation-highlight";
import type { JobDetail } from "@/types/api";
import { WorkflowNav } from "@/components/WorkflowNav";

export function ReferencePage() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const chunkId = searchParams.get("chunk");
  const contentRef = useRef<HTMLDivElement>(null);

  const [job, setJob] = useState<JobDetail | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [highlightFound, setHighlightFound] = useState<boolean | null>(null);

  useEffect(() => {
    if (!jobId) return;
    api
      .get<JobDetail>(`/jobs/${jobId}`)
      .then((r) => setJob(r.data))
      .catch((e: unknown) =>
        setErr(getApiErrorMessage(e, "Failed to load job"))
      );
  }, [jobId]);

  useEffect(() => {
    if (!job?.referenceDocumentId) return;
    let cancelled = false;

    fetchDocumentPreview(job.referenceDocumentId).then(
      (content) => {
        if (!cancelled) setHtml(content);
      },
      (error: unknown) => {
        if (!cancelled) {
          setErr(getApiErrorMessage(error, "Failed to load reference preview"));
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [job?.referenceDocumentId]);

  // Set HTML imperatively so React re-renders don't wipe <mark> highlights.
  useLayoutEffect(() => {
    if (!contentRef.current || !html) return;
    contentRef.current.innerHTML = html;
  }, [html]);

  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root || !html || !chunkId || !job) {
      setHighlightFound(null);
      return;
    }

    const flagged = job.flagged.find((f) => f.flag?.citationChunkId === chunkId);
    const flag = flagged?.flag;
    if (!flag?.citationText) {
      setHighlightFound(null);
      return;
    }

    const phrases = [
      flag.citationText,
      flag.citationMonograph ?? "",
    ].filter((p) => p.trim().length > 0);

    const found = highlightCitationInElement(root, phrases);
    setHighlightFound(found);
  }, [html, chunkId, job]);

  const selectedFlag = useMemo(() => {
    if (!job || !chunkId) return null;
    return job.flagged.find((f) => f.flag?.citationChunkId === chunkId) ?? null;
  }, [job, chunkId]);

  if (!jobId) {
    return <p className="text-red-600">Missing job id.</p>;
  }
  if (err) {
    return <p className="text-red-600">{err}</p>;
  }
  if (!job || !html) {
    return <p className="text-slate-500">Loading reference...</p>;
  }

  return (
    <div className="space-y-4">
      <WorkflowNav
        upload={{ to: "/", label: "Upload" }}
        pipeline={{
          to: `/documents/${job.documentId}?job=${job.id}`,
          label: "Pipeline",
        }}
        results={{ to: `/jobs/${job.id}/results`, label: "Results" }}
        reference={{ to: `/reference/${job.id}`, label: "Reference" }}
      />
      <h1 className="text-2xl font-semibold">Institutional formulary</h1>

      {selectedFlag?.flag?.citationText && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-800">
            {selectedFlag.entity.drugName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {selectedFlag.flag.citationMonograph ?? "Reference"}{" "}
            {selectedFlag.flag.citationSection
              ? `· ${selectedFlag.flag.citationSection}`
              : ""}
            {selectedFlag.flag.citationPage != null
              ? ` · p. ${selectedFlag.flag.citationPage}`
              : ""}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {highlightFound === false ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertCircle className="h-4 w-4" />
                Exact quote not found in rendered text. Scroll manually in this section.
              </span>
            ) : highlightFound === true ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Citation highlighted below.
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div
        ref={contentRef}
        className="max-h-[80vh] overflow-y-auto rounded-lg border bg-white p-6 text-sm leading-relaxed shadow-sm"
      />
    </div>
  );
}
