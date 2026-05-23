import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function DocumentRenderer({ documentId }: { documentId: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ html: string }>(`/documents/${documentId}/preview`).then(
      (r) => setHtml(r.data.html),
      (e) => setErr(e.message)
    );
  }, [documentId]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!html)
    return <p className="text-sm text-slate-500">Loading document...</p>;

  return (
    <div
      className="max-h-[80vh] overflow-y-auto rounded-md border bg-white p-6 text-sm leading-relaxed"
      // Backend sanitizes via sanitize-html before serving.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}