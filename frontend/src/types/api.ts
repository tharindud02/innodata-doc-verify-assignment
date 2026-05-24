export interface UploadResult {
  jobId: string;
  documentId: string;
}

export type StageName =
  | "PARSE"
  | "CHUNK"
  | "EMBED"
  | "SUMMARIZE"
  | "CRITICAL_POINTS"
  | "EXTRACT"
  | "VERIFY";

export type StageStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";
export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
export type FlagStatus = "SUPPORTED" | "CONTRADICTED" | "UNSUPPORTED";

export interface Stage {
  name: StageName;
  status: StageStatus;
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;
}

export interface CriticalPoint {
  id: string;
  text: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  sourcePage: number | null;
}

export interface Entity {
  id: string;
  drugName: string;
  dose: string | null;
  unit: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  indication: string | null;
  sourcePage: number | null;
}

export interface Flag {
  id: string;
  entityId: string;
  status: FlagStatus;
  explanation: string;
  citationText: string | null;
  citationPage: number | null;
  citationSection: string | null;
  citationChunkId: string | null;
  citationMonograph: string | null;
}

export interface JobListItem {
  id: string;
  documentId: string;
  status: JobStatus;
  filename: string;
  createdAt: string;
  completedAt: string | null;
}

export interface FlaggedEntity {
  entity: Entity;
  flag: Flag | null;
}

export interface JobDetail {
  id: string;
  documentId: string;
  referenceDocumentId: string;
  status: JobStatus;
  filename: string;
  stages: Stage[];
  summary: string | null;
  criticalPoints: CriticalPoint[];
  flagged: FlaggedEntity[];
  createdAt: string;
  completedAt: string | null;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}