import { ApiProperty } from '@nestjs/swagger';

export class UploadResultDto {
  @ApiProperty({ example: 'cmabc123job' })
  jobId!: string;

  @ApiProperty({ example: 'cmabc123doc' })
  documentId!: string;
}