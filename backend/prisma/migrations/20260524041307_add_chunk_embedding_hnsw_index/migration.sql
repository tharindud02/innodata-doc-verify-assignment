-- HNSW index for fast cosine-similarity nearest-neighbor search.
-- Cosine works well for sentence-embedding models like all-MiniLM-L6-v2.
-- For < ~10k vectors, this is overkill but consistent with production patterns.
CREATE INDEX chunks_embedding_hnsw_idx
  ON chunks
  USING hnsw (embedding vector_cosine_ops);