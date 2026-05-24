import { Link } from "react-router";
import { Upload, ListChecks, FileText, BookOpen } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
};

export function WorkflowNav({
  upload,
  pipeline,
  results,
  reference,
}: {
  upload: NavItem;
  pipeline?: NavItem;
  results?: NavItem;
  reference?: NavItem;
}) {
  const items = [
    { ...upload, icon: Upload },
    pipeline ? { ...pipeline, icon: ListChecks } : null,
    results ? { ...results, icon: FileText } : null,
    reference ? { ...reference, icon: BookOpen } : null,
  ].filter(Boolean) as Array<NavItem & { icon: typeof Upload }>;

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Workflow">
      {items.map((item) => {
        const classes = item.active
          ? "bg-brand-600 text-white border-brand-600"
          : item.disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

        if (item.disabled) {
          return (
            <span
              key={item.label}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${classes}`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.label}
            to={item.to}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${classes}`}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
