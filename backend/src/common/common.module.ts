import { Global, Module } from '@nestjs/common';
import { FileStorage } from './file-storage';

@Global()
@Module({
  providers: [FileStorage],
  exports: [FileStorage],
})
export class CommonModule {}