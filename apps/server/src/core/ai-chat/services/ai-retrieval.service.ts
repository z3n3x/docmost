import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { SearchService } from '../../search/search.service';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { KyselyDB } from '@docmost/db/types/kysely.types';

export interface RetrievalResult {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
  content: string;
  rank: number;
  isFallback?: boolean;
}

@Injectable()
export class AiRetrievalService {
  private readonly logger = new Logger(AiRetrievalService.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async retrieveContext(params: {
    query: string;
    userId: string;
    workspaceId: string;
    spaceId?: string;
    limit?: number;
    maxContentLength?: number;
  }): Promise<RetrievalResult[]> {
    const {
      query,
      userId,
      workspaceId,
      spaceId,
      limit = 5,
      maxContentLength = 3000,
    } = params;

    this.logger.log(
      `Retrieval started: space=${spaceId ?? 'none'} user=${userId} queryLength=${query.length}`,
    );

    const trimmedQuery = query?.trim() || '';
    const searchResults = await this.searchService.searchPage(
      {
        query: trimmedQuery,
        limit: Math.min(limit * 2, 20),
        spaceId,
      },
      { userId, workspaceId },
    );

    let items = (searchResults.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      slugId: item.slugId,
      rank: item.rank || 0,
      isFallback: false,
    }));

    this.logger.log(`Search returned ${items.length} accessible pages`);

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
        ? await this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds,
            userId,
            spaceId,
          })
        : [];
      const accessibleSet = new Set(accessibleIds);

      items = recentPages
        .filter((page) => accessibleSet.has(page.id))
        .map((page) => ({
          id: page.id,
          title: page.title,
          slugId: page.slugId,
          rank: 0,
          isFallback: true,
        }));

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

        if (!page || page.spaceId !== spaceId) {
          continue;
        }

        const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds: [page.id],
          userId,
          spaceId,
        });
        if (!accessibleIds.includes(page.id)) {
          continue;
        }

        results.push({
          pageId: page.id,
          title: page.title || 'Untitled',
          slugId: page.slugId,
          spaceId: page.spaceId,
          content: (page.textContent || '').slice(0, maxContentLength),
          rank: item.rank,
          isFallback: item.isFallback,
        });
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
    const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds: [pageId],
      userId,
    });
    return accessibleIds.includes(pageId);
  }

  buildContextPrompt(retrievedPages: RetrievalResult[]): string {
    if (retrievedPages.length === 0) {
      return '';
    }

    const contextParts = retrievedPages.map((page, index) => {
      return `---\nPage ${index + 1}: ${page.title}\nSpace ID: ${page.spaceId}\nSlug: ${page.slugId}\n\n${page.content}\n---`;
    });

    return `Context from relevant pages:\n\n${contextParts.join('\n\n')}`;
  }
}
