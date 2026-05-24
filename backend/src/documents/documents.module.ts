import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentParser } from './document-parser.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [JobsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentParser],
  exports: [DocumentsService, DocumentParser],
})
export class DocumentsModule {}