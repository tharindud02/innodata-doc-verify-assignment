import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';

export class JobListItemDto {
  @ApiProperty({ example: 'cmabc123job' })
  id!: string;

  @ApiProperty({ example: 'cmabc123doc' })
  documentId!: string;

  @ApiProperty({ enum: JobStatus, example: JobStatus.COMPLETED })
  status!: JobStatus;

  @ApiProperty({ example: 'primary_document.docx' })
  filename!: string;

  @ApiProperty({ example: '2026-05-25T03:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-05-25T03:05:00.000Z',
  })
  completedAt!: string | null;
}
