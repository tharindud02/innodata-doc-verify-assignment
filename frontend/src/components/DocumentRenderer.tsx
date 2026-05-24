import { useEffect, useState } from "react";
import { fetchDocumentPreview } from "@/lib/documents";
import { getApiErrorMessage } from "@/lib/api-error";

interface DocumentRendererProps {
  documentId: string;
}

export function DocumentRenderer({ documentId }: DocumentRendererProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setErr(null);

    fetchDocumentPreview(documentId).then(
      (content) => {
        if (!cancelled) setHtml(content);
      },
      (error: unknown) => {
        if (cancelled) return;
        setErr(getApiErrorMessage(error, "Failed to load preview"));
      }
    );

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (err) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {err}
      </p>
    );
  }
  if (!html) {
    return <p className="text-sm text-slate-500">Loading document...</p>;
  }

  return (
    <div
      className="max-h-[80vh] overflow-y-auto rounded-md border bg-white p-6 text-sm leading-relaxed"
      // Backend sanitizes via sanitize-html before serving.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
