import { Kysely, sql } from 'kysely';
import { KyselyDB } from '../types/kysely.types';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS ai_page_chunks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      chunk_index integer NOT NULL,
      content text NOT NULL,
      content_hash text NOT NULL,
      embedding vector(1024) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(page_id, chunk_index)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS ai_page_chunks_page_id_idx
    ON ai_page_chunks(page_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS ai_page_chunks_space_id_idx
    ON ai_page_chunks(space_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS ai_page_chunks_embedding_idx
    ON ai_page_chunks USING hnsw (embedding vector_cosine_ops)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS ai_page_chunks`.execute(db);
}
