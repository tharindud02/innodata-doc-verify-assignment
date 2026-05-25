-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_citationChunkId_fkey" FOREIGN KEY ("citationChunkId") REFERENCES "chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
