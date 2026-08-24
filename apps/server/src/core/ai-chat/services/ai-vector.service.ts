import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiEmbeddingService } from './ai-embedding.service';

export interface VectorChunkHit {
  pageId: string;
  chunkIndex: number;
  content: string;
  score: number;
}

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 250;

@Injectable()
export class AiVectorService {
  private readonly logger = new Logger(AiVectorService.name);

  constructor(
    private readonly embeddings: AiEmbeddingService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  chunkContent(content: string): string[] {
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) return [];

    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
      let end = Math.min(start + CHUNK_SIZE, normalized.length);
      if (end < normalized.length) {
        const paragraph = normalized.lastIndexOf('\n\n', end);
        const sentence = normalized.lastIndexOf('. ', end);
        const boundary = Math.max(paragraph, sentence);
        if (boundary > start + CHUNK_SIZE * 0.6) end = boundary + (paragraph === boundary ? 2 : 1);
      }

      const chunk = normalized.slice(start, end).trim();
      if (chunk) chunks.push(chunk);
      if (end >= normalized.length) break;
      start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }
    return chunks;
  }

  async indexPage(page: { id: string; spaceId: string; textContent: string }): Promise<void> {
    const chunks = this.chunkContent(page.textContent);
    if (!chunks.length) {
      await sql`DELETE FROM ai_page_chunks WHERE page_id = ${page.id}`.execute(this.db);
      return;
    }

    const hashes = chunks.map((chunk) => createHash('sha256').update(chunk).digest('hex'));
    const existing = await sql<{ chunk_index: number; content_hash: string }>`
      SELECT chunk_index, content_hash
      FROM ai_page_chunks
      WHERE page_id = ${page.id}
    `.execute(this.db);
    const existingMap = new Map(existing.rows.map((row) => [row.chunk_index, row.content_hash]));

    const changedIndexes = chunks
      .map((chunk, index) => ({ chunk, index, hash: hashes[index] }))
      .filter((item) => existingMap.get(item.index) !== item.hash);

    if (changedIndexes.length) {
      const embeddings = await this.embeddings.embed(changedIndexes.map((item) => item.chunk));
      for (let i = 0; i < changedIndexes.length; i++) {
        const item = changedIndexes[i];
        const vector = `[${embeddings[i].join(',')}]`;
        await sql`
          INSERT INTO ai_page_chunks
            (page_id, space_id, chunk_index, content, content_hash, embedding, updated_at)
          VALUES
            (${page.id}, ${page.spaceId}, ${item.index}, ${item.chunk}, ${item.hash}, ${vector}::vector, now())
          ON CONFLICT (page_id, chunk_index) DO UPDATE SET
            space_id = EXCLUDED.space_id,
            content = EXCLUDED.content,
            content_hash = EXCLUDED.content_hash,
            embedding = EXCLUDED.embedding,
            updated_at = now()
        `.execute(this.db);
      }
    }

    await sql`
      DELETE FROM ai_page_chunks
      WHERE page_id = ${page.id} AND chunk_index >= ${chunks.length}
    `.execute(this.db);
  }

  async search(query: string, spaceId: string, limit = 12): Promise<VectorChunkHit[]> {
    const [embedding] = await this.embeddings.embed(query);
    const vector = `[${embedding.join(',')}]`;

    const result = await sql<{
      page_id: string;
      chunk_index: number;
      content: string;
      score: number;
    }>`
      SELECT
        page_id,
        chunk_index,
        content,
        1 - (embedding <=> ${vector}::vector) AS score
      FROM ai_page_chunks
      WHERE space_id = ${spaceId}
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${limit}
    `.execute(this.db);

    return result.rows.map((row) => ({
      pageId: row.page_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      score: Number(row.score),
    }));
  }

  async isIndexed(pageId: string, content: string): Promise<boolean> {
    const hash = createHash('sha256').update(content).digest('hex');
    const result = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM ai_page_chunks
        WHERE page_id = ${pageId} AND content_hash = ${hash}
      ) AS exists
    `.execute(this.db);
    return Boolean(result.rows[0]?.exists);
  }
}
