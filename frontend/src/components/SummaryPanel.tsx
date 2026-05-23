export function SummaryPanel({ summary }: { summary: string | null }) {
    if (!summary)
      return <p className="text-sm text-slate-500">No summary available.</p>;
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {summary}
      </div>
    );
  }