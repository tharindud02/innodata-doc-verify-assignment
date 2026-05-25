import { ApiProperty } from '@nestjs/swagger';

export class ReferenceListItemDto {
  @ApiProperty({ example: 'cmabc123ref' })
  id!: string;

  @ApiProperty({ example: 'reference_document.docx' })
  filename!: string;

  @ApiProperty({ example: '2026-05-25T03:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 42 })
  chunkCount!: number;
}
