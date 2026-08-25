import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { SearchService } from '../../search/search.service';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiVectorService } from './ai-vector.service';

export interface RetrievalResult {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
  content: string;
  rank: number;
  isFallback?: boolean;
}

const CHUNK_SIZE = 3500;
const CHUNK_OVERLAP = 400;
const MAX_CHUNKS_PER_PAGE = 2;
const RRF_K = 60;

@Injectable()
export class AiRetrievalService {
  private readonly logger = new Logger(AiRetrievalService.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageRepo: PageRepo,
    private readonly vectorService: AiVectorService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  private chunkContent(content: string): string[] {
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < normalized.length) {
      let end = Math.min(start + CHUNK_SIZE, normalized.length);

      if (end < normalized.length) {
        const paragraphBreak = normalized.lastIndexOf('\n\n', end);
        const sentenceBreak = normalized.lastIndexOf('. ', end);
        const boundary = Math.max(paragraphBreak, sentenceBreak);
        if (boundary > start + CHUNK_SIZE * 0.6) {
          end = boundary + (paragraphBreak === boundary ? 2 : 1);
        }
      }

      const chunk = normalized.slice(start, end).trim();
      if (chunk) chunks.push(chunk);
      if (end >= normalized.length) break;

      start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }

    return chunks;
  }

  private selectRelevantChunks(content: string, query: string): string {
    const chunks = this.chunkContent(content);
    if (chunks.length <= MAX_CHUNKS_PER_PAGE) return chunks.join('\n\n');

    const terms = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= 3)
      .slice(0, 20);

    const scored = chunks.map((chunk, index) => {
      const lower = chunk.toLowerCase();
      const score = terms.reduce((total, term) => {
        let count = 0;
        let offset = 0;
        while ((offset = lower.indexOf(term, offset)) !== -1) {
          count++;
          offset += term.length;
        }
        return total + count;
      }, 0);
      return { chunk, index, score };
    });

    const selected = scored
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, MAX_CHUNKS_PER_PAGE)
      .sort((a, b) => a.index - b.index);

    return selected.map((item) => item.chunk).join('\n\n[...chunk boundary...]\n\n');
  }

  async retrieveContext(params: {
    query: string;
    userId: string;
    workspaceId: string;
    spaceId?: string;
    limit?: number;
    maxContentLength?: number;
  }): Promise<RetrievalResult[]> {
    const { query, userId, workspaceId, spaceId, limit = 5 } = params;

    this.logger.log(
      `Retrieval started: space=${spaceId ?? 'none'} user=${userId} queryLength=${query.length}`,
    );

    const trimmedQuery = query?.trim() || '';
    const candidateLimit = Math.min(limit * 3, 20);
    const searchResults = await this.searchService.searchPage(
      {
        query: trimmedQuery,
        limit: candidateLimit,
        spaceId,
      },
      { userId, workspaceId },
    );

    const lexicalItems = (searchResults.items || []).map((item, index) => ({
      id: item.id,
      rank: index + 1,
      isFallback: false,
    }));

    let semanticItems: Array<{
      id: string;
      rank: number;
      isFallback: boolean;
    }> = [];

    if (spaceId && trimmedQuery) {
      try {
        const semanticHits = await this.vectorService.search(trimmedQuery, spaceId, candidateLimit);

        // Multiple chunks can belong to one page. Keep the best semantic rank per page.
        const bestSemanticRank = new Map<string, number>();
        for (const [index, hit] of semanticHits.entries()) {
          const rank = index + 1;
          const current = bestSemanticRank.get(hit.pageId);
          if (current === undefined || rank < current) bestSemanticRank.set(hit.pageId, rank);
        }

        semanticItems = Array.from(bestSemanticRank.entries()).map(([id, rank]) => ({
          id,
          rank,
          isFallback: false,
        }));
        this.logger.log(`Vector search returned ${semanticItems.length} unique pages`);
      } catch (error) {
        this.logger.warn(
          `Vector search unavailable; continuing with lexical retrieval: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Fuse lexical and semantic rankings with Reciprocal Rank Fusion instead of
    // comparing unrelated score scales from PostgreSQL FTS and vector similarity.
    const fused = new Map<string, { id: string; score: number; isFallback: boolean }>();
    for (const item of lexicalItems) {
      fused.set(item.id, {
        id: item.id,
        score: 1 / (RRF_K + item.rank),
        isFallback: false,
      });
    }
    for (const item of semanticItems) {
      const existing = fused.get(item.id);
      const contribution = 1 / (RRF_K + item.rank);
      fused.set(item.id, {
        id: item.id,
        score: (existing?.score ?? 0) + contribution,
        isFallback: false,
      });
    }

    let items = Array.from(fused.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, candidateLimit);
    this.logger.log(`Hybrid retrieval candidates: ${items.length}`);

    if (items.length === 0 && spaceId) {
      this.logger.log(`No exact results; loading recent pages from space=${spaceId}`);

      const recentPages = await this.db
        .selectFrom('pages')
        .select(['id', 'title', 'slugId'])
        .where('spaceId', '=', spaceId)
        .where('workspaceId', '=', workspaceId)
        .where('deletedAt', 'is', null)
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .execute();

      const pageIds = recentPages.map((page) => page.id);
      const accessibleIds = pageIds.length
        ? await this.pagePermissionRepo.filterAccessiblePageIds({ pageIds, userId, spaceId })
        : [];
      const accessibleSet = new Set(accessibleIds);

      items = recentPages
        .filter((page) => accessibleSet.has(page.id))
        .map((page) => ({ id: page.id, score: 0, isFallback: true }));

      this.logger.log(`Fallback returned ${items.length} accessible pages`);
    }

    if (items.length === 0) {
      this.logger.log('Retrieval completed with no accessible pages');
      return [];
    }

    const results: RetrievalResult[] = [];
    for (const item of items) {
      try {
        const page = await this.pageRepo.findById(item.id, {
          includeContent: true,
          includeTextContent: true,
        });

        if (!page || page.spaceId !== spaceId) continue;

        const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds: [page.id],
          userId,
          spaceId,
        });
        if (!accessibleIds.includes(page.id)) continue;

        const textContent = page.textContent || '';
        results.push({
          pageId: page.id,
          title: page.title || 'Untitled',
          slugId: page.slugId,
          spaceId: page.spaceId,
          content: this.selectRelevantChunks(textContent, trimmedQuery),
          rank: item.score,
          isFallback: item.isFallback,
        });

        if (spaceId && textContent) {
          void this.vectorService.indexPage({ id: page.id, spaceId: page.spaceId, textContent }).catch((error) => {
            this.logger.warn(
              `Failed to index page ${page.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to load page ${item.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const finalResults = results.slice(0, limit);
    this.logger.log(`Retrieval completed with ${finalResults.length} pages`);
    return finalResults;
  }

  async canAccessPage(pageId: string, userId: string): Promise<boolean> {
    const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({ pageIds: [pageId], userId });
    return accessibleIds.includes(pageId);
  }

  buildContextPrompt(retrievedPages: RetrievalResult[]): string {
    if (retrievedPages.length === 0) return '';

    const contextParts = retrievedPages.map((page, index) => {
      return `---\nPage ${index + 1}: ${page.title}\nSpace ID: ${page.spaceId}\nSlug: ${page.slugId}\n\n${page.content}\n---`;
    });

    return `Context from relevant pages:\n\n${contextParts.join('\n\n')}`;
  }
}
