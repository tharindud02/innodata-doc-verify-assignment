import { FileText } from "lucide-react";

export function SummaryPanel({ summary }: { summary: string | null }) {
  if (!summary) {
    return (
      <p className="text-sm text-slate-500">No summary available for this document.</p>
    );
  }

  return (
    <div className="flex gap-3">
      <FileText
        className="mt-1 h-5 w-5 shrink-0 text-brand-500"
        aria-hidden
      />
      <p className="text-sm leading-relaxed text-slate-700">{summary}</p>
    </div>
  );
}
