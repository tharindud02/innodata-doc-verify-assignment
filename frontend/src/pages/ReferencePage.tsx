import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { fetchDocumentPreview } from "@/lib/documents";
import { getApiErrorMessage } from "@/lib/api-error";
import type { JobDetail } from "@/types/api";

function highlightCitation(root: HTMLElement, citationText: string): void {
  const needle = citationText.trim();
  if (!needle) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode() as Text | null;

  while (textNode) {
    const haystack = textNode.textContent ?? "";
    const index = haystack.indexOf(needle);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + needle.length);
      const mark = document.createElement("mark");
      mark.className = "bg-yellow-200";
      range.surroundContents(mark);
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    textNode = walker.nextNode() as Text | null;
  }

  const snippet = needle.slice(0, 120);
  if (snippet.length < needle.length) {
    highlightCitation(root, snippet);
  }
}

export function ReferencePage() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const chunkId = searchParams.get("chunk");
  const contentRef = useRef<HTMLDivElement>(null);

  const [job, setJob] = useState<JobDetail | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  useEffect(() => {
    if (!html || !contentRef.current || !chunkId || !job) return;

    const flagged = job.flagged.find((f) => f.flag?.citationChunkId === chunkId);
    const citationText = flagged?.flag?.citationText;
    if (!citationText) return;

    const timer = window.setTimeout(() => {
      if (contentRef.current) {
        highlightCitation(contentRef.current, citationText);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [html, chunkId, job]);

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
    <div>
      <Link
        to={`/jobs/${jobId}/results`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to results
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Institutional formulary</h1>

      <div
        ref={contentRef}
        className="max-h-[85vh] overflow-y-auto rounded-md border bg-white p-6 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
