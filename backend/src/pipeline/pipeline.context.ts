/**
 * Context object passed to each pipeline stage. Stages mutate the DB and
 * may read back via Prisma — they don't pass big payloads between each other.
 * Keeping the context tiny prevents accidental "implicit pipeline state."
 */
export interface PipelineContext {
    jobId: string;
    primaryDocumentId: string;
    referenceDocumentId: string;
    userId: string;
  }