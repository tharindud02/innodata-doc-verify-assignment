import { api } from "@/lib/api";
import type { ReferenceDocument, UploadResult } from "@/types/api";

export async function fetchReferences(): Promise<ReferenceDocument[]> {
  const { data } = await api.get<ReferenceDocument[]>("/documents/references");
  return data;
}

export async function uploadDocument(
  file: File,
  referenceDocumentId?: string
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  if (referenceDocumentId) {
    fd.append("referenceDocumentId", referenceDocumentId);
  }
  const { data } = await api.post<UploadResult>("/documents/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchDocumentPreview(documentId: string): Promise<string> {
  const { data } = await api.get<{ html: string }>(
    `/documents/${documentId}/preview`
  );
  return data.html;
}

export interface StoredUploadResult {
  jobId: string;
  documentId: string;
  filename: string;
}

const UPLOAD_RESULT_KEY = "last-upload-result";

export function storeUploadResult(result: StoredUploadResult): void {
  sessionStorage.setItem(UPLOAD_RESULT_KEY, JSON.stringify(result));
}

export function getStoredUploadResult(): StoredUploadResult | null {
  const raw = sessionStorage.getItem(UPLOAD_RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUploadResult;
  } catch {
    return null;
  }
}

export function clearStoredUploadResult(): void {
  sessionStorage.removeItem(UPLOAD_RESULT_KEY);
  sessionStorage.removeItem("pending-upload-name");
}
