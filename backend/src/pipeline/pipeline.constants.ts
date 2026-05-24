import { StageName } from '@prisma/client';

/**
 * Ordered list of pipeline stages. The upload endpoint creates one PENDING
 * Stage row per name so the frontend can show all 7 stages from t=0.
 */
export const PIPELINE_STAGES: StageName[] = [
  StageName.PARSE,
  StageName.CHUNK,
  StageName.EMBED,
  StageName.SUMMARIZE,
  StageName.CRITICAL_POINTS,
  StageName.EXTRACT,
  StageName.VERIFY,
];