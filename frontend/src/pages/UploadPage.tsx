import { useEffect, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Link, useNavigate } from "react-router";
import { Eye, Upload, FileText, X } from "lucide-react";
import { ReferencePreviewModal } from "@/components/ReferencePreviewModal";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  fetchReferences,
  storeUploadResult,
  uploadDocument,
} from "@/lib/documents";
import type { ReferenceDocument } from "@/types/api";
import { fetchUserJobs } from "@/lib/jobs";
import { WorkflowNav } from "@/components/WorkflowNav";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import type { JobListItem } from "@/types/api";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};
const MAX_SIZE = 5 * 1024 * 1024;

function clientSideError(rejected: FileRejection[]): string {
  const code = rejected[0]?.errors[0]?.message ?? "Invalid file";
  if (code.includes("file-invalid-type")) {
    return "Unsupported file type. Accepted: DOCX, PDF.";
  }
  if (code.includes("file-too-large")) {
    return `File too large (max ${MAX_SIZE / (1024 * 1024)} MB).`;
  }
  return code;
}

export function UploadPage() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recentJobs, setRecentJobs] = useState<JobListItem[]>([]);
  const [references, setReferences] = useState<ReferenceDocument[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string>("");
  const [refsLoading, setRefsLoading] = useState(true);
  const [referencePreviewOpen, setReferencePreviewOpen] = useState(false);

  const selectedReference = references.find((r) => r.id === selectedReferenceId);

  useEffect(() => {
    fetchUserJobs()
      .then(setRecentJobs)
      .catch(() => setRecentJobs([]));
  }, []);

  useEffect(() => {
    fetchReferences()
      .then((refs) => {
        const indexed = refs.filter((r) => r.chunkCount > 0);
        const usable = indexed.length > 0 ? indexed : refs;
        setReferences(usable);
        if (usable.length > 0) {
          setSelectedReferenceId(usable[0].id);
        }
      })
      .catch(() => setReferences([]))
      .finally(() => setRefsLoading(false));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    multiple: false,
    onDrop: (accepted, rejected) => {
      setError(null);
      if (rejected.length) {
        setError(clientSideError(rejected));
        return;
      }
      setFile(accepted[0]);
    },
  });

  async function onSubmit() {
    if (!file) return;
    setUploading(true);
    setError(null);
    sessionStorage.setItem("pending-upload-name", file.name);

    try {
      const { jobId, documentId } = await uploadDocument(
        file,
        selectedReferenceId || undefined
      );
      storeUploadResult({ jobId, documentId, filename: file.name });
      nav(`/documents/${documentId}?job=${jobId}`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Upload failed"));
      sessionStorage.removeItem("pending-upload-name");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <WorkflowNav
        upload={{ to: "/", label: "Upload" }}
        pipeline={{ to: "#", label: "Pipeline", disabled: true }}
        results={{ to: "#", label: "Results", disabled: true }}
      />
      <h1 className="mb-2 text-2xl font-semibold">Verify a document</h1>
      <p className="mb-6 text-slate-600">
        Upload a discharge summary or prescription. Choose which institutional
        formulary to verify against.
      </p>

      <section className="mb-6 rounded-lg border bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="reference-select"
            className="text-sm font-medium text-slate-800"
          >
            Reference document (formulary)
          </label>
          {selectedReference && (
            <button
              type="button"
              onClick={() => setReferencePreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5" />
              View formulary
            </button>
          )}
        </div>
        {refsLoading ? (
          <p className="text-sm text-slate-500">Loading formulary list...</p>
        ) : references.length === 0 ? (
          <p className="text-sm text-amber-700" role="alert">
            No reference documents are configured. Run the seed script first.
          </p>
        ) : references.length === 1 ? (
          <p className="text-sm text-slate-700">{references[0].filename}</p>
        ) : (
          <select
            id="reference-select"
            value={selectedReferenceId}
            onChange={(e) => setSelectedReferenceId(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {references.map((ref) => (
              <option key={ref.id} value={ref.id}>
                {ref.filename}
                {ref.chunkCount === 0 ? " (not indexed)" : ""}
              </option>
            ))}
          </select>
        )}
      </section>

      {selectedReference && (
        <ReferencePreviewModal
          open={referencePreviewOpen}
          onClose={() => setReferencePreviewOpen(false)}
          referenceDocumentId={selectedReference.id}
          referenceFilename={selectedReference.filename}
        />
      )}

      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition ${
          isDragActive
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-white hover:border-brand-400"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-3 h-10 w-10 text-slate-400" />
        <p className="font-medium">Drag & drop a file here, or click to browse</p>
        <p className="mt-1 text-sm text-slate-500">PDF or DOCX, up to 5 MB</p>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-md border bg-white p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-600" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="rounded p-1 hover:bg-slate-100"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={
          !file || uploading || refsLoading || references.length === 0
        }
        onClick={onSubmit}
        className="mt-6 w-full rounded-md bg-brand-600 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Verify document"}
      </button>

      {recentJobs.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="mb-4 text-lg font-semibold">Recent documents</h2>
          <ul className="divide-y rounded-md border bg-white">
            {recentJobs.map((job) => (
              <li key={job.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{job.filename}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <JobStatusBadge status={job.status} />
                    <Link
                      to={`/documents/${job.documentId}?job=${job.id}`}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Pipeline
                    </Link>
                    <Link
                      to={`/jobs/${job.id}/results`}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Results
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
