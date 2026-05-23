import type {
  CriticalPoint,
  FlaggedEntity,
  JobDetail,
  Stage,
  StageName,
} from "./types.js";

export const DEMO_EMAIL = "demo@meridianbay.test";
export const DEMO_PASSWORD = "demo1234";

const STAGE_ORDER: StageName[] = [
  "PARSE",
  "CHUNK",
  "EMBED",
  "SUMMARIZE",
  "CRITICAL_POINTS",
  "EXTRACT",
  "VERIFY",
];

export function createPendingStages(): Stage[] {
  return STAGE_ORDER.map((name) => ({
    name,
    status: "PENDING",
    startedAt: null,
    endedAt: null,
    error: null,
  }));
}

const DEMO_CRITICAL_POINTS: CriticalPoint[] = [
  {
    id: "cp-1",
    text: "Take with food to reduce stomach upset.",
    severity: "MEDIUM",
    sourcePage: 1,
  },
  {
    id: "cp-2",
    text: "Do not stop abruptly without clinician guidance.",
    severity: "HIGH",
    sourcePage: 2,
  },
];

const DEMO_FLAGGED: FlaggedEntity[] = [
  {
    entity: {
      id: "ent-1",
      drugName: "Metformin",
      dose: "500",
      unit: "mg",
      route: "oral",
      frequency: "twice daily",
      duration: null,
      indication: "type 2 diabetes",
      sourcePage: 1,
    },
    flag: {
      id: "flag-1",
      entityId: "ent-1",
      status: "SUPPORTED",
      explanation: "Dose and frequency match institutional formulary.",
      citationText: "Metformin 500 mg PO BID with meals.",
      citationPage: 1,
      citationSection: "Medications",
      citationChunkId: "chunk-1",
    },
  },
  {
    entity: {
      id: "ent-2",
      drugName: "Lisinopril",
      dose: "40",
      unit: "mg",
      route: "oral",
      frequency: "once daily",
      duration: null,
      indication: "hypertension",
      sourcePage: 2,
    },
    flag: {
      id: "flag-2",
      entityId: "ent-2",
      status: "CONTRADICTED",
      explanation: "Prescribed dose exceeds formulary max without documented exception.",
      citationText: "Lisinopril max maintenance 20 mg daily per formulary.",
      citationPage: 2,
      citationSection: "Formulary limits",
      citationChunkId: "chunk-2",
    },
  },
];

export function buildCompletedJob(
  jobId: string,
  documentId: string,
  filename: string,
  createdAt: string
): JobDetail {
  const completedAt = new Date().toISOString();
  const stages: Stage[] = STAGE_ORDER.map((name) => ({
    name,
    status: "DONE" as const,
    startedAt: createdAt,
    endedAt: completedAt,
    error: null,
  }));

  return {
    id: jobId,
    documentId,
    status: "COMPLETED",
    filename,
    stages,
    summary:
      "Discharge summary for a 58-year-old patient with type 2 diabetes and hypertension. Metformin dosing aligns with formulary guidance. Lisinopril 40 mg daily exceeds the institutional maximum and should be reviewed.",
    criticalPoints: DEMO_CRITICAL_POINTS,
    flagged: DEMO_FLAGGED,
    createdAt,
    completedAt,
  };
}

export function advanceStages(stages: Stage[], step: number): Stage[] {
  return stages.map((stage, index) => {
    if (index < step) {
      const endedAt = new Date().toISOString();
      return {
        ...stage,
        status: "DONE",
        startedAt: stage.startedAt ?? endedAt,
        endedAt,
      };
    }
    if (index === step) {
      return {
        ...stage,
        status: "RUNNING",
        startedAt: stage.startedAt ?? new Date().toISOString(),
        endedAt: null,
      };
    }
    return { ...stage, status: "PENDING", startedAt: null, endedAt: null };
  });
}

export function demoDocumentPreview(filename: string): string {
  return `<article style="font-family:system-ui,sans-serif;line-height:1.5;padding:1rem">
    <h1 style="font-size:1.25rem;margin:0 0 1rem">Discharge Summary (Demo)</h1>
    <p><strong>Source file:</strong> ${escapeHtml(filename)}</p>
    <h2>Medications</h2>
    <ul>
      <li>Metformin 500 mg PO BID with meals</li>
      <li>Lisinopril 40 mg PO daily</li>
    </ul>
    <h2>Patient instructions</h2>
    <p>Take metformin with food. Continue blood pressure monitoring. Follow up in 2 weeks.</p>
  </article>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
