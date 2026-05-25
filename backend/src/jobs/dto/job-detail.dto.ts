import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CriticalSeverity,
  FlagStatus,
  JobStatus,
  StageName,
  StageStatus,
} from '@prisma/client';

export class StageDto {
  @ApiProperty({ enum: StageName, example: StageName.PARSE })
  name!: StageName;

  @ApiProperty({ enum: StageStatus, example: StageStatus.DONE })
  status!: StageStatus;

  @ApiPropertyOptional({ nullable: true, example: '2026-05-25T03:00:01.000Z' })
  startedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-05-25T03:00:03.000Z' })
  endedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  error!: string | null;
}

export class CriticalPointDto {
  @ApiProperty({ example: 'cmabc123cp' })
  id!: string;

  @ApiProperty({
    example: 'The patient should take this medication at bedtime only.',
  })
  text!: string;

  @ApiProperty({ enum: CriticalSeverity, example: CriticalSeverity.HIGH })
  severity!: CriticalSeverity;

  @ApiPropertyOptional({ nullable: true, example: 2 })
  sourcePage!: number | null;
}

export class EntityDto {
  @ApiProperty({ example: 'cmabc123entity' })
  id!: string;

  @ApiProperty({ example: 'Clonazepam' })
  drugName!: string;

  @ApiPropertyOptional({ nullable: true, example: '1' })
  dose!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'mg' })
  unit!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'PO' })
  route!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'twice daily' })
  frequency!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '8 weeks' })
  duration!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'anxiety' })
  indication!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  sourcePage!: number | null;
}

export class FlagDto {
  @ApiProperty({ example: 'cmabc123flag' })
  id!: string;

  @ApiProperty({ example: 'cmabc123entity' })
  entityId!: string;

  @ApiProperty({ enum: FlagStatus, example: FlagStatus.CONTRADICTED })
  status!: FlagStatus;

  @ApiProperty({
    example: 'Prescribed duration exceeds formulary maximum of 4 weeks.',
  })
  explanation!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Must not exceed 4 weeks for anxiety.',
  })
  citationText!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 4 })
  citationPage!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'Dosing' })
  citationSection!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'cmabc123chunk' })
  citationChunkId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Clonazepam' })
  citationMonograph!: string | null;
}

export class FlaggedEntityDto {
  @ApiProperty({ type: EntityDto })
  entity!: EntityDto;

  @ApiPropertyOptional({ type: FlagDto, nullable: true })
  flag!: FlagDto | null;
}

export class JobDetailDto {
  @ApiProperty({ example: 'cmabc123job' })
  id!: string;

  @ApiProperty({ example: 'cmabc123doc' })
  documentId!: string;

  @ApiProperty({ example: 'cmabc123ref' })
  referenceDocumentId!: string;

  @ApiProperty({ enum: JobStatus, example: JobStatus.COMPLETED })
  status!: JobStatus;

  @ApiProperty({ example: 'primary_document.docx' })
  filename!: string;

  @ApiProperty({ type: StageDto, isArray: true })
  stages!: StageDto[];

  @ApiPropertyOptional({
    nullable: true,
    example: 'Discharge summary for a patient with hypertension and anxiety.',
  })
  summary!: string | null;

  @ApiProperty({ type: CriticalPointDto, isArray: true })
  criticalPoints!: CriticalPointDto[];

  @ApiProperty({ type: FlaggedEntityDto, isArray: true })
  flagged!: FlaggedEntityDto[];

  @ApiProperty({ example: '2026-05-25T03:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-05-25T03:05:00.000Z',
  })
  completedAt!: string | null;
}
