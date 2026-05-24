import { useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useNavigate } from "react-router";
import { Upload, FileText, X } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { storeUploadResult, uploadDocument } from "@/lib/documents";

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
      const { jobId, documentId } = await uploadDocument(file);
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
      <h1 className="mb-2 text-2xl font-semibold">Verify a document</h1>
      <p className="mb-6 text-slate-600">
        Upload a discharge summary or prescription. We&apos;ll verify it against
        the Meridian Bay institutional formulary.
      </p>

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
        disabled={!file || uploading}
        onClick={onSubmit}
        className="mt-6 w-full rounded-md bg-brand-600 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Verify document"}
      </button>
    </div>
  );
}
