import { JobStatus } from '@prisma/client';

export class JobListItemDto {
  id!: string;
  documentId!: string;
  status!: JobStatus;
  filename!: string;
  createdAt!: string;
  completedAt!: string | null;
}
