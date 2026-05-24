import {
    CriticalSeverity,
    FlagStatus,
    JobStatus,
    StageName,
    StageStatus,
  } from '@prisma/client';
  
  export class StageDto {
    name!: StageName;
    status!: StageStatus;
    startedAt!: string | null;
    endedAt!: string | null;
    error!: string | null;
  }
  
  export class CriticalPointDto {
    id!: string;
    text!: string;
    severity!: CriticalSeverity;
    sourcePage!: number | null;
  }
  
  export class EntityDto {
    id!: string;
    drugName!: string;
    dose!: string | null;
    unit!: string | null;
    route!: string | null;
    frequency!: string | null;
    duration!: string | null;
    indication!: string | null;
    sourcePage!: number | null;
  }
  
  export class FlagDto {
    id!: string;
    entityId!: string;
    status!: FlagStatus;
    explanation!: string;
    citationText!: string | null;
    citationPage!: number | null;
    citationSection!: string | null;
    citationChunkId!: string | null;
    citationMonograph!: string | null;
  }
  
  export class FlaggedEntityDto {
    entity!: EntityDto;
    flag!: FlagDto | null;
  }
  
  export class JobDetailDto {
    id!: string;
    documentId!: string;
    referenceDocumentId!: string;
    status!: JobStatus;
    filename!: string;
    stages!: StageDto[];
    summary!: string | null;
    criticalPoints!: CriticalPointDto[];
    flagged!: FlaggedEntityDto[];
    createdAt!: string;
    completedAt!: string | null;
  }