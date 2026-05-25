import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { fetchDocumentPreview } from "@/lib/documents";
import { getApiErrorMessage } from "@/lib/api-error";
import { highlightCitationInElement } from "@/lib/citation-highlight";
import type { FlaggedEntity } from "@/types/api";

export interface ReferencePreviewModalProps {
  open: boolean;
  onClose: () => void;
  referenceDocumentId: string;
  referenceFilename?: string;
  flagged?: FlaggedEntity | null;
}

export function ReferencePreviewModal({
  open,
  onClose,
  referenceDocumentId,
  referenceFilename,
  flagged,
}: ReferencePreviewModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [highlightFound, setHighlightFound] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !referenceDocumentId) return;
    let cancelled = false;
    setHtml(null);
    setErr(null);
    setHighlightFound(null);

    fetchDocumentPreview(referenceDocumentId).then(
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
  }, [open, referenceDocumentId]);

  useLayoutEffect(() => {
    if (!contentRef.current || !html) return;
    contentRef.current.innerHTML = html;
  }, [html]);

  useLayoutEffect(() => {
    const root = contentRef.current;
    const flag = flagged?.flag;
    if (!root || !html || !flag?.citationText) {
      setHighlightFound(null);
      return;
    }

    const phrases = [
      flag.citationText,
      flag.citationMonograph ?? "",
    ].filter((p) => p.trim().length > 0);

    const found = highlightCitationInElement(root, phrases);
    setHighlightFound(found);
  }, [html, flagged]);

  if (!open) return null;

  const flag = flagged?.flag;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reference-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close reference preview"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2
              id="reference-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              Institutional formulary
            </h2>
            {referenceFilename && (
              <p className="text-sm text-slate-500">{referenceFilename}</p>
            )}
            {flagged && (
              <p className="mt-1 text-sm font-medium text-slate-700">
                {flagged.entity.drugName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {flag?.citationText && (
          <div className="border-b bg-slate-50 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Citation
              {flag.citationMonograph && (
                <span className="ml-1 font-normal normal-case text-slate-600">
                  · {flag.citationMonograph}
                </span>
              )}
              {flag.citationSection && (
                <span className="font-normal normal-case text-slate-600">
                  {" "}
                  · {flag.citationSection}
                </span>
              )}
              {flag.citationPage != null && (
                <span className="font-normal normal-case text-slate-600">
                  {" "}
                  · p. {flag.citationPage}
                </span>
              )}
            </p>
            <blockquote className="mt-2 border-l-4 border-brand-400 pl-3 text-sm italic text-slate-700">
              {flag.citationText}
            </blockquote>
            <div className="mt-2 text-xs">
              {highlightFound === false ? (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Exact quote not found in rendered text — scroll to the relevant section.
                </span>
              ) : highlightFound === true ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Citation highlighted in document below.
                </span>
              ) : null}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {err && (
            <p className="text-sm text-red-600" role="alert">
              {err}
            </p>
          )}
          {!err && !html && (
            <p className="text-sm text-slate-500">Loading reference...</p>
          )}
          {html && (
            <div
              ref={contentRef}
              className="prose prose-sm max-w-none text-sm leading-relaxed text-slate-800"
            />
          )}
        </div>
      </div>
    </div>
  );
}
