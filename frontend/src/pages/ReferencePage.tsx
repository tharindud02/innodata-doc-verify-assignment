import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { fetchDocumentPreview } from "@/lib/documents";
import { getApiErrorMessage } from "@/lib/api-error";
import type { JobDetail } from "@/types/api";
import { WorkflowNav } from "@/components/WorkflowNav";

type TextNodeSlice = { node: Text; start: number; end: number };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearHighlights(root: HTMLElement): void {
  const marks = Array.from(
    root.querySelectorAll("mark[data-citation-highlight='true']")
  );
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}

function collectTextNodeSlices(root: HTMLElement): {
  text: string;
  slices: TextNodeSlice[];
} {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const slices: TextNodeSlice[] = [];
  let fullText = "";
  let node = walker.nextNode() as Text | null;
  while (node) {
    const value = node.textContent ?? "";
    if (value.length > 0) {
      const start = fullText.length;
      fullText += value;
      slices.push({ node, start, end: start + value.length });
    }
    node = walker.nextNode() as Text | null;
  }
  return { text: fullText, slices };
}

function findCitationRange(text: string, citation: string): [number, number] | null {
  const trimmed = citation.trim();
  if (!trimmed) return null;
  const whitespaceAgnostic = escapeRegex(trimmed).replace(/\s+/g, "\\s+");
  const pattern = new RegExp(whitespaceAgnostic, "i");
  const match = pattern.exec(text);
  if (match?.index != null) {
    return [match.index, match.index + match[0].length];
  }

  const firstSentence = trimmed.split(/[.!?]/)[0]?.trim() ?? "";
  if (firstSentence.length >= 20) {
    const shortPattern = new RegExp(
      escapeRegex(firstSentence).replace(/\s+/g, "\\s+"),
      "i"
    );
    const shortMatch = shortPattern.exec(text);
    if (shortMatch?.index != null) {
      return [shortMatch.index, shortMatch.index + shortMatch[0].length];
    }
  }
  return null;
}

function applyHighlight(
  root: HTMLElement,
  slices: TextNodeSlice[],
  matchStart: number,
  matchEnd: number
): HTMLElement | null {
  const targets = slices.filter((slice) => matchStart < slice.end && matchEnd > slice.start);
  if (targets.length === 0) return null;
  let firstMark: HTMLElement | null = null;

  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const target = targets[i];
    const startOffset = Math.max(0, matchStart - target.start);
    const endOffset = Math.min(target.end - target.start, matchEnd - target.start);
    if (startOffset >= endOffset) continue;
    const range = document.createRange();
    range.setStart(target.node, startOffset);
    range.setEnd(target.node, endOffset);
    const mark = document.createElement("mark");
    mark.dataset.citationHighlight = "true";
    mark.className = "rounded bg-yellow-200/90 px-0.5";
    range.surroundContents(mark);
    firstMark = mark;
  }

  if (firstMark) {
    firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    root.scrollTo({ top: 0, behavior: "smooth" });
  }
  return firstMark;
}

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

  useEffect(() => {
    if (!html || !contentRef.current || !chunkId || !job) {
      setHighlightFound(null);
      return;
    }

    const flagged = job.flagged.find((f) => f.flag?.citationChunkId === chunkId);
    const citationText = flagged?.flag?.citationText;
    if (!citationText) {
      setHighlightFound(null);
      return;
    }

    const timer = window.setTimeout(() => {
      if (!contentRef.current) return;
      clearHighlights(contentRef.current);
      const { text, slices } = collectTextNodeSlices(contentRef.current);
      const range = findCitationRange(text, citationText);
      if (!range) {
        setHighlightFound(false);
        return;
      }
      const firstMark = applyHighlight(contentRef.current, slices, range[0], range[1]);
      setHighlightFound(Boolean(firstMark));
    }, 30);

    return () => window.clearTimeout(timer);
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
        reference={{ to: `/reference/${job.id}`, label: "Reference", active: true }}
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
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
