-- HNSW index for semantic search over Bundle embeddings.
--
-- drizzle-kit does not yet emit pgvector index DDL; this migration is hand
-- authored. `vector_cosine_ops` matches our embedder (text-embedding-3-small).
-- Concurrent build avoids long table locks on production data.

CREATE INDEX IF NOT EXISTS "bundles_embedding_hnsw_idx"
  ON "bundles"
  USING hnsw ("embedding" vector_cosine_ops);
