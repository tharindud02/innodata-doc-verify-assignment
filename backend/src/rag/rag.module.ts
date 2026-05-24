import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { Chunker } from './chunker.service';
import { RetrievalService } from './retrieval.service';
import { ReferenceIndexer } from './reference-indexer.service';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [DocumentsModule], // for DocumentParser, used by the seed
  providers: [EmbeddingService, Chunker, RetrievalService, ReferenceIndexer],
  exports: [EmbeddingService, Chunker, RetrievalService, ReferenceIndexer],
})
export class RagModule {}