import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Upload, ListChecks, FileText, BookOpen, ChevronRight } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  disabled?: boolean;
};

type StepKey = "upload" | "pipeline" | "results" | "reference";

function getCurrentStep(pathname: string): StepKey {
  if (pathname === "/") return "upload";
  if (/^\/reference\//.test(pathname)) return "reference";
  if (/^\/jobs\/[^/]+\/results/.test(pathname)) return "results";
  if (/^\/documents\//.test(pathname)) return "pipeline";
  if (/^\/jobs\/[^/]+$/.test(pathname)) return "pipeline";
  return "upload";
}

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
  const { pathname } = useLocation();
  const currentStep = getCurrentStep(pathname);

  const items: Array<{ key: StepKey; item: NavItem; icon: typeof Upload }> = [
    { key: "upload", item: upload, icon: Upload },
    ...(pipeline ? [{ key: "pipeline" as const, item: pipeline, icon: ListChecks }] : []),
    ...(results ? [{ key: "results" as const, item: results, icon: FileText }] : []),
    ...(reference ? [{ key: "reference" as const, item: reference, icon: BookOpen }] : []),
  ];

  return (
    <nav
      className="flex flex-wrap items-center gap-1 text-sm"
      aria-label="Workflow"
    >
      {items.map(({ key, item, icon: Icon }, index) => {
        const isCurrent = key === currentStep && !item.disabled;
        const isDisabled = item.disabled ?? false;

        const content = (
          <>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </>
        );

        let step: ReactNode;
        if (isCurrent) {
          step = (
            <span
              className="inline-flex items-center gap-1.5 font-medium text-brand-700"
              aria-current="step"
            >
              {content}
            </span>
          );
        } else if (isDisabled) {
          step = (
            <span
              className="inline-flex cursor-not-allowed items-center gap-1.5 text-slate-400"
              aria-disabled="true"
            >
              {content}
            </span>
          );
        } else {
          step = (
            <Link
              to={item.to}
              className="inline-flex items-center gap-1.5 text-slate-500 transition hover:text-brand-600"
            >
              {content}
            </Link>
          );
        }

        return (
          <span key={item.label} className="inline-flex items-center gap-1">
            {index > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-slate-300"
                aria-hidden
              />
            )}
            {step}
          </span>
        );
      })}
    </nav>
  );
}
