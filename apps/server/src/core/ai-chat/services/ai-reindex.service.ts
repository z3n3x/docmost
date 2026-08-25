import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiVectorService } from './ai-vector.service';

interface StalePage {
  id: string;
  space_id: string;
  text_content: string | null;
}

const REINDEX_INTERVAL_MS = 10 * 60 * 1000;
const REINDEX_BATCH_SIZE = 10;

@Injectable()
export class AiReindexService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiReindexService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly vectorService: AiVectorService,
  ) {}

  onModuleInit(): void {
    this.timer = setTimeout(() => {
      void this.reindexStalePages();
      this.timer = setInterval(() => void this.reindexStalePages(), REINDEX_INTERVAL_MS);
    }, 5000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.timer) clearInterval(this.timer);
  }

  async reindexStalePages(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const result = await sql<StalePage>`
        SELECT p.id, p.space_id, p.text_content
        FROM pages p
        LEFT JOIN (
          SELECT page_id, MAX(updated_at) AS indexed_at
          FROM ai_page_chunks
          GROUP BY page_id
        ) c ON c.page_id = p.id
        WHERE p.deleted_at IS NULL
          AND p.text_content IS NOT NULL
          AND (c.page_id IS NULL OR p.updated_at > c.indexed_at)
        ORDER BY p.updated_at ASC
        LIMIT ${REINDEX_BATCH_SIZE}
      `.execute(this.db);

      if (!result.rows.length) return;

      this.logger.log(`Re-indexing ${result.rows.length} stale AI pages`);
      for (const page of result.rows) {
        try {
          await this.vectorService.indexPage({
            id: page.id,
            spaceId: page.space_id,
            textContent: page.text_content || '',
          });
        } catch (error) {
          this.logger.warn(
            `Failed to re-index page ${page.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
