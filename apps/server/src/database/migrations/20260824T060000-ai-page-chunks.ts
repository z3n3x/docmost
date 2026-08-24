import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('ai_page_chunks')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('chunk_index', 'integer', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('content_hash', 'varchar(64)', (col) => col.notNull())
    .addColumn('embedding', sql`vector(1024)`, (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_ai_page_chunks_page_chunk')
    .ifNotExists()
    .on('ai_page_chunks')
    .columns(['page_id', 'chunk_index'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_ai_page_chunks_space')
    .ifNotExists()
    .on('ai_page_chunks')
    .column('space_id')
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_page_chunks_embedding
    ON ai_page_chunks
    USING hnsw (embedding vector_cosine_ops)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_ai_page_chunks_embedding`.execute(db);
  await db.schema.dropIndex('idx_ai_page_chunks_space').ifExists().execute();
  await db.schema.dropIndex('idx_ai_page_chunks_page_chunk').ifExists().execute();
  await db.schema.dropTable('ai_page_chunks').ifExists().execute();
}
