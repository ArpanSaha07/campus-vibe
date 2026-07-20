-- Hybrid semantic search (see .claude/search-implementation.md)
-- Requires the pgvector extension (db image: pgvector/pgvector:pg15)

CREATE EXTENSION IF NOT EXISTS vector;

-- Embeddings are written by the backend SearchIndexService via JDBC and are
-- intentionally not mapped in the JPA entities.
ALTER TABLE events ADD COLUMN embedding vector(1536);
ALTER TABLE clubs ADD COLUMN embedding vector(1536);

-- Approximate nearest-neighbour indexes for the semantic leg (cosine distance)
CREATE INDEX IF NOT EXISTS idx_events_embedding
	ON events USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_clubs_embedding
	ON clubs USING hnsw (embedding vector_cosine_ops);

-- Full-text indexes for the keyword leg
CREATE INDEX IF NOT EXISTS idx_events_fts
	ON events USING gin (to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_clubs_fts
	ON clubs USING gin (to_tsvector('english', name || ' ' || COALESCE(description, '')));
